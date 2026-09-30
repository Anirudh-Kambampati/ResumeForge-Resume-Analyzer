"""Tests for analyzer accuracy: rewrite evidence, AI-failure fallback, job-match strictness."""
import json
import os
import unittest

from fastapi import HTTPException
from fastapi.testclient import TestClient

from services.bullet_evidence import is_safe_rewrite, original_in_resume
from services.jd_service import calculate_job_match

RESUME_TEXT = """John Doe
Software Engineer
john@email.com | github.com/johndoe
Experience
Software Engineer Jan 2023 - Present
Google, Mountain View, CA
• Reduced reporting latency by 42% for internal
dashboards used by analysts.
• Built internal tools with Python and Kafka.
Projects
• Designed scalable REST APIs for the billing service.
"""


class RewriteEvidenceTests(unittest.TestCase):
    def test_wrapped_bullet_is_found(self):
        original = "Reduced reporting latency by 42% for internal dashboards used by analysts."
        self.assertTrue(original_in_resume(original, RESUME_TEXT))

    def test_dash_and_whitespace_differences_are_tolerated(self):
        self.assertTrue(original_in_resume("Software Engineer  Jan 2023 – Present", RESUME_TEXT))

    def test_short_fragment_is_not_evidence(self):
        self.assertFalse(original_in_resume("Python", RESUME_TEXT))

    def test_missing_original_is_rejected(self):
        self.assertFalse(is_safe_rewrite("Led a team of engineers.", "Led a team.", RESUME_TEXT))

    def test_rewrite_cannot_borrow_number_from_another_bullet(self):
        original = "Built internal tools with Python and Kafka."
        improved = "Built internal Python and Kafka tools, cutting latency by 42%."
        self.assertFalse(is_safe_rewrite(original, improved, RESUME_TEXT))

    def test_rewrite_cannot_borrow_technology_from_another_bullet(self):
        # The claim gate only knows technologies in SKILL_ALIASES (React is one;
        # Python is not), so borrowing is tested with a recognized technology.
        resume = RESUME_TEXT + "• Built dashboards in React.\n"
        original = "Reduced reporting latency by 42% for internal dashboards used by analysts."
        improved = "Reduced reporting latency by 42% for React dashboards used by analysts."
        self.assertFalse(is_safe_rewrite(original, improved, resume))

    def test_faithful_rewrite_is_accepted(self):
        original = "Built internal tools with Python and Kafka."
        improved = "Developed internal tooling using Python and Kafka."
        self.assertTrue(is_safe_rewrite(original, improved, RESUME_TEXT))


class JobMatchStrictnessTests(unittest.TestCase):
    def match(self, **requirements):
        base = {"target_title": "", "required_skills": [], "preferred_skills": [],
                "domain_keywords": [], "responsibilities": []}
        return calculate_job_match(RESUME_TEXT, {**base, **requirements})["breakdown"]

    def test_single_shared_word_does_not_match_responsibility(self):
        evidence = self.match(responsibilities=["design distributed data pipelines"])[
            "responsibility_alignment"]["evidence"]
        self.assertEqual(evidence["matched_responsibilities"], [])

    def test_most_key_words_match_responsibility_with_inflections(self):
        evidence = self.match(responsibilities=["design scalable APIs"])[
            "responsibility_alignment"]["evidence"]
        self.assertEqual(evidence["matched_responsibilities"], ["design scalable apis"])

    def test_short_title_word_does_not_match_inside_other_words(self):
        # "ai" must not match inside "email"
        breakdown = self.match(target_title="AI Researcher")
        self.assertEqual(breakdown["job_title_alignment"]["evidence"]["title_match_type"], "none")

    def test_title_with_half_the_words_is_related(self):
        breakdown = self.match(target_title="AI Engineer")
        self.assertEqual(breakdown["job_title_alignment"]["evidence"]["title_match_type"], "related")


class AnalyzeFallbackTests(unittest.TestCase):
    """/api/analyze returns rule-based results when the AI review fails."""

    @classmethod
    def setUpClass(cls):
        os.environ["OPENROUTER_API_KEY"] = "test-key"
        import main
        cls.main = main
        cls._orig_from_env = main.LLMClient.from_env
        cls._orig_extract = main._extract_resume_text
        main._extract_resume_text = lambda data, name: (RESUME_TEXT, [], 1)
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.main.LLMClient.from_env = cls._orig_from_env
        cls.main._extract_resume_text = cls._orig_extract

    def analyze(self, fake_llm, **form):
        self.main.LLMClient.from_env = staticmethod(lambda *a, **k: fake_llm)
        response = self.client.post(
            "/api/analyze",
            files={"resume": ("resume.pdf", b"%PDF-stub", "application/pdf")},
            data=form,
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_provider_error_degrades_to_rule_based_results(self):
        class Failing:
            async def chat_completion(self, *_):
                raise HTTPException(status_code=504, detail="The AI provider timed out.")

        data = self.analyze(Failing(), job_description="Design scalable APIs in Python.")
        self.assertFalse(data["ai_review_available"])
        self.assertEqual(data["ai_review_error"], "The AI provider timed out.")
        self.assertIsNone(data["scores"]["ai_review_score"])
        self.assertIsNone(data["scores"]["job_match_score"])
        self.assertGreater(data["scores"]["deterministic_rule_score"], 0)
        self.assertTrue(data["rule_breakdown"])
        self.assertEqual(data["improved_bullets"], [])

    def test_unparseable_output_after_repair_degrades(self):
        class Garbage:
            async def chat_completion(self, *_):
                return "not json at all"

        data = self.analyze(Garbage())
        self.assertFalse(data["ai_review_available"])
        self.assertIsNone(data["scores"]["ai_review_score"])

    def test_non_numeric_score_degrades_instead_of_500(self):
        class OddScore:
            async def chat_completion(self, *_):
                return json.dumps({"ai_review_score": "great", "summary": "ok"})

        data = self.analyze(OddScore())
        self.assertFalse(data["ai_review_available"])
        self.assertIsNone(data["scores"]["ai_review_score"])

    def test_successful_review_filters_unsafe_rewrites(self):
        class Good:
            async def chat_completion(self, *_):
                return json.dumps({
                    "ai_review_score": 81.6,
                    "summary": "Strong resume.",
                    "improved_bullets": [
                        {"original": "Built internal tools with Python and Kafka.",
                         "improved": "Developed internal tooling using Python and Kafka."},
                        {"original": "Built internal tools with Python and Kafka.",
                         "improved": "Built Python and Kafka tools, cutting latency by 42%."},
                        {"original": "Invented bullet not in the resume.", "improved": "x"},
                    ],
                })

        data = self.analyze(Good())
        self.assertTrue(data["ai_review_available"])
        self.assertIsNone(data["ai_review_error"])
        self.assertEqual(data["scores"]["ai_review_score"], 82)
        self.assertEqual(
            [b["improved"] for b in data["improved_bullets"]],
            ["Developed internal tooling using Python and Kafka."],
        )


if __name__ == "__main__":
    unittest.main()
