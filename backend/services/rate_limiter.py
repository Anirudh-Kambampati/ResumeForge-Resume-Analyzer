"""Per-IP rate limiting and optional shared-secret API protection.

Responsibility:
  - Sliding-window rate limiting per client IP (in-memory)
  - Optional shared-secret check via the X-Api-Key header
  - FastAPI dependency factory for easy wiring onto AI endpoints

Design notes:
  - No external dependencies: a small deque per IP acts as the window.
  - In-memory state means limits are per-process. That is correct for the
    single-worker deployments this app targets; behind multiple workers each
    worker enforces its own window (worst case: N× the nominal limit).
  - Rate-limit state is intentionally decoupled from auth: a valid key does
    not bypass the limit — both apply.
  - Client IP resolution checks X-Forwarded-For first (required when running
    behind a proxy such as Vercel -> Fly/Render), falling back to the direct
    peer address.
"""

import hashlib
import hmac
import logging
import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

logger = logging.getLogger("resumeforge.api.rate_limiter")


class SlidingWindowRateLimiter:
    """Fixed-memory sliding-window rate limiter keyed by client IP."""

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: defaultdict = defaultdict(deque)
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float) -> None:
        """Periodically drop stale IPs so the dict does not grow forever."""
        if now - self._last_sweep < 60.0:
            return
        self._last_sweep = now
        cutoff = now - self.window_seconds
        stale = [ip for ip, q in self._hits.items() if not q or q[-1] < cutoff]
        for ip in stale:
            del self._hits[ip]

    def check(self, key: str) -> None:
        """Raise HTTP 429 if `key` has exceeded the limit; else record a hit."""
        now = time.monotonic()
        self._sweep(now)

        window = self._hits[key]
        cutoff = now - self.window_seconds

        # Drop entries that have slid out of the window
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= self.max_requests:
            oldest = window[0]
            retry_after = max(1, int(self.window_seconds - (now - oldest)) + 1)
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Please wait {retry_after}s and try again.",
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)


def get_client_ip(request: Request) -> str:
    """Resolve the client IP, honoring X-Forwarded-For when proxied."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First hop in the list is the original client
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


# ============================================================
# Shared-secret API key (optional)
#
# When API_SECRET_KEY is set on the backend AND the frontend sends
# X-Api-Key, requests must match. When unset, auth is disabled and
# only rate limiting applies — localhost dev keeps working with no
# configuration.
# ============================================================


def _constant_time_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(
        hashlib.sha256(a.encode()).hexdigest(),
        hashlib.sha256(b.encode()).hexdigest(),
    )


def is_api_key_configured() -> bool:
    return bool(os.getenv("API_SECRET_KEY", "").strip())


def check_api_key(request: Request) -> None:
    """Raise HTTP 401 when API_SECRET_KEY is set and the header is missing/mismatched."""
    expected = os.getenv("API_SECRET_KEY", "").strip()
    if not expected:
        return  # Auth disabled — local development
    provided = request.headers.get("x-api-key", "")
    if not provided or not _constant_time_equal(provided, expected):
        logger.warning(
            "[AUTH] Rejected request | ip=%s | path=%s",
            get_client_ip(request),
            request.url.path,
        )
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


# ============================================================
# Dependency factory
# ============================================================


def ai_rate_limit(max_requests: int, window_seconds: float):
    """Build a FastAPI dependency enforcing the API key + a per-IP window.

    Usage:
        @app.post("/api/improve", dependencies=[Depends(ai_rate_limit(30, 60))])
    """
    limiter = SlidingWindowRateLimiter(max_requests, window_seconds)

    async def dependency(request: Request) -> None:
        check_api_key(request)
        ip = get_client_ip(request)
        try:
            limiter.check(ip)
        except HTTPException:
            logger.warning(
                "[RATE-LIMIT] Blocked | ip=%s | path=%s | limit=%d/%ds",
                ip,
                request.url.path,
                max_requests,
                window_seconds,
            )
            raise

    return dependency
