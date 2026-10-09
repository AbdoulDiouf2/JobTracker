"""
JobTracker SaaS - Transport MCP compatible Vercel (Lot 2, étape 3, sous-lot E0b)

Décisions V4 et V5 :
- uniquement les API PUBLIQUES du SDK `mcp` (serveur bas niveau `mcp.server.Server`,
  `StreamableHTTPSessionManager`) ;
- SDK chargé à la demande, au premier appel MCP : les autres routes de JobTracker
  ne paient jamais son import.

Vercel n'exécute pas le `lifespan` ASGI. Or le gestionnaire du SDK démarre ses tâches
dans `run()`, qui ne peut être appelé qu'une fois par instance : un gestionnaire neuf
est donc créé PAR REQUÊTE (mode sans état, réponses JSON). Le serveur MCP, lui, est
construit une seule fois par instance.

Contrôles à CHAQUE requête (spécification §8 bis.2), dans cet ordre :
1. MCP actif (`MCP_ENABLED`), sinon réponse identique à une route absente (404). En
   production Vercel, il faut EN PLUS `MCP_PRODUCTION_ALLOWED=true` (deux clés cumulatives :
   une variable posée seule par erreur n'ouvre rien) ;
2. interrupteur d'urgence en base (`platform_settings.mcp_kill_switch`), FERMÉ par défaut :
   service coupé (503) tant qu'il n'a pas été explicitement ouvert ;
3. jeton d'accès OAuth valide (opaque, audience = ressource canonique, grant actif,
   compte actif et `watch_enabled`), sinon 401 + `WWW-Authenticate` (RFC 9728) ;
4. rafale par grant (spécification §6.2), sinon 429 + `Retry-After` ;
5. scope de l'outil appelé, sinon 403 `insufficient_scope` ;
6. hôtes et origines (protection anti DNS-rebinding du SDK).
Outils : `jobtracker_ping` (diagnostic, sans accès aux données) et les cinq outils métier de
la veille (`services/mcp_tools.py`), exécutés pour le seul `user_id` du grant.
"""

import asyncio
import contextvars
import json
import logging
import os
import time
from typing import Optional

from config import settings
from services import mcp_tools, oauth_service

logger = logging.getLogger("jobtracker.mcp")

SERVER_NAME = "JobTracker"
PING_TOOL = "jobtracker_ping"

_server = None
_server_lock = asyncio.Lock()
# Nombre de constructions du serveur MCP dans ce processus (contrôlé par les tests)
build_count = 0

# Corps identique, à l'octet près, à celui d'une route absente de FastAPI
_NOT_FOUND = json.dumps({"detail": "Not Found"}, separators=(",", ":")).encode()
MAX_BODY_BYTES = 4 * 1024 * 1024
# Scope exigé par outil (spécification §3.5)
TOOL_SCOPES = {PING_TOOL: "watch:read", **{t.name: t.scope for t in mcp_tools.TOOLS}}

# Rafale par grant : fenêtre fixe d'une minute, par instance (comme slowapi au Lot 1)
_RATE_WINDOW_SECONDS = 60.0
_rate_windows: dict = {}

# Identité vérifiée de la requête en cours, lue par les outils (jamais d'argument user_id)
current_principal: contextvars.ContextVar = contextvars.ContextVar("mcp_principal", default=None)

# Fournisseur de base de données (posé par server.py ; le transport ASGI n'a pas d'injection)
db_provider = None


def mcp_enabled() -> bool:
    """Actif seulement si demandé explicitement. En production Vercel, deux clés cumulatives :
    MCP_ENABLED et MCP_PRODUCTION_ALLOWED (sous-lot A0)."""
    if not settings.MCP_ENABLED:
        return False
    if (os.environ.get("VERCEL_ENV") or "").strip().lower() == "production":
        return settings.MCP_PRODUCTION_ALLOWED
    return True


def allowed_hosts() -> list:
    """Hôtes acceptés (anti DNS-rebinding) : uniquement la liste configurée. Aucun hôte de
    déploiement Vercel n'est ajouté automatiquement (pas de Preview, décision du 8 octobre 2026)."""
    return [h.strip().lower() for h in settings.MCP_ALLOWED_HOSTS.split(",") if h.strip()]


