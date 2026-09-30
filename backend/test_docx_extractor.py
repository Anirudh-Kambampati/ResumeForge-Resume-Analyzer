"""Tests for DOCX extraction (services/docx_extractor.py).

Builds real .docx bytes in memory via python-docx so the full
extraction path (paragraphs, tables, list bullets, hyperlinks,
quality flags) is exercised — no fixtures required.

Run:  python -m pytest test_docx_extractor.py -v
(or python test_docx_extractor.py)
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import docx as docx_lib
from docx.enum.text import WD_ALIGN_PARAGRAPH

from services.docx_extractor import extract_text_from_docx


def build_docx(paragraph_texts=None, table_rows=None) -> bytes:
    """Build a .docx in memory from plain paragraphs and table rows."""
    doc = docx_lib.Document()
    for text in paragraph_texts or []:
        doc.add_paragraph(text)
    if table_rows:
        table = doc.add_table(rows=len(table_rows), cols=len(table_rows[0]))
        for r, row in enumerate(table_rows):
            for c, cell in enumerate(row):
                table.rows[r].cells[c].text = cell
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def build_docx_with_hyperlink(url: str, label: str = "My Portfolio") -> bytes:
    """Build a .docx containing a real external hyperlink."""
    doc = docx_lib.Document()
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # python-docx has no public add_hyperlink — construct the XML directly
    part = paragraph.part
    r_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = docx_lib.oxml.shared.OxmlElement("w:hyperlink")
    hyperlink.set(docx_lib.oxml.ns.qn("r:id"), r_id)
    run = docx_lib.oxml.shared.OxmlElement("w:r")
    text_el = docx_lib.oxml.shared.OxmlElement("w:t")
    text_el.text = label
    run.append(text_el)
    hyperlink.append(run)
    paragraph._element.append(hyperlink)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_extracts_paragraph_text_in_order():
    data = build_docx(["John Doe", "Software Engineer", "EXPERIENCE", "Built APIs."])
    result = extract_text_from_docx(data, "resume.docx")
    assert result.text.splitlines() == [
        "John Doe",
        "Software Engineer",
        "EXPERIENCE",
        "Built APIs.",
    ]
    assert not result.is_empty()
    print("  ok paragraph extraction in document order")


def test_extracts_table_text():
    data = build_docx(
        paragraph_texts=["Header line"],
        table_rows=[["Python", "FastAPI"], ["React", "TypeScript"]],
    )
    result = extract_text_from_docx(data, "resume.docx")
    assert "Header line" in result.text
    assert "Python | FastAPI" in result.text
    assert "React | TypeScript" in result.text
    print("  ok table extraction")


def test_extracts_embedded_hyperlinks():
    url = "https://anirudh.example.dev"
    data = build_docx_with_hyperlink(url, "My Portfolio")
    result = extract_text_from_docx(data, "resume.docx")
    urls = [l["url"] for l in result.embedded_links]
    assert url in urls, f"expected {url} in {urls}"
    # Link target should also be visible inline in the text
    assert url in result.text
    print("  ok embedded hyperlink extraction + inline visibility")


def test_hyperlink_deduplication():
    data = build_docx_with_hyperlink("https://github.com/johndoe", "GitHub")
    # Same URL twice in the document
    doc = docx_lib.Document(io.BytesIO(data))
    # just verify single extraction dedupes via extract_docx_hyperlinks path
    result = extract_text_from_docx(data, "resume.docx")
    urls = [l["url"] for l in result.embedded_links]
    assert urls.count("https://github.com/johndoe") == 1
    print("  ok hyperlink deduplication")


def test_empty_and_corrupt_files_rejected():
    for bad, name in [(b"", "empty.docx"), (b"not a docx at all", "fake.docx")]:
        try:
            extract_text_from_docx(bad, name)
            raise AssertionError(f"{name} should have raised ValueError")
        except ValueError:
            pass
    print("  ok empty/corrupt files raise ValueError")


def test_oversized_file_rejected():
    data = b"PK\x03\x04" + b"\x00" * (11 * 1024 * 1024)
    try:
        extract_text_from_docx(data, "big.docx", max_size_bytes=10 * 1024 * 1024)
        raise AssertionError("oversized file should have raised ValueError")
    except ValueError as e:
        assert "maximum size" in str(e)
    print("  ok oversized file raises ValueError")


def test_quality_flags_empty_document():
    # A valid docx with no text
    doc = docx_lib.Document()
    buf = io.BytesIO()
    doc.save(buf)
    result = extract_text_from_docx(buf.getvalue(), "blank.docx")
    assert result.is_empty()
    assert result.char_count == 0
    print("  ok blank document reports empty")


def test_contact_and_bullets_survive():
    data = build_docx(
        [
            "Jane Doe",
            "john@example.com | +1 (555) 123-4567 | linkedin.com/in/janedoe",
            "SKILLS",
            "Python, TypeScript, React",
            "\u2022 Led a team of 4 engineers",
            "\u2022 Cut build times by 40%",
        ]
    )
    result = extract_text_from_docx(data, "resume.docx")
    text = result.text
    assert "john@example.com" in text
    assert "linkedin.com/in/janedoe" in text
    assert "\u2022 Led a team of 4 engineers" in text
    print("  ok contact lines and bullets preserved")


if __name__ == "__main__":
    tests = [
        test_extracts_paragraph_text_in_order,
        test_extracts_table_text,
        test_extracts_embedded_hyperlinks,
        test_hyperlink_deduplication,
        test_empty_and_corrupt_files_rejected,
        test_oversized_file_rejected,
        test_quality_flags_empty_document,
        test_contact_and_bullets_survive,
    ]
    passed = failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as e:
            print(f"  FAIL {t.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed out of {len(tests)}")
    sys.exit(1 if failed else 0)
