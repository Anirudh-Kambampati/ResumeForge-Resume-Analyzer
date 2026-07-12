import unittest

from services.jd_service import calculate_job_match
from services.scoring_service import extract_bullets, parse_resume, score_resume


RESUME = """Jane Doe
jane@example.com | +1 555-123-4567 | San Francisco, CA | linkedin.com/in/jane
SUMMARY
Backend engineer.
PROJECTS
Resume Parser
\u2022 Built a FastAPI service using PostgreSQL.
\u2022
Implemented retrieval augmented generation with Python.
EDUCATION
University
Jan 2020 - May 2024
SKILLS
Languages: Python, JavaScript
Frameworks: Fast API, React.js
"""


class DeterministicScoringTests(unittest.TestCase):
    def test_result_is_identical_across_runs(self):
        results = [score_resume(RESUME) for _ in range(5)]
        self.assertTrue(all(result == results[0] for result in results))

    def test_fresher_projects_satisfies_section_pathway(self):
        result = score_resume(RESUME)
        self.assertGreater(result["breakdown"]["section_recognition"]["score"], 0)
        self.assertIn("projects", result["parsed_evidence"]["sections"])

    def test_missing_contact_lowers_contact_score(self):
        self.assertLess(score_resume("SKILLS\nPython")["breakdown"]["contact_parseability"]["score"], 10)

    def test_inconsistent_dates_are_reported(self):
        result = score_resume(RESUME + "\nEXPERIENCE\nJan 2024\n2023-08\nMarch '22\n04/2021")
        self.assertGreater(result["breakdown"]["date_consistency"]["evidence"]["inconsistent_date_count"], 0)

    def test_empty_extraction_scores_poorly(self):
        self.assertEqual(score_resume("")["breakdown"]["machine_readability"]["score"], 0)

    def test_bullet_collection_handles_isolated_glyph_and_wrapping(self):
        parsed = parse_resume("PROJECTS\n\u2022\nBuilt a parser\nusing FastAPI.\n\u2022 Developed tests.")
        bullets = extract_bullets(parsed["sections"])["projects"]
        self.assertEqual(bullets, ["Built a parser using FastAPI.", "Developed tests."])

    def test_job_match_is_identical_across_runs(self):
        requirements = {"target_title": "Backend Engineer", "required_skills": ["python", "fastapi"], "preferred_skills": [], "domain_keywords": ["rag"], "responsibilities": ["build APIs"]}
        results = [calculate_job_match(RESUME, requirements) for _ in range(5)]
        self.assertTrue(all(result == results[0] for result in results))