def _build_server():
    """Construit le serveur MCP bas niveau (import différé du SDK)."""
    from mcp import types
    from mcp.server import Server

    def tool_result(payload: dict, is_error: bool) -> types.CallToolResult:
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=json.dumps(payload, ensure_ascii=False))],
            structured_content=None if is_error else payload,
            is_error=is_error,
        )

    ping_tool = types.Tool(
        name=PING_TOOL,
        title="JobTracker : test de connexion",
        description="Vérifie que le serveur MCP de JobTracker répond. Ne lit ni n'écrit aucune donnée.",
        input_schema={"type": "object", "properties": {}, "additionalProperties": False},
        annotations=types.ToolAnnotations(read_only_hint=True, destructive_hint=False, idempotent_hint=True),
    )

    business_tools = [
        types.Tool(
            name=spec.name,
            title=spec.title,
            description=spec.description,
            input_schema=spec.input_schema,
            annotations=types.ToolAnnotations(
                read_only_hint=spec.read_only, destructive_hint=False, idempotent_hint=spec.idempotent,
                open_world_hint=False,
            ),
        )
        for spec in mcp_tools.TOOLS
    ]

    async def on_list_tools(ctx, params) -> types.ListToolsResult:
        return types.ListToolsResult(tools=[ping_tool, *business_tools])

    async def on_call_tool(ctx, params) -> types.CallToolResult:
        principal = current_principal.get()
        if params.name == PING_TOOL:
            payload = {"service": "jobtracker", "transport": "ok", "authenticated": principal is not None}
            return tool_result(payload, False)
        spec = mcp_tools.TOOLS_BY_NAME.get(params.name)
        if spec is None:
            return tool_result({"error": {"code": "unknown_tool"}}, True)
        # Défense en profondeur : identité et scope revérifiés au plus près de l'outil
        if principal is None or spec.scope not in principal.scopes:
            return tool_result({"error": {"code": "insufficient_scope", "scope": spec.scope}}, True)
        payload, is_error = await mcp_tools.call_tool(db_provider(), principal.user_id, spec.name, params.arguments,
                                                      client_id=principal.client_id)
        return tool_result(payload, is_error)

    return Server(SERVER_NAME, version="0.1.0", on_list_tools=on_list_tools, on_call_tool=on_call_tool)


async def get_server():
    """Serveur MCP unique par instance, construit au premier appel, sans course."""
    global _server, build_count
    if _server is None:
        async with _server_lock:
            if _server is None:
                _server = _build_server()
                build_count += 1
                logger.info("mcp_server built")
    return _server


def reset_for_tests() -> None:
    global _server, build_count
    _server = None
    build_count = 0
    _rate_windows.clear()


def _rate_limited(grant_id: str) -> Optional[int]:
    """None si la requête est admise, sinon le délai (s) avant la prochaine fenêtre."""
    now = time.monotonic()
    start, count = _rate_windows.get(grant_id, (now, 0))
    if now - start >= _RATE_WINDOW_SECONDS:
        start, count = now, 0
    if count >= settings.MCP_RATE_LIMIT_PER_MINUTE:
        return max(1, int(_RATE_WINDOW_SECONDS - (now - start)) + 1)
    _rate_windows[grant_id] = (start, count + 1)
    if len(_rate_windows) > 10000:  # borne mémoire : on oublie les fenêtres expirées
        for key, (s, _) in list(_rate_windows.items()):
            if now - s >= _RATE_WINDOW_SECONDS:
                _rate_windows.pop(key, None)
    return None


async def _send_json(send, status: int, payload: dict, extra_headers: Optional[list] = None) -> None:
    body = json.dumps(payload, separators=(",", ":")).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
               (b"cache-control", b"no-store")] + (extra_headers or [])
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


async def _send_not_found(send) -> None:
    await send({"type": "http.response.start", "status": 404,
                "headers": [(b"content-type", b"application/json"),
                            (b"content-length", str(len(_NOT_FOUND)).encode())]})
    await send({"type": "http.response.body", "body": _NOT_FOUND})


