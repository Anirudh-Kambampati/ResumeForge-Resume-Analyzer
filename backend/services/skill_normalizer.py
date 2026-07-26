"""Skill Normalization — deterministic formatting cleanup for imported skills.

Responsibility:
  - Fix spacing and capitalization artifacts introduced by PDF extraction
  - Split concatenated PascalCase terms (GenerativeAI → Generative AI)
  - Preserve known official names (TensorFlow, PyTorch, LangChain, etc.)
  - Preserve known acronyms (AI, ML, NLP, RAG, CNN, LLM, SQL)
  - Handle parentheses, hyphens, and whitespace consistently
  - Remove duplicate skills
  - NEVER invent skills, NEVER remove skills

This module is purely deterministic — no LLM calls, no heuristics that
could change meaning. Every transformation is a simple string operation
guarded by preservation lists.
"""

import re
from typing import List, Set

# ============================================================
# Preservation lists
#
# Terms in these lists are NEVER modified by the normalizer,
# even if they superficially match a transformation pattern.
# ============================================================

# Known official names — preserve capitalization and form exactly as-is.
_KEEP_OFFICIAL: Set[str] = {
    # ML / AI frameworks & libraries
    "tensorflow",
    "pytorch",
    "langchain",
    "scikit-learn",
    "sklearn",
    "keras",
    "jax",
    "hugging face",
    "huggingface",
    "spacy",
    "nltk",
    "opencv",
    "dlib",
    "mlflow",
    # Data science & numerical
    "numpy",
    "pandas",
    "scipy",
    "matplotlib",
    "seaborn",
    "plotly",
    "dask",
    # Databases
    "mongodb",
    "postgresql",
    "postgres",
    "mysql",
    "sqlite",
    "redis",
    "elasticsearch",
    "cassandra",
    "dynamodb",
    "firebase",
    "supabase",
    "neon",
    # Cloud & DevOps
    "github",
    "gitlab",
    "bitbucket",
    "github actions",
    "docker",
    "kubernetes",
    "terraform",
    "fastapi",
    "next.js",
    "nextjs",
    "reactjs",
    "nodejs",
    "express.js",
    "expressjs",
    "vue.js",
    "vuejs",
    "angularjs",
    "svelte",
    "tailwindcss",
    "tailwind css",
}

# Known acronyms — treated as single uppercase tokens.
# Includes standard ML, CS, and industry acronyms.
_KEEP_ACRONYMS: Set[str] = {
    "ai",
    "ml",
    "dl",
    "nlp",
    "rag",
    "cnn",
    "rnn",
    "lstm",
    "gan",
    "vae",
    "gpu",
    "tpu",
    "llm",
    "llms",
    "sql",
    "nosql",
    "api",
    "rest",
    "restful",
    "graphql",
    "grpc",
    "soap",
    "aws",
    "gcp",
    "azure",
    "gke",
    "eks",
    "aks",
    "ec2",
    "s3",
    "lambda",
    "css",
    "html",
    "http",
    "https",
    "json",
    "yaml",
    "xml",
    "csv",
    "pdf",
    "sass",
    "scss",
    "less",
    "ui",
    "ux",
    "seo",
    "cicd",
    "ci/cd",
    "sdk",
    "cli",
    "ide",
    "jwt",
    "oauth",
    "saml",
    "ldap",
    "jvm",
    "jdk",
    "sre",
    "devops",
    "mlops",
    "dba",
    "etl",
    "oltp",
    "olap",
    "saas",
    "paas",
    "iaas",
    "iac",
    "sqlalchemy",
}

# ============================================================
# Normalization logic
# ============================================================


def _protect_acronyms(text: str) -> str:
    """Insert null bytes between characters of known acronyms to prevent
    the PascalCase splitter from breaking them apart.

    E.g. 'LLMs' → 'L\x00L\x00M\x00s'  (the null bytes block the regex.)
    After splitting, _restore_acronyms removes the null bytes.
    """
    for acronym in sorted(_KEEP_ACRONYMS, key=len, reverse=True):
        # The default-argument trick captures `acronym`'s current value
        # into the closure so each iteration gets its own binding.
        def replacer(m):
            return "\x00".join(m.group(0))
        text = re.sub(re.escape(acronym), replacer, text, flags=re.IGNORECASE)
    return text


def _restore_acronyms(text: str) -> str:
    """Remove null-byte separators that were inserted by _protect_acronyms."""
    return text.replace("\x00", "")


