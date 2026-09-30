"""DOCX text extraction — mirrors the PDF extractor's contract.

Responsibility:
  - Accept raw .docx bytes
  - Extract text in document order (paragraphs + tables)
  - Extract embedded hyperlinks so the LLM sees link targets
    (same shape as extract_pdf_hyperlinks output)
  - Preserve bullet/list structure as "• " prefixed lines so the
    downstream pipeline treats them like PDF bullet lines
  - Surface page/character counts and quality signals
  - NEVER touches LLM, validation, or builder concerns

Design notes:
  - Uses python-docx for paragraph/table/hyperlink access.
  - Hyperlinks live in w:hyperlink elements; python-docx (as of 1.x)
    does not expose them on Paragraph.text, so they are read from the
    underlying XML and re-attached to the plain text line as
    "[label](url)" plus collected into an embedded_links list.
  - Images / text boxes (w:txbxContent) are ignored — text boxes are a
    known ATS hazard and rarely appear in well-formed resumes.
"""

import io
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from docx import Document as DocxDocument
from docx.oxml.ns import qn

logger = logging.getLogger("resumeforge.pipeline.docx_extractor")

# Namespaces for raw hyperlink scraping
_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

MAX_DOCX_BYTES = 10 * 1024 * 1024

# Relationship types that resolve to external URLs (vs. bookmarks,
# headings, email anchors handled separately)
_EXTERNAL_LINK_REL = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
)


@dataclass
class DocxExtractionResult:
    """Result of DOCX extraction.

    Mirrors the fields of extractor.ExtractionResult that downstream
    consumers actually use, so endpoints can handle either uniformly.
    """

    text: str
    page_count: int
    char_count: int
    quality_flags: Dict[str, bool] = field(default_factory=dict)
    embedded_links: List[Dict[str, Any]] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not self.text.strip()

    def has_corruption_warning(self) -> bool:
        return self.quality_flags.get("has_replacement_chars", False) or (
            self.quality_flags.get("high_control_char_ratio", False)
        )


def _iter_block_items(parent: Any) -> List[Any]:
    """Yield paragraphs and tables of a document body in document order.

    python-docx does not provide a public mixed iterator; the standard
    approach is walking the body XML for w:p and w:tbl in sequence.
    """
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    body = parent.element.body
    blocks: List[Any] = []
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            blocks.append(Paragraph(child, parent))
        elif child.tag == qn("w:t(tbl)") or child.tag == qn("w:tbl"):
            blocks.append(Table(child, parent))
    return blocks


def _paragraph_hyperlinks(paragraph: Any, rels: Any) -> List[Tuple[str, str]]:
    """Extract (text, url) hyperlink pairs from a paragraph's runs.

    Returns pairs where text is the visible link text and url the target.
    """
    links: List[Tuple[str, str]] = []
    try:
        for hyperlink in paragraph._element.iter(qn("w:hyperlink")):
            rel_id = hyperlink.get(qn("r:id"))
            if not rel_id:
                continue
            try:
                rel = rels[rel_id]
            except KeyError:
                continue
            if rel.reltype != _EXTERNAL_LINK_REL:
                continue
            url = rel.target_ref
            if not url or not isinstance(url, str):
                continue
            link_text = "".join(
                node.text or ""
                for node in hyperlink.iter(qn("w:t"))
            ).strip()
            links.append((link_text, url.strip()))
    except Exception:
        pass
    return links


def _format_paragraph_text(paragraph: Any, rels: Any) -> Tuple[str, List[Tuple[str, str]]]:
    """Render one paragraph as a text line, preserving list bullets and links."""
    links = _paragraph_hyperlinks(paragraph, rels)
    text = paragraph.text.strip()

    # Word list bullets/styles — render as standard bullet lines so the
    # downstream bullet classifier recognizes them.
    style_name = ""
    try:
        if paragraph.style and paragraph.style.name:
            style_name = paragraph.style.name.lower()
    except Exception:
        pass
    is_list = ("list" in style_name and "paragraph" not in style_name) or bool(
        paragraph._element.find(qn("w:pPr") + "/" + qn("w:numPr"))
        if paragraph._element.find(qn("w:pPr")) is not None
        else False
    )
    num_pr = paragraph._element.find(qn("w:pPr"))
    has_num = False
    if num_pr is not None:
        has_num = num_pr.find(qn("w:numPr")) is not None

    if (is_list or has_num) and text and not text.startswith(("•", "-", "●")):
        text = f"• {text}"

    # Append hyperlinks not already visible in the text (common when
    # the visible label is "LinkedIn" but the URL is the real target).
    for link_text, url in links:
        if url and url not in text:
            if link_text and link_text in text:
                text = text.replace(link_text, f"{link_text} ({url})")
            else:
                text = f"{text} [{url}]".strip()

    return text, links


def _table_text(table: Any, rels: Any) -> Tuple[str, List[Tuple[str, str]]]:
    """Render a table as lines of pipe-joined cells (resumes often use tables)."""
    lines: List[str] = []
    links: List[Tuple[str, str]] = []
    try:
        for row in table.rows:
            cells: List[str] = []
            for cell in row.cells:
                cell_parts: List[str] = []
                for p in cell.paragraphs:
                    rendered, p_links = _format_paragraph_text(p, rels)
                    if rendered:
                        cell_parts.append(rendered)
                        links.extend(p_links)
                if cell_parts:
                    cells.append(" / ".join(cell_parts))
            if cells:
                lines.append(" | ".join(cells))
    except Exception:
        pass
    return "\n".join(lines), links


