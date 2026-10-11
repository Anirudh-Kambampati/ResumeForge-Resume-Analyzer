"""CORS and client-IP trust configuration.

Verifies the origin allowlist (any localhost/dev port plus the deployed
frontend) and that foreign origins are rejected with 400. Also covers the
TRUST_PROXY setting that decides whether X-Forwarded-For is honored when
resolving the rate-limiting client IP.
"""
import importlib

from fastapi.testclient import TestClient


def _client(monkeypatch=None, **env):
    import main

    if monkeypatch is not None:
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        if env:  # settings are read at call time, but reimport to be safe
            importlib.reload(main)
    return TestClient(main.app), main


def test_cors_allows_localhost_any_port():
    client, _ = _client()
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:55989",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:55989"


def test_cors_allows_loopback_and_deployed_frontend():
    client, _ = _client()
    for origin in (
        "http://127.0.0.1:3000",
        "https://resume-forge-chi-five.vercel.app",
        "https://main-abc123.resume-forge-chi-five.vercel.app",
    ):
        response = client.options(
            "/api/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200, origin
        assert response.headers["access-control-allow-origin"] == origin, origin


def test_cors_rejects_foreign_origin():
    client, _ = _client()
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_client_ip_direct_peer_without_proxy_trust(monkeypatch):
    client, main = _client(monkeypatch, TRUST_PROXY="0")
    from services.rate_limiter import get_client_ip  # imported after env is set

    client2, _ = _client()
    request = client2.get(
        "/api/health", headers={"X-Forwarded-For": "203.0.113.7, 10.0.0.1"}
    )
    assert request.status_code == 200
    
    # Build a fake request to test IP resolution directly
    from starlette.requests import Request as StarletteRequest

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/health",
        "headers": [(b"x-forwarded-for", b"203.0.113.7, 10.0.0.1")],
        "client": ("127.0.0.1", 58434),
        "server": ("127.0.0.1", 8000),
        "scheme": "http",
        "query_string": b"",
    }
    req = StarletteRequest(scope)
    assert get_client_ip(req) == "127.0.0.1"  # spoofed header ignored


def test_client_ip_uses_forwarded_header_with_proxy_trust(monkeypatch):
    client, main = _client(monkeypatch, TRUST_PROXY="1")
    from services.rate_limiter import get_client_ip

    from starlette.requests import Request as StarletteRequest

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/health",
        "headers": [(b"x-forwarded-for", b"203.0.113.7, 10.0.0.1")],
        "client": ("127.0.0.1", 58434),
        "server": ("127.0.0.1", 8000),
        "scheme": "http",
        "query_string": b"",
    }
    req = StarletteRequest(scope)
    assert get_client_ip(req) == "203.0.113.7"  # first hop honored


def test_client_ip_defaults_to_trusting_proxy():
    # Default deployment is behind a proxy; no env var honors the header.
    from services.rate_limiter import get_client_ip

    from starlette.requests import Request as StarletteRequest

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/health",
        "headers": [(b"x-forwarded-for", b"203.0.113.7")],
        "client": ("127.0.0.1", 58434),
        "server": ("127.0.0.1", 8000),
        "scheme": "http",
        "query_string": b"",
    }
    req = StarletteRequest(scope)
    assert get_client_ip(req) == "203.0.113.7"
