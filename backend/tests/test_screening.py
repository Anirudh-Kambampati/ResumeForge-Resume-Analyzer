import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from main import app
from services.screening_service import (
    MAX_SUMMARY_CHARS,
    build_summary_prompt,
    clean_brief,
    clean_requirements,
    clean_summary,
    extract_candidate_identity,
    screen_resume,
)


RESUME = """Jane Doe
jane.doe@example.com | +1 555-123-4567 | San Francisco, CA
SUMMARY
Backend Engineer building APIs.
EXPERIENCE
Acme Corp — Backend Engineer
Jan 2021 - Present
• Designed REST APIs in Python with FastAPI and PostgreSQL.
• Deployed services with Docker.
SKILLS
Python, FastAPI, PostgreSQL, Docker
"""

REQUIREMENTS = {
    "target_title": "Backend Engineer",
    "required_skills": ["python", "fastapi", "kubernetes"],
    "preferred_skills": ["docker"],
    "domain_keywords": ["backend", "api"],
    "responsibilities": ["design REST APIs"],
}


class ScreeningServiceTests(unittest.TestCase):
    def test_screen_is_deterministic(self):
        runs = [screen_resume(RESUME, REQUIREMENTS) for _ in range(3)]
        self.assertTrue(all(r == runs[0] for r in runs))

    def test_screen_reports_matched_and_missing_required_skills(self):
        result = screen_resume(RESUME, REQUIREMENTS)
        self.assertEqual(result["required_skills"]["missing"], ["kubernetes"])
        self.assertIn("python", result["required_skills"]["matched"])
        self.assertEqual(result["preferred_skills"]["matched"], ["docker"])
        self.assertEqual(sum(c["max_score"] for c in result["categories"]), 100)
        self.assertEqual(sum(c["score"] for c in result["categories"]), result["match_score"])

    def test_stronger_resume_ranks_higher(self):
        weaker = "John Smith\njohn@example.com\nEXPERIENCE\nRetail Associate\n• Helped customers."
        self.assertGreater(
            screen_resume(RESUME, REQUIREMENTS)["match_score"],
            screen_resume(weaker, REQUIREMENTS)["match_score"],
        )

    def test_identity_extraction(self):
        self.assertEqual(
            extract_candidate_identity(RESUME), {"name": "Jane Doe", "email": "jane.doe@example.com"}
        )
        self.assertEqual(extract_candidate_identity("JANE DOE\nSKILLS\nPython")["name"], "Jane Doe")
        self.assertIsNone(extract_candidate_identity("jane@example.com\nSKILLS\nPython")["name"])

    def test_clean_requirements_normalises_model_output(self):
        cleaned = clean_requirements(
            {"jd_requirements": {"target_title": "SWE", "required_skills": ["Python", "python", "", 5, None], "responsibilities": "x"}}
        )
        self.assertEqual(cleaned["required_skills"], ["python", "5"])
        self.assertEqual(cleaned["responsibilities"], [])
        self.assertEqual(cleaned["preferred_skills"], [])

    def test_clean_summary_normalises_and_caps(self):
        self.assertEqual(clean_summary({"summary": " Strong Python backend fit. "})["summary"], "Strong Python backend fit.")
        capped = clean_summary({"summary": "x" * 900, "strengths": ["ignored"]})["summary"]
        self.assertEqual(len(capped), MAX_SUMMARY_CHARS + 1)  # truncated + ellipsis
        self.assertEqual(clean_summary({"summary": 42})["summary"], "")
        self.assertEqual(clean_summary({"strengths": []})["summary"], "")

    def test_summary_prompt_carries_role_context(self):
        prompt = build_summary_prompt(RESUME, "Backend Engineer", REQUIREMENTS, 78, ["kubernetes"])
        self.assertIn("Deterministic match score: 78/100", prompt)
        self.assertIn("kubernetes", prompt)
        self.assertIn("Backend Engineer", prompt)
        self.assertIn("Jane Doe", prompt)

    def test_clean_brief_caps_lists(self):
        brief = clean_brief({"summary": " ok ", "strengths": ["a"] * 9, "gaps": "no", "interview_questions": [1, "q"]})
        self.assertEqual(brief["summary"], "ok")
        self.assertEqual(len(brief["strengths"]), 5)
        self.assertEqual(brief["gaps"], [])
        self.assertEqual(brief["interview_questions"], ["q"])


class ScreenEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_rejects_invalid_requirements(self):
        resp = self.client.post(
            "/api/business/screen",
            data={"jd_requirements": "not json"},
            files={"resume": ("cv.pdf", b"%PDF", "application/pdf")},
        )
        self.assertEqual(resp.status_code, 400)

    def test_rejects_unsupported_file(self):
        resp = self.client.post(
            "/api/business/screen",
            data={"jd_requirements": json.dumps(REQUIREMENTS)},
            files={"resume": ("cv.txt", b"hello", "text/plain")},
        )
        self.assertEqual(resp.status_code, 400)

    def test_requirements_rejects_short_job_description(self):
        resp = self.client.post("/api/business/requirements", json={"job_description": "too short"})
        self.assertEqual(resp.status_code, 422)

    def test_summary_rejects_empty_payload(self):
        resp = self.client.post("/api/business/summary", json={})
        self.assertEqual(resp.status_code, 422)


class SummaryEndpointTests(unittest.TestCase):
    """The summary endpoint cleans whatever the model returns."""

    SUMMARY_BODY = {
        "resume_text": RESUME,
        "job_description": "Backend Engineer with Python and FastAPI experience required.",
        "jd_requirements": REQUIREMENTS,
        "match_score": 78,
        "missing_keywords": ["kubernetes"],
    }

    def setUp(self):
        import main

        self.main = main
        self.client = TestClient(main.app)

    def _post_with(self, model_output):
        class FakeLLM:
            async def chat_completion(self, system_prompt, user_prompt, **kwargs):
                return model_output

        with mock.patch.object(self.main, "resolve_llm_client", return_value=FakeLLM()):
            return self.client.post("/api/business/summary", json=self.SUMMARY_BODY)

    def test_returns_cleaned_summary(self):
        resp = self._post_with(json.dumps({"summary": "  Strong Python backend fit; lacks Kubernetes.  "}))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["summary"], "Strong Python backend fit; lacks Kubernetes.")

    def test_empty_summary_is_502(self):
        resp = self._post_with(json.dumps({"summary": "   "}))
        self.assertEqual(resp.status_code, 502)


if __name__ == "__main__":
    unittest.main()
