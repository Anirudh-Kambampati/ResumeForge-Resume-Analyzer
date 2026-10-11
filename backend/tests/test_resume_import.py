"""Import: deterministic parser fixtures and the AI review guard."""
import asyncio
import copy
import os
import unittest

from fastapi import HTTPException
from fastapi.testclient import TestClient

from services.ats_service import postprocess_resume_data
from services.deterministic_parser import parse_resume_deterministic
from services.llm_client import AI_ERROR_HEADER
from services.resume_import import guard_reviewed, import_resume

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return f.read()


def parse(text, links=None):
    return postprocess_resume_data(parse_resume_deterministic(text, links or []))


class DeterministicParserTests(unittest.TestCase):
    def test_same_input_same_output(self):
        text = load("resume_us.txt")
        self.assertEqual(parse(text), parse(text))

    def test_us_resume(self):
        d = parse(load("resume_us.txt"))
        p = d["profile"]
        self.assertEqual(p["fullName"], "Jane Smith")
        self.assertEqual(p["titles"], ["Product Designer", "UX Researcher"])
        self.assertEqual(p["email"], "jane.smith@gmail.com")
        self.assertEqual(p["phone"], "(917) 555-0142")
        self.assertEqual(p["location"], "Brooklyn, NY")
        self.assertEqual({l["label"] for l in p["links"]}, {"LinkedIn", "Portfolio"})

        spotify, airbnb = d["experience"]
        self.assertEqual((spotify["company"], spotify["role"], spotify["location"]), ("Spotify", "Senior Product Designer", "New York, NY"))
        self.assertTrue(spotify["currentlyWorking"])
        self.assertEqual(spotify["startDate"], "Mar 2021")
        # wrapped bullet joined back together
        self.assertIn("across 30+ surfaces.", spotify["bullets"][1])
        self.assertEqual((airbnb["role"], airbnb["startDate"], airbnb["endDate"]), ("Product Designer", "Jun 2018", "Feb 2021"))

        habit, portfolio = d["projects"]
        self.assertEqual(habit["technologies"], ["Figma", "React Native"])
        self.assertEqual(portfolio["title"], "Portfolio Site")
        self.assertEqual(portfolio["technologies"], ["Next.js", "Tailwind"])
        self.assertIn("github.com/janesmith/portfolio", portfolio["link"])
        self.assertEqual(portfolio["bullets"], ["Personal portfolio."])

        edu = d["education"][0]
        self.assertEqual(edu["institution"], "Rhode Island School of Design")
        self.assertEqual((edu["degree"], edu["field"]), ("Bachelor of Fine Arts", "Graphic Design"))
        self.assertEqual(edu["grade"], "GPA: 3.8/4.0")

        self.assertEqual([c["title"] for c in d["skills"]], ["Design", "Research"])
        self.assertEqual(d["certifications"][1]["issuer"], "Scrum Alliance")
        self.assertEqual(d["achievements"][1], "Employee of the quarter, Q3 2021")
        self.assertEqual(d["languages"][0], {"name": "English", "proficiency": "Native"})

    def test_column_layout_resume(self):
        d = parse(load("resume_in.txt"))
        self.assertEqual(d["profile"]["phone"], "+91 98765 43210")
        exp = d["experience"][0]
        self.assertEqual((exp["company"], exp["role"], exp["location"]), ("Amazon", "Software Development Intern", "Bangalore"))
        iit, school = d["education"]
        self.assertEqual(iit["degree"], "B.Tech")
        self.assertEqual(iit["field"], "Computer Science and Engineering")
        self.assertEqual(iit["grade"], "CGPA: 8.7/10")  # not mistaken for a date
        self.assertEqual((iit["startDate"], iit["endDate"]), ("2020", "2024"))
        self.assertEqual(school["degree"], "Class XII (CBSE)")
        self.assertEqual(d["projects"][0]["title"], "ResumeForge")
        self.assertIn("JavaScript", d["skills"][0]["items"])  # not "Java Script"

    def test_docx_markdown_links(self):
        text = "Sam Lee\n[sam@x.dev](mailto:sam@x.dev) | [GitHub](https://github.com/samlee)\nPROJECTS\n[Tracker](https://github.com/samlee/tracker) | React\n• Built it."
        d = parse(text)
        self.assertEqual(d["profile"]["email"], "sam@x.dev")
        self.assertTrue(any(l["label"] == "GitHub" for l in d["profile"]["links"]))
        self.assertFalse(any("tracker" in l["url"] for l in d["profile"]["links"]))
        self.assertEqual(d["projects"][0]["title"], "Tracker")

    def test_embedded_project_link_matched_by_name(self):
        text = "Sam Lee\nPROJECTS\nHabit Tracker | React\n• Built it."
        d = parse(text, [{"url": "https://github.com/samlee/habit-tracker", "page": 0}])
        self.assertEqual(d["projects"][0]["link"], "https://github.com/samlee/habit-tracker")


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.text = load("resume_us.txt")
        self.draft = parse(self.text)

    def test_faithful_review_is_kept(self):
        reviewed = copy.deepcopy(self.draft)
        reviewed["experience"][1]["location"] = ""  # a harmless correction
        result, _ = guard_reviewed(reviewed, self.draft, self.text)
        self.assertIsNotNone(result)

    def test_invented_bullet_and_skill_are_removed(self):
        reviewed = copy.deepcopy(self.draft)
        reviewed["experience"][0]["bullets"].append("Grew revenue by 300% across EMEA markets.")
        reviewed["skills"][0]["items"].append("Kubernetes")
        result, note = guard_reviewed(reviewed, self.draft, self.text)
        self.assertNotIn("Grew revenue by 300% across EMEA markets.", result["experience"][0]["bullets"])
        self.assertNotIn("Kubernetes", result["skills"][0]["items"])
        self.assertIn("unsupported", note)

    def test_invented_link_is_removed(self):
        reviewed = copy.deepcopy(self.draft)
        reviewed["profile"]["links"].append({"label": "GitHub", "url": "https://github.com/janesmith-fake", "username": ""})
        result, _ = guard_reviewed(reviewed, self.draft, self.text)
        self.assertFalse(any("fake" in l["url"] for l in result["profile"]["links"]))

    def test_mostly_fabricated_review_is_rejected(self):
        reviewed = {"profile": {"fullName": "Someone Else", "email": "x@y.com"}, "skills": [{"title": "S", "items": ["Rust", "Go", "Haskell"]}]}
        result, _ = guard_reviewed(reviewed, self.draft, self.text)
        self.assertIsNone(result)

    def test_dropped_section_is_restored(self):
        reviewed = copy.deepcopy(self.draft)
        del reviewed["languages"]
        result, _ = guard_reviewed(reviewed, self.draft, self.text)
        self.assertEqual(result["languages"], self.draft["languages"])