def _bearer(scope) -> Optional[str]:
    for name, value in scope.get("headers", []):
        if name == b"authorization":
            kind, _, token = value.decode("latin-1").partition(" ")
            return token.strip() if kind.lower() == "bearer" and token.strip() else None
    return None


def _challenge(error: Optional[str] = None, scope_needed: Optional[str] = None) -> list:
    """En-tête WWW-Authenticate (RFC 6750 / RFC 9728) : où trouver les métadonnées."""
    parts = []
    if error:
        parts.append(f'error="{error}"')
    parts.append(f'resource_metadata="{oauth_service.resource_metadata_url()}"')
    parts.append(f'scope="{scope_needed or " ".join(oauth_service.SUPPORTED_SCOPES)}"')
    return [(b"www-authenticate", ("Bearer " + ", ".join(parts)).encode())]


async def _read_body(receive) -> Optional[bytes]:
    """Lit le corps entier (borné). None si trop volumineux."""
    chunks, size = [], 0
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            break
        chunk = message.get("body", b"")
        size += len(chunk)
        if size > MAX_BODY_BYTES:
            return None
        chunks.append(chunk)
        if not message.get("more_body"):
            break
    return b"".join(chunks)


def _replay(body: bytes, receive):
    """Rend le corps déjà lu au SDK, puis délègue (déconnexion, etc.)."""
    sent = False

    async def replay_receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await receive()
    return replay_receive


def _missing_scope(body: bytes, granted: tuple) -> Optional[str]:
    """Scope manquant pour un `tools/call`, ou None. Corps non JSON : laissé au SDK."""
    try:
        payload = json.loads(body) if body else None
    except (ValueError, UnicodeDecodeError):
        return None
    messages = payload if isinstance(payload, list) else [payload]
    for message in messages:
        if isinstance(message, dict) and message.get("method") == "tools/call":
            params = message.get("params") if isinstance(message.get("params"), dict) else {}
            needed = TOOL_SCOPES.get(params.get("name"))
            if needed and needed not in granted:
                return needed
    return None


class McpEndpoint:
    """Application ASGI montée sur `/api/mcp` (classe : Starlette la traite comme ASGI brute)."""

    # Lu par le middleware SlowAPI pour identifier le point d'entrée
    __name__ = "mcp_endpoint"

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or not mcp_enabled():
            await _send_not_found(send)
            return

        db = db_provider()
        if await oauth_service.kill_switch_active(db):
            await _send_json(send, 503, {"error": "temporarily_unavailable"})
            return

        token = _bearer(scope)
        principal, reason = await oauth_service.validate_access_token(db, token)
        if principal is None:
            error = None if reason == "missing" else "invalid_token"
            logger.info("mcp_auth result=%s", reason)
            await _send_json(send, 401, {"error": error or "unauthorized"}, _challenge(error))
            return

        retry_after = _rate_limited(principal.grant_id)
        if retry_after is not None:
            logger.warning("mcp_rate_limited grant=%s", principal.grant_id[:8])
            await _send_json(send, 429, {"error": "rate_limited"}, [(b"retry-after", str(retry_after).encode())])
            return

        if scope.get("method") == "POST":
            body = await _read_body(receive)
            if body is None:
                await _send_json(send, 413, {"error": "payload_too_large"})
                return
            needed = _missing_scope(body, principal.scopes)
            if needed:
                await _send_json(send, 403, {"error": "insufficient_scope", "scope": needed},
                                 _challenge("insufficient_scope", needed))
                return
            receive = _replay(body, receive)

        reset = current_principal.set(principal)
        try:
            await self._dispatch(scope, receive, send)
        finally:
            current_principal.reset(reset)

    async def _dispatch(self, scope, receive, send) -> None:
        server = await get_server()
        from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
        from mcp.server.transport_security import TransportSecuritySettings

        hosts = allowed_hosts()
        manager = StreamableHTTPSessionManager(
            app=server,
            stateless=True,
            json_response=True,
            security_settings=TransportSecuritySettings(
                allowed_hosts=hosts, allowed_origins=[f"https://{h}" for h in hosts],
            ),
        )
        async with manager.run():
            await manager.handle_request(scope, receive, send)


endpoint = McpEndpoint()
