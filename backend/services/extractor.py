"""Stage 1: Text Extraction from PDF resumes — structure-preserving, fast.

Responsibility:
  - Accept raw PDF bytes
  - Extract text via pypdf (layout mode for structure preservation)
  - Detect section boundaries during line-scanning, so headings never
    merge with their content text
  - Cluster content into logical groups (header, section→content pairs)
  - Surface extraction quality signals (page count, character count, corruption)
  - NEVER touches LLM, validation, or builder concerns
  - FAST: single-pass paginated extraction, no heavy post-processing

Performance characteristics:
  - Single extract_text() call per page (layout mode), then derive
    clean flat text from it — no double extraction
  - Section detection is O(n) regex scan on extracted lines
  - No additional dependencies beyond pypdf

Stage-level logging:
  - Logs entry with file name / byte size
  - Logs exit with extracted char count and quality indicators
  - Logs warnings on low-quality extraction (empty, garbled, scanned)
"""

import io
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import pypdf

from services.scoring_service import SECTION_ALIASES as SCORING_SECTION_ALIASES

# ============================================================
# PDF hyperlink extraction
#
# Extracts embedded clickable links (annotations) from each page
# so the LLM can associate them with the correct project entries.
# ============================================================


def extract_pdf_hyperlinks(reader: pypdf.PdfReader) -> List[Dict[str, Any]]:
    """Extract hyperlinks from PDF page annotations.

    Iterates each page's /Annots entries, finds Link annotations,
    and extracts the URI and rectangle position.

    Returns:
        List of dicts with keys 'url' (str) and 'page' (int).
        Deduplicated by URL per page.
    """
    hyperlinks: List[Dict[str, Any]] = []
    seen: set = set()

    for page_num, page in enumerate(reader.pages):
        if "/Annots" not in page:
            continue

        try:
            annotations = page["/Annots"]
            for annot_ref in annotations:
                try:
                    annot = annot_ref.get_object()
                    if not isinstance(annot, dict):
                        continue
                    if annot.get("/Subtype") != "/Link":
                        continue
                    action = annot.get("/A")
                    if not isinstance(action, dict):
                        continue
                    uri = action.get("/URI", "")
                    if not uri or not isinstance(uri, str):
                        continue

                    dedup_key = f"{page_num}:{uri}"
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)

                    hyperlinks.append({
                        "url": uri.strip(),
                        "page": page_num,
                    })
                except Exception:
                    continue
        except Exception:
            continue

    return hyperlinks

logger = logging.getLogger("resumeforge.pipeline.extractor")

# ============================================================
# Section heading detection
#
# Shares alias definitions with scoring_service so that adding
# a new section name in one place automatically benefits both.
# The _heading_key logic mirrors scoring_service._heading_key
# (same three matching strategies) so they behave identically.
# ============================================================


def _detect_section_heading(line: str) -> Optional[str]:
    """Detect if a line is a resume section heading.

    Returns the canonical section name (e.g. 'experience', 'skills')
    or None if the line is not a recognized heading.

    Uses multiple strategies in order of specificity to handle
    PDF extraction artifacts (letter-spaced chars, extra spaces, etc.).
    """
    clean = re.sub(r"[^a-z ]", "", line.lower()).strip()
    if not clean:
        return None

    # Strategy 1 — exact match (normal resume text)
    for key, aliases in SCORING_SECTION_ALIASES.items():
        if clean in aliases:
            return key

    # Strategy 2 — reconstruct multi-word headings from letter-spaced chars
    if "  " in clean:
        words = [w.replace(" ", "") for w in clean.split("  ") if w.strip()]
        if len(words) > 1:
            reconstructed = " ".join(words)
            for key, aliases in SCORING_SECTION_ALIASES.items():
                if reconstructed in aliases:
                    return key

    # Strategy 3 — collapse spaces for single-word headings with artifacts
    collapsed = clean.replace(" ", "")
    for key, aliases in SCORING_SECTION_ALIASES.items():
        if collapsed in aliases:
            return key

    return None


# ============================================================
# Structured data types
# ============================================================


@dataclass
class TextBlock:
    """A contiguous block of text at a page position.

    Blocks are formed by grouping consecutive non-blank lines.
    A block may be a section heading, a bullet list, a paragraph, etc.
    """
    text: str
    page_num: int
    line_start: int = 0      # line index within the page's raw lines
    line_end: int = 0        # exclusive
    is_heading: bool = False
    section_name: Optional[str] = None
    block_type: str = "text"  # "heading", "bullet", "paragraph", "contact"

    @property
    def first_line(self) -> str:
        return self.text.split("\n")[0] if self.text else ""


