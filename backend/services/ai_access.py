"""Who pays for an AI call: ResumeForge's keys, the user's own key (BYOK), or both.

Plans:
  - individual: ResumeForge's free-tier models first (unchanged chain). The
    user's key, if they supplied one, is appended as the last resort — used
    only when every server model is exhausted or failing.
  - business:   the user's own key only. Business AI features need BYOK.

The user's key arrives per request in headers and lives only for that request:
  X-LLM-Provider  one of BYOK_PROVIDERS
  X-LLM-Key       the API key
  X-LLM-Model     optional; defaults to the provider's suggested model
It is never stored, and llm_client redacts it from logged provider errors.
"""

import os
import re
from dataclasses import dataclass
from typing import Literal, Optional

from fastapi import HTTPException, Request

from services.llm_client import (
    AI_ERROR_HEADER,
    BYOK_PROVIDER_NAMES,
    GROQ_URL,
    OPENROUTER_URL,
    LLMClient,
    LLMTarget,
)

Plan = Literal["individual", "business"]

BYOK_TIMEOUT_SECONDS = 60.0


@dataclass(frozen=True)
class ByokProvider:
    url: str
    default_model: str


# All five expose an OpenAI-compatible chat completions endpoint. Default
# models are suggestions; the user can pick any model their key can use.
BYOK_PROVIDERS = {
    "openai": ByokProvider("https://api.openai.com/v1/chat/completions", "gpt-4.1-mini"),
    "anthropic": ByokProvider("https://api.anthropic.com/v1/chat/completions", "claude-haiku-5-5"),
    "gemini": ByokProvider(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "gemini-2.5-flash"
    ),
    "groq": ByokProvider(GROQ_URL, "openai/gpt-oss-120b"),
    "openrouter": ByokProvider(OPENROUTER_URL, "openrouter/auto"),
}

_KEY_RE = re.compile(r"^[\x21-\x7e]{8,512}$")  # printable ASCII, no spaces
_MODEL_RE = re.compile(r"^[\w.:/@+-]{1,120}$")


def _server_config() -> tuple[Optional[str], str]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
    if model.startswith("OPENROUTER_MODEL="):
        model = model[len("OPENROUTER_MODEL="):]
    model = model.strip()
    if not api_key or not api_key.strip() or "your_openrouter_api_key" in api_key:
        return None, model
    return api_key.strip(), model


def server_llm_client() -> Optional[LLMClient]:
    """ResumeForge's own free-tier chain, or None when no server key is set."""
    api_key, model = _server_config()
    return LLMClient.from_env(api_key, model)


def byok_target_from_request(request: Request) -> Optional[LLMTarget]:
    """Build the user's target from request headers. 400 on malformed input."""
    provider = request.headers.get("x-llm-provider", "").strip().lower()
    key = request.headers.get("x-llm-key", "").strip()
    model = request.headers.get("x-llm-model", "").strip()
    if not provider and not key:
        return None
    if provider not in BYOK_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported AI provider.", headers={AI_ERROR_HEADER: "byok_invalid"})
    if not _KEY_RE.match(key):
        raise HTTPException(
            status_code=400,
            detail=f"That doesn't look like a valid {BYOK_PROVIDER_NAMES[provider]} API key.",
            headers={AI_ERROR_HEADER: "byok_invalid"},
        )
    preset = BYOK_PROVIDERS[provider]
    model = model or preset.default_model
    if not _MODEL_RE.match(model):
        raise HTTPException(status_code=400, detail="Invalid model name.", headers={AI_ERROR_HEADER: "byok_model"})
    return LLMTarget(
        provider=provider,
        url=preset.url,
        api_key=key,
        model=model,
        timeout_seconds=BYOK_TIMEOUT_SECONDS,
        byok=True,
    )


def resolve_llm_client(request: Request, plan: Plan) -> LLMClient:
    """The client an endpoint should use for this request and plan."""
    byok = byok_target_from_request(request)

    if plan == "business":
        if byok is None:
            raise HTTPException(
                status_code=401,
                detail="ResumeForge for Businesses uses your own AI key. Add one in AI settings to use AI features.",
                headers={AI_ERROR_HEADER: "byok_required"},
            )
        return LLMClient([byok])

    server = server_llm_client()
    targets = (server.targets if server else []) + ([byok] if byok else [])
    if not targets:
        raise HTTPException(
            status_code=503,
            detail="ResumeForge AI isn't available right now. Add your own API key to keep going.",
            headers={AI_ERROR_HEADER: "server_exhausted"},
        )
    return LLMClient(targets, offer_byok=byok is None)


def ai_error_code(exc: BaseException) -> Optional[str]:
    """The X-AI-Error code carried by an HTTPException, if any."""
    if isinstance(exc, HTTPException) and exc.headers:
        return exc.headers.get(AI_ERROR_HEADER)
    return None
