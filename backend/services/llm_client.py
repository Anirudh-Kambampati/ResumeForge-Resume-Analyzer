"""Stage 3: LLM Interaction (Groq free tier, OpenRouter free models as fallback).

Responsibility:
  - Communicate with OpenAI-compatible chat APIs (Groq, OpenRouter)
  - Try an ordered chain of free models; on rate limits, outages, timeouts or
    invalid output from one, fall through to the next
  - Return raw LLM response text
  - NEVER construct prompts, validate output, or orchestrate stages

Free tiers only:
  - Groq: uses whichever models GROQ_MODELS lists. A Groq key stays on the free
    tier unless billing is added in the Groq console; over the limit it returns
    429 (we fall through), it never charges.
  - OpenRouter: only ":free" models (or the "openrouter/free" router) are used;
    a paid model in OPENROUTER_MODEL is ignored with a warning.

Stage-level logging:
  - Logs request with provider, model, prompt sizes
  - Logs response with token usage and elapsed time
  - Logs structured error details on failure (HTTP status, provider messages)
"""

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException

logger = logging.getLogger("resumeforge.pipeline.llm_client")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Fastest first. Benchmarked on the analyze prompt (~800 prompt tokens):
# gpt-oss-20b ~3.0s, qwen3.8-27b ~3.0s, gpt-oss-120b ~4.5s. Each Groq model has
# its own free-tier rate limit, so later entries also act as overflow capacity.
DEFAULT_GROQ_MODELS = "openai/gpt-oss-20b,qwen/qwen3.8-27b,openai/gpt-oss-120b"

# Per-model request tweaks that keep "thinking" models fast.
GROQ_MODEL_OPTIONS: Dict[str, Dict] = {
    "openai/gpt-oss-20b": {"reasoning_effort": "low"},
    "openai/gpt-oss-120b": {"reasoning_effort": "low"},
    "qwen/qwen3.8-27b": {"reasoning_effort": "none"},
}

GROQ_TIMEOUT_SECONDS = 25.0
OPENROUTER_TIMEOUT_SECONDS = 45.0
MAX_COMPLETION_TOKENS = 4096


def is_free_openrouter_model(model: str) -> bool:
    return model.endswith(":free") or model == "openrouter/free"


@dataclass
class LLMTarget:
    """One provider + model to try."""

    provider: str
    url: str
    api_key: str
    model: str
    timeout_seconds: float
    options: Dict = field(default_factory=dict)

    @property
    def label(self) -> str:
        return f"{self.provider}:{self.model}"