@dataclass
class PageContent:
    """Content extracted from a single page, broken into text blocks."""
    page_num: int
    raw_text: str
    lines: List[str] = field(default_factory=list)
    blocks: List[TextBlock] = field(default_factory=list)


@dataclass
class SectionCluster:
    """A recognized section with its heading and content blocks.

    E.g. section_name="experience" with heading "EXPERIENCE"
    and all the job entries that follow until the next heading.
    """
    section_name: str
    heading_text: str
    content_text: str
    blocks: List[TextBlock] = field(default_factory=list)


# ============================================================
# Block classification helpers
# ============================================================

# Bullet point markers (including PDF-encoded variants)
_BULLET_RE = re.compile(r"^\s*[•●▪◦*\-–—›»·♦→✓✔✗✘✦✧⬩▸▹►▪▫○●□■▲△▶▷▼▽◀◁◆◇○●]\s*")

# Contact info patterns
_CONTACT_PATTERNS = re.compile(
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"       # email
    r"|https?://[^\s|]+"                      # URL
    r"|\+?\d[\d\s\-().]{6,}\d"               # phone
    r"|linkedin\.com|github\.com",             # platform links
    re.I,
)


def _is_bullet_line(line: str) -> bool:
    return bool(_BULLET_RE.match(line))


def _is_contact_line(line: str) -> bool:
    """Check if a line contains contact information."""
    return bool(_CONTACT_PATTERNS.search(line))


def _classify_block(lines: List[str]) -> str:
    """Classify a block of consecutive non-blank lines.

    Returns one of: 'heading', 'bullet', 'contact', 'paragraph'
    """
    if not lines:
        return "empty"

    bullet_count = sum(1 for l in lines if _is_bullet_line(l))
    if bullet_count > 0:
        return "bullet"

    contact_count = sum(1 for l in lines if _is_contact_line(l))
    if contact_count >= len(lines):
        return "contact"

    return "paragraph"


# ============================================================
# Main extraction function
# ============================================================


