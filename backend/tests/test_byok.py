"""BYOK (bring your own key): access rules per plan, fallback order, error codes."""
import asyncio
import os
import unittest
from unittest import mock

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from services import ai_access, llm_client as llm_module
from services.ai_access import ai_error_code, resolve_llm_client
from services.llm_client import AI_ERROR_HEADER, LLMClient, LLMTarget

USER_KEY = "sk-user-secret-key-123456"


def make_request(headers=None) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "method": "POST", "path": "/"})


BYOK_HEADERS = {"X-LLM-Provider": "openai", "X-LLM-Key": USER_KEY, "X-LLM-Model": "gpt-test"}


def server_target(model="server-model"):
    return LLMTarget(provider="groq", url="https://server.test", api_key="server-key", model=model, timeout_seconds=5)


class ResolveTests(unittest.TestCase):
    def test_business_requires_user_key(self):
        with self.assertRaises(HTTPException) as ctx:
            resolve_llm_client(make_request(), "business")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ai_error_code(ctx.exception), "byok_required")

    def test_business_uses_only_user_key(self):
        with mock.patch.object(ai_access, "server_llm_client", return_value=LLMClient([server_target()])):
            client = resolve_llm_client(make_request(BYOK_HEADERS), "business")
        self.assertEqual(client.model_chain, ["byok:openai:gpt-test"])

    def test_individual_tries_server_first_then_user_key(self):
        with mock.patch.object(ai_access, "server_llm_client", return_value=LLMClient([server_target()])):
            client = resolve_llm_client(make_request(BYOK_HEADERS), "individual")
        self.assertEqual(client.model_chain, ["groq:server-model", "byok:openai:gpt-test"])
        self.assertFalse(client.offer_byok)

    def test_individual_without_key_offers_byok(self):
        with mock.patch.object(ai_access, "server_llm_client", return_value=LLMClient([server_target()])):
            client = resolve_llm_client(make_request(), "individual")
        self.assertTrue(client.offer_byok)

    def test_individual_with_no_server_and_no_key(self):
        with mock.patch.object(ai_access, "server_llm_client", return_value=None):
            with self.assertRaises(HTTPException) as ctx:
                resolve_llm_client(make_request(), "individual")
        self.assertEqual(ai_error_code(ctx.exception), "server_exhausted")

    def test_default_model_used_when_omitted(self):
        target = ai_access.byok_target_from_request(make_request({"X-LLM-Provider": "anthropic", "X-LLM-Key": USER_KEY}))
        self.assertEqual(target.model, ai_access.BYOK_PROVIDERS["anthropic"].default_model)
        self.assertTrue(target.byok)

    def test_rejects_unknown_provider_and_bad_key(self):
        for headers in (
            {"X-LLM-Provider": "evil", "X-LLM-Key": USER_KEY},
            {"X-LLM-Provider": "openai", "X-LLM-Key": "short"},
            {"X-LLM-Provider": "openai", "X-LLM-Key": "has spaces in it 1234"},
            {"X-LLM-Provider": "openai", "X-LLM-Key": USER_KEY, "X-LLM-Model": "bad model!"},
        ):
            with self.assertRaises(HTTPException) as ctx:
                ai_access.byok_target_from_request(make_request(headers))
            self.assertEqual(ctx.exception.status_code, 400)


def run(coro):
    return asyncio.run(coro)


class FallbackTests(unittest.TestCase):
    """The chain falls through to the user's key only after the server fails."""

    def client_with(self, outcomes, offer_byok=False):
        targets = [server_target("a"), LLMTarget("openai", "https://u.test", USER_KEY, "m", 5, byok=True)]
        client = LLMClient(targets, offer_byok=offer_byok)
        calls = []

        async def fake_call(target, *args):
            calls.append(target.label)
            outcome = outcomes[target.label]
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

        client._call = fake_call
        return client, calls

    def test_server_success_never_touches_user_key(self):
        client, calls = self.client_with({"groq:a": "server answer", "byok:openai:m": "user answer"})
        self.assertEqual(run(client.chat_completion("s", "u")), "server answer")
        self.assertEqual(calls, ["groq:a"])

    def test_server_exhausted_falls_back_to_user_key(self):
        client, calls = self.client_with(
            {"groq:a": HTTPException(429, "rate limited"), "byok:openai:m": "user answer"}
        )
        self.assertEqual(run(client.chat_completion("s", "u")), "user answer")
        self.assertEqual(calls, ["groq:a", "byok:openai:m"])

    def test_server_exhausted_without_user_key_is_tagged(self):
        client = LLMClient([server_target("a")], offer_byok=True)

        async def fail(*_):
            raise HTTPException(429, "rate limited")

        client._call = fail
        with self.assertRaises(HTTPException) as ctx:
            run(client.chat_completion("s", "u"))
        self.assertEqual(ai_error_code(ctx.exception), "server_exhausted")


