"""
Routage Vercel (E0a) : les réécritures de vercel.json sont évaluées dans l'ordre, la
première qui correspond l'emporte. Conversion des motifs identique à celle de Vercel
pour les formes utilisées ici (littéraux, groupes `(.*)`, échappements `\\.`), vérifiée
contre @vercel/routing-utils lors du contrôle E0a.
"""

import json
import os
import re

import pytest

VERCEL_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "vercel.json")
BACKEND = "/backend/api/index.py"


def to_regex(source: str) -> str:
    out, i = [], 0
    while i < len(source):
        c = source[i]
        if c == "\\":
            out.append(source[i:i + 2])
            i += 2
        elif c == "(":
            j = source.index(")", i)
            out.append(source[i:j + 1])
            i = j + 1
        else:
            out.append(re.escape(c))
            i += 1
    return "^" + "".join(out) + "$"


def route(path: str) -> str:
    with open(VERCEL_JSON, encoding="utf-8") as f:
        rewrites = json.load(f)["rewrites"]
    for rule in rewrites:
        m = re.match(to_regex(rule["source"]), path)
        if m:
            return re.sub(r"\$(\d+)", lambda g: m.group(int(g.group(1))) or "", rule["destination"])
    return "aucune règle"


def test_converter_matches_vercel_output():
    assert to_regex("/.well-known/oauth-protected-resource(.*)") == r"^/\.well\-known/oauth\-protected\-resource(.*)$"


@pytest.mark.parametrize("path", [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/api/mcp",
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
])
def test_oauth_discovery_goes_to_backend(path):
    assert route(path) == BACKEND


@pytest.mark.parametrize("path, expected", [
    ("/api/mcp", BACKEND),
    ("/api/health", BACKEND),
    ("/api/oauth/token", BACKEND),
    ("/.well-known/security.txt", "/frontend/.well-known/security.txt"),
    ("/.well-known/assetlinks.json", "/frontend/.well-known/assetlinks.json"),
    ("/static/js/main.abc.js", "/frontend/static/js/main.abc.js"),
    ("/manifest.json", "/frontend/manifest.json"),
    ("/", "/frontend/index.html"),
    ("/dashboard", "/frontend/index.html"),
    ("/oauth/consent", "/frontend/index.html"),
    ("/Xwell-known/oauth-protected-resource", "/frontend/index.html"),
])
def test_other_paths_are_unchanged(path, expected):
    assert route(path) == expected


def test_oauth_rules_precede_frontend_rules():
    with open(VERCEL_JSON, encoding="utf-8") as f:
        sources = [r["source"] for r in json.load(f)["rewrites"]]
    first_frontend = sources.index("/(.*)\\.(.*)")
    for prefix in ("/.well-known/oauth-protected-resource", "/.well-known/oauth-authorization-server",
                   "/.well-known/openid-configuration"):
        assert sources.index(prefix + "(.*)") < first_frontend


# ============================================
# En-têtes anti-clickjacking de la page de consentement OAuth (frontend statique)
# ============================================

def _headers_for(path: str) -> dict:
    with open(VERCEL_JSON, encoding="utf-8") as f:
        rules = json.load(f).get("headers", [])
    found = {}
    for rule in rules:
        if re.match(to_regex(rule["source"]), path):
            found.update({h["key"]: h["value"] for h in rule["headers"]})
    return found


@pytest.mark.parametrize("path", ["/oauth/consent", "/oauth/consent/", "/oauth"])
def test_consent_page_forbids_framing(path):
    headers = _headers_for(path)
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Content-Security-Policy"] == "frame-ancestors 'none'"
    assert headers["Cache-Control"] == "no-store"
    assert headers["Referrer-Policy"] == "no-referrer"


@pytest.mark.parametrize("path", ["/", "/dashboard", "/login", "/static/js/main.js"])
def test_other_pages_keep_their_headers(path):
    assert _headers_for(path) == {}


def test_consent_page_is_still_served_by_frontend():
    assert route("/oauth/consent") == "/frontend/index.html"