def extract_text_from_pdf(
    pdf_bytes: bytes,
    filename: str = "unknown.pdf",
    max_size_bytes: int = 10 * 1024 * 1024,
) -> "ExtractionResult":
    """Extract text from raw PDF bytes with structure preservation.

    Uses pypdf layout mode to preserve spatial positioning, then
    post-processes to detect section boundaries and cluster content.

    PERFORMANCE: Single extract_text() call per page — layout mode
    provides both position-aware text and clean text (after stripping
    layout whitespace).

    Args:
        pdf_bytes: Raw PDF file content.
        filename: Original filename for logging context.
        max_size_bytes: Reject files larger than this size.

    Returns:
        ExtractionResult with extracted text (flat), page-level structure,
        and section clusters.

    Raises:
        ValueError: If the PDF is password-protected, corrupt, or oversized.
    """
    stage_start = time.perf_counter()
    logger.info("[EXTRACT] Starting extraction | file=%s | size_bytes=%d", filename, len(pdf_bytes))

    if not pdf_bytes:
        raise ValueError("PDF file is empty — no bytes to process.")

    if len(pdf_bytes) > max_size_bytes:
        raise ValueError(
            f"PDF file exceeds maximum size of {max_size_bytes // (1024 * 1024)}MB "
            f"(got {len(pdf_bytes)} bytes)."
        )

    # ---------------------------------------------------------------
    # Open PDF
    # ---------------------------------------------------------------
    try:
        pdf_file = io.BytesIO(pdf_bytes)
        reader = pypdf.PdfReader(pdf_file)
    except Exception as exc:
        logger.error("[EXTRACT] FAILED — pypdf could not open PDF | file=%s | error=%s", filename, str(exc))
        raise ValueError(
            "Failed to parse PDF document. Ensure it is not password protected or corrupt."
        ) from exc

    page_count = len(reader.pages)
    quality_flags: Dict[str, bool] = {}
    all_text_parts: List[str] = []
    pages: List[PageContent] = []

    # Extract embedded hyperlinks from PDF annotations
    embedded_links: List[Dict[str, Any]] = extract_pdf_hyperlinks(reader)

    # ---------------------------------------------------------------
    # Per-page extraction — SINGLE extract_text() call per page
    #
    # Layout mode preserves spacing/positioning. We use the layout
    # text for structure analysis AND derive clean flat text from
    # it (by simply taking the stripped text per line). This avoids
    # a second extract_text() call.
    # ---------------------------------------------------------------
    for i, page in enumerate(reader.pages):
        try:
            layout_text = page.extract_text(extraction_mode="layout") or ""
        except Exception as exc:
            logger.warning("[EXTRACT] Page %d extraction failed | file=%s | error=%s", i, filename, str(exc))
            layout_text = ""

        # Derive clean text from layout text: strip each line, join
        clean_lines = [ln.strip() for ln in layout_text.split("\n") if ln.strip()]
        clean_text = "\n".join(clean_lines)
        all_text_parts.append(clean_text)

        # Build structured page content from the SAME layout text
        page_content = _build_page_content(layout_text, page_num=i)
        pages.append(page_content)

    # ---------------------------------------------------------------
    # Build flat text (backward compatible)
    # ---------------------------------------------------------------
    flat_text = "\n".join(all_text_parts).strip()
    char_count = len(flat_text)

    # ---------------------------------------------------------------
    # Build section clusters from page blocks
    # ---------------------------------------------------------------
    clusters = _build_section_clusters(pages)

    # ---------------------------------------------------------------
    # Quality checks
    # ---------------------------------------------------------------
    replacement_count = flat_text.count("\ufffd")
    control_chars = sum(ord(c) < 32 and c not in "\n\t\r" for c in flat_text)
    control_ratio = control_chars / max(1, char_count)
    word_count = len([w for w in flat_text.split() if any(c.isalpha() for c in w)])

    quality_flags["has_replacement_chars"] = replacement_count > char_count * 0.05
    quality_flags["high_control_char_ratio"] = control_ratio > 0.05
    quality_flags["low_word_count"] = word_count < 20 and char_count > 100

    elapsed = time.perf_counter() - stage_start

    if not flat_text:
        logger.warning(
            "[EXTRACT] Zero text extracted | file=%s | pages=%d | elapsed=%.2fs",
            filename,
            page_count,
            elapsed,
        )
        return ExtractionResult(
            text="",
            page_count=page_count,
            char_count=0,
            quality_flags=quality_flags,
            pages=pages,
            clusters=clusters,
        )

    logger.info(
        "[EXTRACT] Completed | file=%s | chars=%d | pages=%d | words=%d | "
        "clusters=%d | corruption_flags=%s | elapsed=%.2fs",
        filename,
        char_count,
        page_count,
        word_count,
        len(clusters),
        quality_flags,
        elapsed,
    )

    return ExtractionResult(
        text=flat_text,
        page_count=page_count,
        char_count=char_count,
        quality_flags=quality_flags,
        pages=pages,
        clusters=clusters,
        embedded_links=embedded_links,
    )


# ============================================================
# Page content builder
# ============================================================

def _build_page_content(layout_text: str, page_num: int) -> PageContent:
    """Parse layout-mode text into structured blocks.

    Strategy:
      1. Split layout text into lines
      2. Scan lines left-to-right; detect headings inline
      3. When a heading is found, flush the current content block,
         emit a single-line heading block, then start a new content block
      4. Consecutive non-blank, non-heading lines are grouped into blocks

    This ensures headings NEVER merge with their following content,
    regardless of whether blank lines separate them.

    Args:
        layout_text: Raw text from page.extract_text(extraction_mode="layout")
        page_num: Zero-based page number.

    Returns:
        PageContent with blocks and raw text.
    """
    lines = layout_text.split("\n")
    # Trim trailing empty lines
    while lines and not lines[-1].strip():
        lines.pop()

    blocks: List[TextBlock] = []
    current_lines: List[str] = []
    current_start = 0

    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            # Empty line — flush current content block
            if current_lines:
                blocks.append(_make_block(current_lines, page_num, current_start, idx))
                current_lines = []
            current_start = idx + 1
            continue

        # Check if this line is a section heading
        detected = _detect_section_heading(stripped)
        if detected:
            # Flush previous content block (if any)
            if current_lines:
                blocks.append(_make_block(current_lines, page_num, current_start, idx))
                current_lines = []
            # Emit heading as its own single-line block
            heading_block = TextBlock(
                text=stripped,
                page_num=page_num,
                line_start=idx,
                line_end=idx + 1,
                is_heading=True,
                section_name=detected,
                block_type="heading",
            )
            blocks.append(heading_block)
            current_start = idx + 1
        else:
            current_lines.append(stripped)

    # Flush last block
    if current_lines:
        blocks.append(_make_block(current_lines, page_num, current_start, len(lines)))

    return PageContent(page_num=page_num, raw_text=layout_text, lines=lines, blocks=blocks)