class ByokErrorTests(unittest.TestCase):
    """Provider errors on a user's key are reported as being about their key."""

    def call_with_response(self, status, body):
        target = LLMTarget("openai", "https://api.test/v1/chat/completions", USER_KEY, "gpt-test", 5, byok=True)
        transport = httpx.MockTransport(lambda req: httpx.Response(status, json=body))
        real = httpx.AsyncClient

        with mock.patch.object(llm_module.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw)):
            with self.assertLogs("resumeforge.pipeline.llm_client", "ERROR") as logs:
                with self.assertRaises(HTTPException) as ctx:
                    run(LLMClient([target]).chat_completion("s", "u"))
        return ctx.exception, "\n".join(logs.output)

    def test_rejected_key(self):
        exc, logs = self.call_with_response(401, {"error": {"message": f"Incorrect API key provided: {USER_KEY}"}})
        self.assertEqual(exc.status_code, 401)
        self.assertEqual(ai_error_code(exc), "byok_invalid")
        self.assertIn("OpenAI", exc.detail)
        self.assertNotIn(USER_KEY, logs)
        self.assertIn("[redacted]", logs)

    def test_out_of_credit(self):
        exc, _ = self.call_with_response(429, {"error": {"message": "quota exceeded"}})
        self.assertEqual(ai_error_code(exc), "byok_exhausted")

    def test_unknown_model(self):
        exc, _ = self.call_with_response(404, {"error": {"message": "model not found"}})
        self.assertEqual(ai_error_code(exc), "byok_model")

    def test_retries_without_unsupported_temperature(self):
        target = LLMTarget("openai", "https://api.test/v1/chat/completions", USER_KEY, "reasoner", 5, byok=True)
        seen = []

        def handler(req):
            import json
            payload = json.loads(req.content)
            seen.append(payload)
            if "temperature" in payload:
                return httpx.Response(400, json={"error": {"message": "Unsupported value: 'temperature'"}})
            return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

        real = httpx.AsyncClient
        transport = httpx.MockTransport(handler)
        with mock.patch.object(llm_module.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw)):
            self.assertEqual(run(LLMClient([target]).chat_completion("s", "u")), "ok")
        self.assertEqual(len(seen), 2)
        self.assertNotIn("temperature", seen[1])


class EndpointTests(unittest.TestCase):
    def setUp(self):
        import main
        self.main = main
        self.client = TestClient(main.app)

    def test_business_ai_without_key_returns_byok_required(self):
        resp = self.client.post(
            "/api/business/requirements",
            json={"job_description": "We are hiring a backend engineer with Python and FastAPI experience to build APIs."},
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.headers.get(AI_ERROR_HEADER), "byok_required")

    def test_business_summary_without_key_returns_byok_required(self):
        resp = self.client.post(
            "/api/business/summary",
            json={
                "resume_text": "Jane Doe\nPython engineer.",
                "job_description": "Backend engineer with Python experience required.",
                "jd_requirements": {"target_title": "Backend Engineer", "required_skills": ["python"]},
            },
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.headers.get(AI_ERROR_HEADER), "byok_required")

    def test_cors_exposes_ai_error_and_retry_after(self):
        resp = self.client.post(
            "/api/business/requirements",
            json={"job_description": "x" * 60},
            headers={"Origin": "http://localhost:3000"},
        )
        exposed = resp.headers.get("access-control-expose-headers", "").lower()
        self.assertIn("x-ai-error", exposed)
        self.assertIn("retry-after", exposed)

    def test_key_check_requires_key(self):
        resp = self.client.post("/api/ai/key-check")
        self.assertEqual(resp.status_code, 400)


if __name__ == "__main__":
    unittest.main()
