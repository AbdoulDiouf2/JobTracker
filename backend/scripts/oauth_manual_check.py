"""
Essai manuel du flux OAuth du connecteur MCP, SANS ChatGPT (plan A1, vérifications V1 à V6).

Ne lit ni n'écrit la base : uniquement des appels HTTP vers JobTracker.
N'affiche JAMAIS le client_secret, le code d'autorisation ni les jetons (seulement leur
préfixe et leur longueur).

Usage (depuis backend/) :
  python scripts/oauth_manual_check.py --checks-only          # V1 à V3, anonymes
  python scripts/oauth_manual_check.py --client-id jt_oc_...  # V1 à V6, interactif
Options : --base https://jobtracker.maadec.com  --redirect-uri <URI exacte enregistrée>

Déroulé interactif :
 1. le script affiche une URL /authorize (PKCE S256 généré localement) ;
 2. tu l'ouvres dans ton navigateur connecté à JobTracker et tu cliques sur « Autoriser » ;
 3. le navigateur arrive sur chatgpt.com (erreur normale, aucun connecteur en attente) :
    copie l'URL COMPLÈTE de la barre d'adresse et colle-la dans le script (60 s) ;
 4. le secret du client est saisi de façon masquée ;
 5. le script échange le code, appelle /api/mcp (tools/list, jobtracker_ping), révoque
    l'autorisation puis vérifie que le jeton est refusé.
"""

import argparse
import asyncio
import base64
import getpass
import hashlib

import secrets
import sys
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx

DEFAULT_BASE = "https://jobtracker.maadec.com"
DEFAULT_REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect"
SCOPE = "watch:read opportunities:write"
MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def masked(value: str) -> str:
    """Préfixe et longueur seulement : jamais la valeur."""
    return f"{value[:7]}… ({len(value)} car.)" if value else "(vide)"


def new_pkce() -> tuple:
    verifier = secrets.token_urlsafe(48)[:64]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def authorize_url(base: str, client_id: str, redirect_uri: str, challenge: str, state: str) -> str:
    return f"{base}/api/oauth/authorize?" + urlencode({
        "response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri,
        "code_challenge": challenge, "code_challenge_method": "S256", "state": state,
        "scope": SCOPE, "resource": f"{base}/api/mcp",
    })


class Report:
    def __init__(self, out=print):
        self.out, self.ok = out, True

    def check(self, label: str, passed: bool, detail: str = "") -> bool:
        self.ok = self.ok and passed
        self.out(f"[{'OK' if passed else 'ÉCHEC'}] {label}{(' — ' + detail) if detail else ''}")
        return passed


async def anonymous_checks(http: httpx.AsyncClient, base: str, rep: Report) -> None:
    """V1 à V3 : sans compte ni secret."""
    prm = await http.get("/.well-known/oauth-protected-resource/api/mcp")
    body = prm.json() if prm.headers.get("content-type", "").startswith("application/json") else {}
    rep.check("V1 métadonnées de ressource", prm.status_code == 200 and body.get("resource") == f"{base}/api/mcp"
              and body.get("authorization_servers") == [base], f"HTTP {prm.status_code}")
    asm = await http.get("/.well-known/oauth-authorization-server")
    meta = asm.json() if asm.headers.get("content-type", "").startswith("application/json") else {}
    rep.check("V1 métadonnées du serveur d'autorisation", asm.status_code == 200 and meta.get("issuer") == base
              and meta.get("code_challenge_methods_supported") == ["S256"], f"HTTP {asm.status_code}")
    mcp = await http.post("/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
                          headers=MCP_HEADERS)
    challenge = mcp.headers.get("www-authenticate", "")
    rep.check("V2 /api/mcp sans jeton → 401 avec resource_metadata", mcp.status_code == 401
              and f'resource_metadata="{base}/.well-known/oauth-protected-resource/api/mcp"' in challenge,
              f"HTTP {mcp.status_code}")
    bad = await http.get("/api/oauth/authorize", params={"client_id": "jt_oc_inconnu", "response_type": "code"})
    rep.check("V3 client inconnu → 400 sans redirection", bad.status_code == 400 and "location" not in bad.headers,
              f"HTTP {bad.status_code}")


async def mcp_call(http, token, method, params, rid):
    r = await http.post("/api/mcp", json={"jsonrpc": "2.0", "id": rid, "method": method, "params": params},
                        headers={**MCP_HEADERS, "Authorization": f"Bearer {token}"})
    return r