def extract_docx_hyperlinks(
    doc: Any,
) -> List[Dict[str, Any]]:
    """Collect all external hyperlinks in document order, deduplicated."""
    hyperlinks: List[Dict[str, Any]] = []
    seen: set = set()
    rels = doc.part.rels
    try:
        for hyperlink in doc.element.body.iter(qn("w:hyperlink")):
            rel_id = hyperlink.get(qn("r:id"))
            if not rel_id:
                continue
            try:
                rel = rels[rel_id]
            except KeyError:
                continue
            if rel.reltype != _EXTERNAL_LINK_REL:
                continue
            url = rel.target_ref
            if not url or not isinstance(url, str) or url in seen:
                continue
            seen.add(url)
            hyperlinks.append({"url": url.strip(), "page": 0})
    except Exception:
        pass
    return hyperlinks


def extract_text_from_docx(
    docx_bytes: bytes,
    filename: str = "unknown.docx",
    max_size_bytes: int = MAX_DOCX_BYTES,
) -> DocxExtractionResult:
    """Extract text from raw .docx bytes with structure preservation.

    Args:
        docx_bytes: Raw file content.
        filename: Original filename for logging context.
        max_size_bytes: Reject files larger than this size.

    Returns:
        DocxExtractionResult with flat text and embedded links.

    Raises:
        ValueError: If the file is corrupt, oversized, or not a valid .docx.
    """
    stage_start = time.perf_counter()
    logger.info(
        "[EXTRACT-DOCX] Starting extraction | file=%s | size_bytes=%d",
        filename,
        len(docx_bytes),
    )

    if not docx_bytes:
        raise ValueError("DOCX file is empty — no content to process.")

    if len(docx_bytes) > max_size_bytes:
        raise ValueError(
            f"DOCX file exceeds maximum size of {max_size_bytes // (1024 * 1024)}MB "
            f"(got {len(docx_bytes)} bytes)."
        )

    # Zip validity check — python-docx raises opaque errors otherwise
    if not docx_bytes.startswith(b"PK"):
        raise ValueError(
            "Failed to parse DOCX document. Ensure the file is a valid "
            ".docx (not a legacy .doc) and is not corrupt."
        )

    try:
        doc = DocxDocument(io.BytesIO(docx_bytes))
    except Exception as exc:
        logger.error(
            "[EXTRACT-DOCX] FAILED — python-docx could not open file | file=%s | error=%s",
            filename,
            str(exc),
        )
        raise ValueError(
            "Failed to parse DOCX document. Ensure it is a valid .docx file "
            "and is not corrupt or password protected."
        ) from exc

    rels = doc.part.rels
    all_links: List[Tuple[str, str]] = []
    text_parts: List[str] = []

    for block in _iter_block_items(doc):
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        if isinstance(block, Paragraph):
            rendered, links = _format_paragraph_text(block, rels)
            if rendered:
                text_parts.append(rendered)
                all_links.extend(links)
        elif isinstance(block, Table):
            rendered, links = _table_text(block, rels)
            if rendered:
                text_parts.append(rendered)
                all_links.extend(links)

    flat_text = "\n".join(text_parts).strip()
    char_count = len(flat_text)

    # Embedded hyperlinks (unique, in document order)
    embedded_links = extract_docx_hyperlinks(doc)

    # Quality checks — same signals as the PDF extractor
    replacement_count = flat_text.count("\ufffd")
    control_chars = sum(
        1 for c in flat_text if ord(c) < 32 and c not in "\n\t\r"
    )
    control_ratio = control_chars / max(1, char_count)
    word_count = len(
        [w for w in flat_text.split() if any(c.isalpha() for c in w)]
    )

    quality_flags = {
        "has_replacement_chars": replacement_count > char_count * 0.05,
        "high_control_char_ratio": control_ratio > 0.05,
        "low_word_count": word_count < 20 and char_count > 100,
    }

    elapsed = time.perf_counter() - stage_start

    if not flat_text:
        logger.warning(
            "[EXTRACT-DOCX] Zero text extracted | file=%s | elapsed=%.2fs",
            filename,
            elapsed,
        )
        return DocxExtractionResult(
            text="",
            page_count=0,
            char_count=0,
            quality_flags=quality_flags,
            embedded_links=embedded_links,
        )

    logger.info(
        "[EXTRACT-DOCX] Completed | file=%s | chars=%d | links=%d | words=%d | "
        "corruption_flags=%s | elapsed=%.2fs",
        filename,
        char_count,
        len(embedded_links),
        word_count,
        quality_flags,
        elapsed,
    )

    return DocxExtractionResult(
        text=flat_text,
        # .docx has no pagination — report the "page" as 1 so downstream
        # logging stays uniform with the PDF extractor.
        page_count=1,
        char_count=char_count,
        quality_flags=quality_flags,
        embedded_links=embedded_links,
    )


# Compile-time sanity: the regex module is used by tests importing helpers
_ = re
