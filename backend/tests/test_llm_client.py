"""Tests for the free-model fallback chain in LLMClient (no network)."""
import asyncio
import os
import unittest
from unittest import mock

import httpx
from fastapi import HTTPException

from services.llm_client import GROQ_URL, OPENROUTER_URL, LLMClient


def build(env: dict, api_key=None, model=None):
    with mock.patch.dict(os.environ, env, clear=False):
        for name in ("GROQ_API_KEY", "GROQ_MODELS"):
            if name not in env:
                os.environ.pop(name, None)
        return LLMClient.from_env(api_key, model)


class ChainConfigTests(unittest.TestCase):
    def test_groq_models_come_first_then_free_openrouter(self):
        client = build({"GROQ_API_KEY": "gk", "GROQ_MODELS": "a,b"}, "ok", "x/y:free")
        self.assertEqual(client.model_chain, ["groq:a", "groq:b", "openrouter:x/y:free"])

    def test_paid_openrouter_model_is_ignored(self):
        client = build({"GROQ_API_KEY": "gk", "GROQ_MODELS": "a"}, "ok", "openai/gpt-4o")
        self.assertEqual(client.model_chain, ["groq:a"])

    def test_openrouter_free_router_is_allowed(self):
        client = build({}, "ok", "openrouter/free")
        self.assertEqual(client.model_chain, ["openrouter:openrouter/free"])

    def test_nothing_configured_returns_none(self):
        self.assertIsNone(build({}, None, None))
        self.assertIsNone(build({}, "ok", "openai/gpt-4o"))  # only a paid model


class FallbackTests(unittest.TestCase):
    def setUp(self):
        self.client = build({"GROQ_API_KEY": "gk", "GROQ_MODELS": "openai/gpt-oss-20b,qwen/qwen3.8-27b"},
                            "ok", "x/y:free")
        self.requests = []

    def run_with(self, responder, prompt="Return JSON."):
        def handler(request: httpx.Request) -> httpx.Response:
            import json
            body = json.loads(request.content)
            self.requests.append((str(request.url), body))
            return responder(str(request.url), body)

        transport = httpx.MockTransport(handler)
        real = httpx.AsyncClient
        with mock.patch("services.llm_client.httpx.AsyncClient",
                        lambda **kw: real(transport=transport, **kw)):
            return asyncio.run(self.client.chat_completion("system", prompt))

    @staticmethod
    def ok(content):
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}], "usage": {}})

    def test_first_model_success_uses_speed_options_and_json_mode(self):
        result = self.run_with(lambda url, body: self.ok('{"a": 1}'))
        self.assertEqual(result, '{"a": 1}')
        url, body = self.requests[0]
        self.assertEqual(url, GROQ_URL)
        self.assertEqual(body["model"], "openai/gpt-oss-20b")
        self.assertEqual(body["reasoning_effort"], "low")
        self.assertEqual(body["response_format"], {"type": "json_object"})
        self.assertEqual(len(self.requests), 1)

    def test_no_json_mode_when_prompt_does_not_ask_for_json(self):
        self.run_with(lambda url, body: self.ok("plain"), prompt="Rewrite this.")
        self.assertNotIn("response_format", self.requests[0][1])

    def test_rate_limit_falls_through_to_next_models(self):
        def responder(url, body):
            if url == GROQ_URL:
                return httpx.Response(429, json={"error": {"message": "rate limit"}})
            return self.ok("from openrouter")

        self.assertEqual(self.run_with(responder), "from openrouter")
        self.assertEqual(
            [(u, b["model"]) for u, b in self.requests],
            [(GROQ_URL, "openai/gpt-oss-20b"), (GROQ_URL, "qwen/qwen3.8-27b"), (OPENROUTER_URL, "x/y:free")],
        )
        self.assertEqual(self.requests[1][1]["reasoning_effort"], "none")
        self.assertNotIn("response_format", self.requests[2][1])  # Groq-only option

    def test_empty_content_falls_through(self):
        answers = iter([self.ok(""), self.ok("second")])
        self.assertEqual(self.run_with(lambda url, body: next(answers)), "second")

    def test_all_failing_raises_last_error(self):
        with self.assertRaises(HTTPException) as ctx:
            self.run_with(lambda url, body: httpx.Response(503, json={"error": {"message": "down"}}))
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(len(self.requests), 3)


if __name__ == "__main__":
    unittest.main()