class LLMClient:
    """Client that tries a chain of free LLM targets in order."""

    def __init__(self, targets: List[LLMTarget]) -> None:
        if not targets:
            raise ValueError("LLMClient needs at least one target")
        self.targets = targets

    @property
    def model(self) -> str:
        """The primary (first-choice) model label."""
        return self.targets[0].label

    @property
    def model_chain(self) -> List[str]:
        return [t.label for t in self.targets]

    @classmethod
    def from_env(cls, api_key: Optional[str], model: Optional[str] = None) -> Optional["LLMClient"]:
        """Build the free-model chain: Groq models (GROQ_API_KEY) first, then the
        OpenRouter free model (api_key/model args) as a last resort.

        Returns None when no provider is configured.
        """
        targets: List[LLMTarget] = []

        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        if groq_key:
            groq_models = os.getenv("GROQ_MODELS", DEFAULT_GROQ_MODELS)
            for groq_model in (m.strip() for m in groq_models.split(",")):
                if groq_model:
                    targets.append(
                        LLMTarget(
                            provider="groq",
                            url=GROQ_URL,
                            api_key=groq_key,
                            model=groq_model,
                            timeout_seconds=GROQ_TIMEOUT_SECONDS,
                            options=GROQ_MODEL_OPTIONS.get(groq_model, {}),
                        )
                    )

        if api_key and api_key.strip() and "your_openrouter_api_key" not in api_key:
            openrouter_model = (model or "meta-llama/llama-3.1-8b-instruct:free").strip()
            if is_free_openrouter_model(openrouter_model):
                targets.append(
                    LLMTarget(
                        provider="openrouter",
                        url=OPENROUTER_URL,
                        api_key=api_key.strip(),
                        model=openrouter_model,
                        timeout_seconds=OPENROUTER_TIMEOUT_SECONDS,
                    )
                )
            else:
                logger.warning(
                    "[LLM] Ignoring non-free OpenRouter model %r — free models only", openrouter_model
                )

        return cls(targets) if targets else None

    async def chat_completion(
        self,
        system_message: str,
        user_message: str,
        temperature: float = 0.3,
    ) -> str:
        """Send a chat completion, falling through the target chain on failure.

        Raises:
            HTTPException: the last target's error, mapped to a user-friendly message,
            when every target fails.
        """
        # JSON mode makes providers reject non-JSON output, but it requires the
        # prompt to ask for JSON — only enable it when it does.
        wants_json = "json" in (system_message + user_message).lower()

        last_error: Optional[HTTPException] = None
        for index, target in enumerate(self.targets):
            try:
                return await self._call(target, system_message, user_message, temperature, wants_json)
            except HTTPException as exc:
                last_error = exc
                if index + 1 < len(self.targets):
                    logger.warning(
                        "[LLM] %s failed (%s: %s) — falling back to %s",
                        target.label,
                        exc.status_code,
                        exc.detail,
                        self.targets[index + 1].label,
                    )
        assert last_error is not None
        raise last_error

    async def _call(
        self,
        target: LLMTarget,
        system_message: str,
        user_message: str,
        temperature: float,
        wants_json: bool,
    ) -> str:
        stage_start = time.perf_counter()
        logger.info(
            "[LLM] Request start | target=%s | system_chars=%d | user_chars=%d | temp=%.1f",
            target.label,
            len(system_message),
            len(user_message),
            temperature,
        )

        payload: Dict = {
            "model": target.model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            **target.options,
        }
        headers = {
            "Authorization": f"Bearer {target.api_key}",
            "Content-Type": "application/json",
        }
        if target.provider == "groq":
            payload["max_completion_tokens"] = MAX_COMPLETION_TOKENS
            if wants_json:
                payload["response_format"] = {"type": "json_object"}
        else:
            headers["HTTP-Referer"] = "https://resumeforge.dev"
            headers["X-Title"] = "ResumeForge"

        try:
            async with httpx.AsyncClient(timeout=target.timeout_seconds) as client:
                response = await client.post(target.url, headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            elapsed = time.perf_counter() - stage_start
            logger.error(
                "[LLM] TIMEOUT | target=%s | elapsed=%.2fs | timeout=%.1fs",
                target.label,
                elapsed,
                target.timeout_seconds,
            )
            raise HTTPException(
                status_code=504,
                detail="The AI request timed out. Please try again or use a shorter resume.",
            ) from exc
        except httpx.RequestError as exc:
            elapsed = time.perf_counter() - stage_start
            logger.error(
                "[LLM] CONNECTION FAILED | target=%s | elapsed=%.2fs | error=%s",
                target.label,
                elapsed,
                str(exc),
            )
            raise HTTPException(
                status_code=503,
                detail="Failed to connect to the AI service provider.",
            ) from exc

        elapsed = time.perf_counter() - stage_start

        if response.status_code != 200:
            err_msg = response.text
            try:
                err_json = response.json()
                err_msg = err_json.get("error", {}).get("message", err_msg)
            except Exception:  # nosec
                pass

            logger.error(
                "[LLM] API ERROR | target=%s | status=%d | elapsed=%.2fs | error=%s",
                target.label,
                response.status_code,
                elapsed,
                err_msg,
            )

            status_code, detail = self._map_http_error(response.status_code, err_msg)
            raise HTTPException(status_code=status_code, detail=detail)

        res_data = response.json()
        if "choices" not in res_data or not res_data["choices"]:
            logger.error("[LLM] No choices in response | target=%s | elapsed=%.2fs", target.label, elapsed)
            raise HTTPException(status_code=502, detail="No choices returned from the AI provider.")

        raw_content = res_data["choices"][0]["message"].get("content") or ""
        if not raw_content.strip():
            logger.error("[LLM] Empty content | target=%s | elapsed=%.2fs", target.label, elapsed)
            raise HTTPException(status_code=502, detail="The AI provider returned an empty response.")

        usage = res_data.get("usage", {})
        logger.info(
            "[LLM] Completed | target=%s | response_chars=%d | "
            "prompt_tokens=%s | completion_tokens=%s | elapsed=%.2fs",
            target.label,
            len(raw_content),
            usage.get("prompt_tokens", "N/A"),
            usage.get("completion_tokens", "N/A"),
            elapsed,
        )

        return raw_content

    def _map_http_error(self, status_code: int, err_msg: str) -> Tuple[int, str]:
        """Map provider HTTP errors to user-friendly messages."""
        if status_code in (401, 403):
            return 500, "ResumeForge AI is not configured correctly on the server."
        if status_code == 402:
            return 502, "AI provider credit or payment failure."
        if status_code == 413:
            return 413, "The resume is too long for the free AI tier. Please shorten it and try again."
        if status_code == 429:
            return 429, "The free AI provider is rate limited. Please try again shortly."
        if status_code == 400 and "model" in err_msg.lower():
            return 502, "The configured AI model is currently unavailable."
        if status_code in (502, 503):
            return 502, "AI provider is temporarily unavailable. Please try again."
        return 502, "AI analysis is temporarily unavailable. Please try again."