class ImportPipelineTests(unittest.TestCase):
    def run_import(self, review=None, get_client=lambda: object()):
        async def default_review(text, client, draft):
            return copy.deepcopy(draft)

        return asyncio.run(import_resume(load("resume_us.txt"), [], get_client, review or default_review))

    def test_ai_review_applied(self):
        result = self.run_import()
        self.assertEqual(result["import_meta"]["ai_review"], "applied")
        self.assertEqual(result["profile"]["fullName"], "Jane Smith")

    def test_review_gets_the_draft(self):
        seen = {}

        async def review(text, client, draft):
            seen["draft"] = draft
            return copy.deepcopy(draft)

        self.run_import(review)
        self.assertEqual(seen["draft"]["profile"]["fullName"], "Jane Smith")

    def test_unavailable_ai_returns_draft_with_code(self):
        def no_client():
            raise HTTPException(503, "capacity used up", headers={AI_ERROR_HEADER: "server_exhausted"})

        result = self.run_import(get_client=no_client)
        self.assertEqual(result["import_meta"]["ai_review"], "skipped")
        self.assertEqual(result["import_meta"]["error_code"], "server_exhausted")
        self.assertEqual(result["experience"][0]["company"], "Spotify")

    def test_review_crash_returns_draft(self):
        async def broken(*_a, **_k):
            raise RuntimeError("boom")

        result = self.run_import(broken)
        self.assertEqual(result["import_meta"]["ai_review"], "skipped")
        self.assertTrue(result["experience"])


class ImportEndpointTests(unittest.TestCase):
    def test_import_works_without_ai(self):
        import main
        orig_extract, orig_resolve = main._extract_resume_text, main.resolve_llm_client
        main._extract_resume_text = lambda data, name: (load("resume_in.txt"), [], 1)

        def no_ai(*_):
            raise HTTPException(503, "capacity used up", headers={AI_ERROR_HEADER: "server_exhausted"})

        main.resolve_llm_client = no_ai
        try:
            resp = TestClient(main.app).post(
                "/api/ats/optimize", files={"resume": ("cv.pdf", b"%PDF-stub", "application/pdf")}
            )
        finally:
            main._extract_resume_text, main.resolve_llm_client = orig_extract, orig_resolve
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertEqual(data["import_meta"]["error_code"], "server_exhausted")
        self.assertEqual(data["profile"]["fullName"], "Rahul Verma")


if __name__ == "__main__":
    unittest.main()