async def finish_flow(http: httpx.AsyncClient, base: str, client_id: str, client_secret: str, redirect_uri: str,
                      verifier: str, state: str, returned_url: str, rep: Report) -> None:
    """V5 et V6 : vérifie le retour, échange le code, appelle le MCP, révoque."""
    q = {k: v[0] for k, v in parse_qs(urlsplit(returned_url.strip()).query).items()}
    if not rep.check("V5 retour avec code, state et iss", bool(q.get("code")) and q.get("state") == state
                     and q.get("iss") == base, "erreur : " + q.get("error", "") if "error" in q else ""):
        return
    token = await http.post("/api/oauth/token", data={
        "grant_type": "authorization_code", "code": q["code"], "code_verifier": verifier,
        "redirect_uri": redirect_uri, "resource": f"{base}/api/mcp",
        "client_id": client_id, "client_secret": client_secret,
    })
    tokens = token.json() if token.status_code == 200 else {}
    if not rep.check("V6 échange du code → jetons", token.status_code == 200
                     and tokens.get("access_token", "").startswith("jt_oat_")
                     and tokens.get("refresh_token", "").startswith("jt_ort_"),
                     f"HTTP {token.status_code}, accès {masked(tokens.get('access_token', ''))}, "
                     f"refresh {masked(tokens.get('refresh_token', ''))}, scope « {tokens.get('scope', '')} »"):
        return
    access = tokens["access_token"]
    init = await mcp_call(http, access, "initialize", {"protocolVersion": "2025-11-25", "capabilities": {},
                                                      "clientInfo": {"name": "oauth-manual-check", "version": "1"}}, 1)
    rep.check("V6 initialize authentifié", init.status_code == 200, f"HTTP {init.status_code}")
    listed = await mcp_call(http, access, "tools/list", {}, 2)
    names = [t["name"] for t in listed.json().get("result", {}).get("tools", [])] if listed.status_code == 200 else []
    rep.check("V6 outils exposés : démonstration uniquement", names == ["jobtracker_ping"], f"{names}")
    ping = await mcp_call(http, access, "tools/call", {"name": "jobtracker_ping", "arguments": {}}, 3)
    payload = ping.json().get("result", {}).get("structuredContent", {}) if ping.status_code == 200 else {}
    rep.check("V6 jobtracker_ping authentifié", payload.get("authenticated") is True, f"HTTP {ping.status_code}")
    revoke = await http.post("/api/oauth/revoke", data={"token": tokens["refresh_token"], "client_id": client_id,
                                                        "client_secret": client_secret})
    after = await mcp_call(http, access, "tools/list", {}, 4)
    rep.check("V6 révocation → jeton refusé", revoke.status_code == 200 and after.status_code == 401,
              f"révocation HTTP {revoke.status_code}, appel suivant HTTP {after.status_code}")


async def main(args, http=None, ask=input, ask_secret=getpass.getpass, out=print) -> int:
    base = args.base.rstrip("/")
    rep = Report(out)
    owns_client = http is None
    http = http or httpx.AsyncClient(base_url=base, timeout=30, follow_redirects=False)
    try:
        await anonymous_checks(http, base, rep)
        if args.checks_only:
            return 0 if rep.ok else 1
        verifier, challenge = new_pkce()
        state = secrets.token_urlsafe(16)
        out("\nOuvre cette URL dans ton navigateur connecté à JobTracker, puis clique sur « Autoriser » :\n")
        out(authorize_url(base, args.client_id, args.redirect_uri, challenge, state))
        returned = ask("\nColle ici l'URL complète de la page chatgpt.com atteinte : ")
        secret = ask_secret("Secret du client (saisie masquée) : ")
        await finish_flow(http, base, args.client_id, secret, args.redirect_uri, verifier, state, returned, rep)
        out("\nRÉSULTAT :", "tous les contrôles sont conformes" if rep.ok else "au moins un contrôle a échoué")
        return 0 if rep.ok else 1
    finally:
        if owns_client:
            await http.aclose()


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Essai manuel OAuth (V1 à V6), sans ChatGPT")
    p.add_argument("--base", default=DEFAULT_BASE)
    p.add_argument("--client-id")
    p.add_argument("--redirect-uri", default=DEFAULT_REDIRECT)
    p.add_argument("--checks-only", action="store_true")
    args = p.parse_args(argv)
    if not args.checks_only and not args.client_id:
        p.error("--client-id requis (sauf avec --checks-only)")
    return args


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