def _split_pascal_case(text: str) -> str:
    """Insert spaces at PascalCase/camelCase boundaries.

    Known acronyms are protected beforehand so they are never split apart.

    Strategy:
      1. Protect known acronyms (LLMs, AI, ML, etc.)
      2. Insert space before an uppercase letter that follows a lowercase letter
         → 'GenerativeAI' becomes 'Generative AI'
      3. Insert space between an uppercase-sequence end and a new uppercase-start
         → 'LLMModels' becomes 'LLM Models' (but only when the sequence
           is followed by a lowercase letter)
      4. Restore acronyms
    """
    # Phase 1: Protect acronyms from splitting
    text = _protect_acronyms(text)

    # Phase 2: lowercase → uppercase boundary (main camelCase split)
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)

    # Phase 3: acronym block → new word boundary
    # e.g., 'LLM' + 'Models' — split between the end of the acronym and the
    # uppercase start of the next word, when the next word continues with lowercase
    text = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", text)

    # Phase 4: Restore acronyms
    text = _restore_acronyms(text)

    return text


def _normalize_parentheses(text: str) -> str:
    """Normalize spacing around parentheses.

    - Removes internal padding: '( LLMs )' → '(LLMs)'
    - Adds space before '(' if missing: 'Models(LLMs)' → 'Models (LLMs)'
    - Ensures consistent single space after ')' when followed by text.
    """
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+\)", ")", text)
    text = re.sub(r"(\S)\(", r"\1 (", text)
    text = re.sub(r"\)(\S)", r") \1", text)
    return text


def _normalize_hyphens(text: str) -> str:
    """Replace hyphens with spaces.

    Known official hyphenated names (Scikit-learn, etc.) are protected
    by the preservation check in normalize_skill_name() — this function
    assumes the check has already passed.
    """
    if "-" not in text:
        return text
    # Don't touch URLs or paths
    if text.startswith("http") or "://" in text or text.startswith("/"):
        return text
    return text.replace("-", " ")


def normalize_skill_name(name: str) -> str:
    """Normalize a single skill name for consistent formatting.

    Args:
        name: Raw skill string (e.g. 'GenerativeAI', '  scikit-learn  ')

    Returns:
        Cleanly formatted skill string. Never empty for non-empty input.
        Never changes the semantic meaning of the skill.
    """
    text = name.strip()

    if not text:
        return text

    # --- Phase 1: Preservation check ---
    # If the entire term (lowercased) is a known official name, return as-is.
    if text.lower() in _KEEP_OFFICIAL:
        return text

    # --- Phase 2: Handle parentheses ---
    text = _normalize_parentheses(text)

    # --- Phase 3: Handle hyphens ---
    # After parentheses normalization so '(Scikit-learn)' is handled correctly
    text = _normalize_hyphens(text)

    # --- Phase 4: Split PascalCase/camelCase ---
    text = _split_pascal_case(text)

    # --- Phase 5: Check again for known names (after splitting) ---
    if text.lower() in _KEEP_OFFICIAL:
        # The split might have added spaces that produced a known multi-word name
        # e.g. 'huggingface' → 'Hugging Face' → matches 'hugging face'
        # Return the user's original form if it's already correct, otherwise
        # we keep the split result (which is still semantically correct)
        pass  # Let the split result stand — it's still readable

    # --- Phase 6: Condense whitespace ---
    text = re.sub(r"\s+", " ", text).strip()

    # --- Phase 7: Restore capitalization for acronyms ---
    # After splitting, acronyms that were part of a compound may have lost
    # their uppercase form. Re-uppercase them.
    words = text.split(" ")
    result_words = []
    for word in words:
        stripped = word.strip("()")
        if stripped.lower() in _KEEP_ACRONYMS and stripped.islower():
            # Re-uppercase the acronym
            result_words.append(word.replace(stripped, stripped.upper()))
        else:
            result_words.append(word)
    text = " ".join(result_words)

    # --- Phase 8: Final trim ---
    text = text.strip()

    return text


def normalize_skill_items(items: List[str]) -> List[str]:
    """Normalize a list of skill names, deduplicate case-insensitively.

    Args:
        items: List of raw skill strings.

    Returns:
        List of normalized skill names with duplicates removed,
        preserving the original insertion order.
    """
    seen: Set[str] = set()
    result: List[str] = []
    for item in items:
        normalized = normalize_skill_name(item)
        if not normalized:
            continue
        key = normalized.lower()
        if key not in seen:
            seen.add(key)
            result.append(normalized)
    return result
