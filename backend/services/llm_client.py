"""Stage 3: LLM Interaction with OpenRouter.

Responsibility:
  - Communicate with OpenRouter API
  - Handle retries, rate limits, and provider errors
  - Return raw LLM response text
  - NEVER construct prompts, validate output, or orchestrate stages

Stage-level logging:
  - Logs request with model, prompt sizes
  - Logs response with token usage and elapsed time
  - Logs structured error details on failure (HTTP status, provider messages)
"""

import logging
import time
from typing import Dict, Optional, Tuple

import httpx
from fastapi import HTTPException

logger = logging.getLogger("resumeforge.pipeline.llm_client")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class LLMClient:
    """Client for communicating with OpenRouter-compatible LLM APIs."""

    def __init__(
        self,
        api_key: str,
        model: str = "meta-llama/llama-3.1-8b-instruct:free",
        timeout_seconds: float = 45.0,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://resumeforge.dev",
            "X-Title": "ResumeForge",
        }

    @classmethod
    def from_env(cls, api_key: Optional[str], model: Optional[str] = None) -> Optional["LLMClient"]:
        """Create client from env-derived values. Returns None if misconfigured."""
        if not api_key or not api_key.strip() or "your_openrouter_api_key" in api_key:
            return None
        resolved_model = model or "meta-llama/llama-3.1-8b-instruct:free"
        return cls(api_key.strip(), resolved_model.strip())

    async def chat_completion(
        self,
        system_message: str,
        user_message: str,
        temperature: float = 0.3,
    ) -> str:
        """Send a chat completion request and return the response text.

        Args:
            system_message: System prompt.
            user_message: User prompt.
            temperature: Sampling temperature (0.0-1.0).

        Returns:
            The raw response content string from the LLM.

        Raises:
            HTTPException: Wrapped from OpenRouter errors (502/503) with user-friendly messages.
        """
        stage_start = time.perf_counter()
        logger.info(
            "[LLM] Request start | model=%s | system_chars=%d | user_chars=%d | temp=%.1f",
            self.model,
            len(system_message),
            len(user_message),
            temperature,
        )

        payload: Dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    OPENROUTER_URL,
                    headers=self._headers,
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            elapsed = time.perf_counter() - stage_start
            logger.error(
                "[LLM] TIMEOUT | model=%s | elapsed=%.2fs | timeout=%.1fs",
                self.model,
                elapsed,
                self.timeout_seconds,
            )
            raise HTTPException(
                status_code=504,
                detail="The AI request timed out. Please try again or use a shorter resume.",
            ) from exc
        except httpx.RequestError as exc:
            elapsed = time.perf_counter() - stage_start
            logger.error(
                "[LLM] CONNECTION FAILED | model=%s | elapsed=%.2fs | error=%s",
                self.model,
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
                "[LLM] API ERROR | model=%s | status=%d | elapsed=%.2fs | error=%s",
                self.model,
                response.status_code,
                elapsed,
                err_msg,
            )

            status_code, detail = self._map_http_error(response.status_code, err_msg)
            raise HTTPException(status_code=status_code, detail=detail)

        res_data = response.json()
        if "choices" not in res_data or not res_data["choices"]:
            logger.error("[LLM] No choices in response | model=%s | elapsed=%.2fs", self.model, elapsed)
            raise HTTPException(status_code=502, detail="No choices returned from the AI provider.")

        raw_content = res_data["choices"][0]["message"]["content"]

        # Log token usage if available
        usage = res_data.get("usage", {})
        if usage:
            logger.info(
                "[LLM] Completed | model=%s | response_chars=%d | "
                "prompt_tokens=%s | completion_tokens=%s | elapsed=%.2fs",
                self.model,
                len(raw_content),
                usage.get("prompt_tokens", "N/A"),
                usage.get("completion_tokens", "N/A"),
                elapsed,
            )
        else:
            logger.info(
                "[LLM] Completed | model=%s | response_chars=%d | elapsed=%.2fs",
                self.model,
                len(raw_content),
                elapsed,
            )

        return raw_content

    def _map_http_error(self, status_code: int, err_msg: str) -> Tuple[int, str]:
        """Map OpenRouter HTTP errors to user-friendly messages."""
        if status_code in (401, 403):
            return 500, "ResumeForge AI is not configured correctly on the server."
        if status_code == 402:
            return 502, "AI provider credit or payment failure."
        if status_code == 429:
            return 429, "The free AI provider is rate limited. Please try again shortly."
        if status_code == 400 and "model" in err_msg.lower():
            return 502, "The configured AI model is currently unavailable."
        if status_code in (502, 503):
            return 502, "AI provider is temporarily unavailable. Please try again."
        return 502, "AI analysis is temporarily unavailable. Please try again."