def _make_block(lines: List[str], page_num: int, line_start: int, line_end: int) -> TextBlock:
    """Create a TextBlock from a list of consecutive non-blank lines."""
    text = "\n".join(lines)
    block_type = _classify_block(lines)
    return TextBlock(
        text=text,
        page_num=page_num,
        line_start=line_start,
        line_end=line_end,
        is_heading=False,
        section_name=None,
        block_type=block_type,
    )


# ============================================================
# Section clustering — groups heading→content pairs across pages
# ============================================================

def _build_section_clusters(pages: List[PageContent]) -> List[SectionCluster]:
    """Group blocks across all pages into section clusters.

    Algorithm:
      - Scan blocks in order across all pages (reading order)
      - When a heading block is found, start a new cluster
      - Collect all subsequent non-heading blocks until the next heading
      - Blocks before the first heading become a header cluster (section_name=None)

    Returns:
        List of SectionCluster objects in reading order.
    """
    # Flatten all blocks in reading order
    all_blocks: List[TextBlock] = []
    for page in pages:
        all_blocks.extend(page.blocks)

    clusters: List[SectionCluster] = []
    current_cluster_blocks: List[TextBlock] = []
    current_section: Optional[str] = None
    current_heading: str = ""

    def _flush():
        """Push the current cluster accumulation."""
        nonlocal current_cluster_blocks, current_section, current_heading
        if not current_cluster_blocks and not current_heading:
            return
        content = "\n".join(b.text for b in current_cluster_blocks).strip()
        name = current_section or "header"
        clusters.append(SectionCluster(
            section_name=name,
            heading_text=current_heading,
            content_text=content,
            blocks=current_cluster_blocks,
        ))
        current_cluster_blocks = []
        current_section = None
        current_heading = ""

    for block in all_blocks:
        if block.is_heading:
            # Flush previous cluster
            _flush()
            current_section = block.section_name
            current_heading = block.text.strip()
        else:
            current_cluster_blocks.append(block)

    # Flush last cluster
    _flush()

    return clusters


# ============================================================
# Result type
# ============================================================


class ExtractionResult:
    """Typed result from the extractor stage.

    Backward compatible: all existing consumers use .text, .page_count,
    .char_count, .is_empty(), and .has_corruption_warning().

    New structured fields:
      - .pages: List[PageContent] — per-page breakdown
      - .clusters: List[SectionCluster] — section-grouped content clusters
    """

    def __init__(
        self,
        text: str,
        page_count: int,
        char_count: int,
        quality_flags: Optional[Dict[str, bool]] = None,
        pages: Optional[List[PageContent]] = None,
        clusters: Optional[List[SectionCluster]] = None,
        embedded_links: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self.text = text
        self.page_count = page_count
        self.char_count = char_count
        self.quality_flags = quality_flags or {}
        # Structured fields
        self.pages = pages or []
        self.clusters = clusters or []
        # Embedded hyperlinks from PDF annotations
        self.embedded_links = embedded_links or []

    def is_empty(self) -> bool:
        return not self.text.strip()

    def has_corruption_warning(self) -> bool:
        return self.quality_flags.get("has_replacement_chars", False) or self.quality_flags.get(
            "high_control_char_ratio", False
        )

    # ---- Convenience accessors ----

    def get_cluster(self, section_name: str) -> Optional[SectionCluster]:
        """Get the first cluster matching a section name."""
        for c in self.clusters:
            if c.section_name == section_name:
                return c
        return None

    def get_cluster_text(self, section_name: str) -> str:
        """Get the content text of a named section cluster, or empty string."""
        cluster = self.get_cluster(section_name)
        return cluster.content_text if cluster else ""

    def get_header_text(self) -> str:
        """Get the text from the header region (before first section heading)."""
        cluster = self.get_cluster("header")
        return cluster.content_text if cluster else ""

    @property
    def section_names(self) -> List[str]:
        """List section names found in order."""
        seen: List[str] = []
        for c in self.clusters:
            if c.section_name and c.section_name != "header":
                seen.append(c.section_name)
        return seen
