"""Test the redesigned Contact Parseability scoring.

Validates that the metric measures FORMATTING quality, not field completeness.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from services.scoring_service import parse_resume, _contact_parseability


def score(header_text: str, full_text: str | None = None) -> dict:
    """Run contact parseability scoring on a header region, passing raw_text."""
    text = full_text or header_text + "\n\nEXPERIENCE\nSome experience.\nEDUCATION\nSome education.\nSKILLS\nPython"
    parsed = parse_resume(text)
    return _contact_parseability(parsed, raw_text=text)


def make_doc(header: str, body: str | None = None) -> str:
    """Build a full resume document with the given header lines."""
    body = body or "EXPERIENCE\nWorked on stuff.\nEDUCATION\nStudied stuff.\nSKILLS\nPython, JavaScript"
    return header + "\n\n" + body


def test_simple_perfect_format():
    """Phone | Email | LinkedIn with perfect formatting -> 10/10."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone | Email | LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] == 10, f"Expected 10, got {result['score']}: {result['reason']}"
    assert result["evidence"]["separator_used"] == "|"
    print(f"  ✓ Perfect format scored {result['score']}/10")


def test_extended_perfect_format():
    """Phone | Email | LinkedIn | GitHub | Portfolio with perfect formatting -> also 10/10."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone | Email | LinkedIn | GitHub | Portfolio")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] == 10, f"Expected 10, got {result['score']}: {result['reason']}"
    print(f"  ✓ Extended perfect format scored {result['score']}/10 (same as minimal)")


def test_mixed_separators():
    """Phone | Email * LinkedIn with mixed separators -> penalized."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone | Email \u2022 LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 8, f"Expected <=8 for mixed separators, got {result['score']}"
    assert 0 == result["evidence"]["formatting_consistency_score"]
    print(f"  \u2713 Mixed separators scored {result['score']}/10 (consistency=0)")


def test_double_spaces():
    """Phone  |  Email  |  LinkedIn with double spaces -> penalized."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone  |  Email  |  LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for double spaces, got {result['score']}"
    print(f"  \u2713 Double spaces scored {result['score']}/10")


def test_no_spaces_around_separator():
    """Phone|Email|LinkedIn with no spaces -> penalized spacing."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone|Email|LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for no spaces, got {result['score']}"
    print(f"  \u2713 No-spaces format scored {result['score']}/10")


def test_empty_fields_penalty():
    """Phone || Email | LinkedIn with empty field -> penalized."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone || Email | LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for empty fields, got {result['score']}"
    print(f"  \u2713 Empty fields scored {result['score']}/10")


def test_emoji_penalty():
    """Emoji in contact block -> penalized readability."""
    doc = make_doc("John Doe\nSoftware Engineer\n\U0001f4de Phone | \u2709\ufe0f Email | LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for emoji, got {result['score']}"
    print(f"  \u2713 Emoji scored {result['score']}/10")


def test_uppercase_email():
    """JOHN@EMAIL.COM -> penalized readability."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone | JOHN@EMAIL.COM | LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for uppercase email, got {result['score']}"
    print(f"  \u2713 Uppercase email scored {result['score']}/10")


def test_broken_email():
    """Email split across lines -> penalized extraction."""
    doc = make_doc(
        "John Doe\nSoftware Engineer\njohn@\ngmail.com | Phone",
        "john@\ngmail.com | Phone\n\nEXPERIENCE\n...\nEDUCATION\n...\nSKILLS\n..."
    )
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for broken email, got {result['score']}"
    print(f"  \u2713 Broken email scored {result['score']}/10")


def test_no_contact_block():
    """No contact info at all -> low score."""
    doc = make_doc("John Doe\nSoftware Engineer\n\n")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 6, f"Expected <=6 for no contact, got {result['score']}"
    print(f"  \u2713 No contact block scored {result['score']}/10")


def test_dot_separator():
    """Phone * Email * LinkedIn with consistent bullet separator -> 10/10."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone \u2022 Email \u2022 LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] == 10, f"Expected 10 for consistent bullet sep, got {result['score']}"
    print(f"  \u2713 Bullet separator scored {result['score']}/10")


def test_leading_trailing_separator():
    """| Phone | Email | LinkedIn | with leading/trailing sep -> penalized."""
    doc = make_doc("John Doe\nSoftware Engineer\n| Phone | Email | LinkedIn |")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] <= 9, f"Expected <=9 for leading sep, got {result['score']}"
    print(f"  \u2713 Leading/trailing separator scored {result['score']}/10")


def test_only_email_perfect():
    """Only Email: email@company.com with no separators -> should score high (9-10)."""
    doc = make_doc("John Doe\nSoftware Engineer\nemail@company.com")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    print(f"  \u2713 Single email scored {result['score']}/10")
    assert result["score"] >= 8, f"Expected >=8 for single well-formatted email, got {result['score']}"


def test_bullet_point_separator_consistency():
    """Phone * Email * LinkedIn -> consistent bullet separator = perfect."""
    doc = make_doc("John Doe\nSoftware Engineer\nPhone \u2022 Email \u2022 LinkedIn")
    parsed = parse_resume(doc)
    result = _contact_parseability(parsed, raw_text=doc)
    assert result["score"] == 10, f"Expected 10, got {result['score']}"
    print(f"  \u2713 Bullet separator consistency: {result['score']}/10")


# ============================================================
# Run all tests
# ============================================================
if __name__ == "__main__":
    tests = [
        test_simple_perfect_format,
        test_extended_perfect_format,
        test_mixed_separators,
        test_double_spaces,
        test_no_spaces_around_separator,
        test_empty_fields_penalty,
        test_emoji_penalty,
        test_uppercase_email,
        test_broken_email,
        test_no_contact_block,
        test_dot_separator,
        test_leading_trailing_separator,
        test_only_email_perfect,
        test_bullet_point_separator_consistency,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  \u2717 {test.__name__} FAILED: {e}")
            failed += 1

    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
    sys.exit(1 if failed > 0 else 0)
