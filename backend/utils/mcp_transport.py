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

Garde-fous de ce sous-lot (aucune authentification n'existe encore) :
- désactivé par défaut (`MCP_ENABLED=false`) : réponse identique à une route absente ;
- TOUJOURS bloqué en production Vercel (`VERCEL_ENV=production`), même si
  `MCP_ENABLED=true`, jusqu'à la livraison d'OAuth ;
- un seul outil de démonstration, sans accès aux données (`jobtracker_ping`).
"""

import asyncio
import json
import logging
import os
from config import settings

logger = logging.getLogger("jobtracker.mcp")

SERVER_NAME = "JobTracker"
PING_TOOL = "jobtracker_ping"

_server = None
_server_lock = asyncio.Lock()
# Nombre de constructions du serveur MCP dans ce processus (contrôlé par les tests)
build_count = 0

_NOT_FOUND = json.dumps({"detail": "Not Found"}).encode()


def mcp_enabled() -> bool:
    """Actif seulement si demandé explicitement, et jamais en production Vercel avant OAuth."""
    if (os.environ.get("VERCEL_ENV") or "").strip().lower() == "production":
        return False
    return settings.MCP_ENABLED


def allowed_hosts() -> list:
    """Hôtes acceptés (anti DNS-rebinding) : uniquement la liste configurée. Aucun hôte de
    déploiement Vercel n'est ajouté automatiquement (pas de Preview, décision du 8 octobre 2026)."""
    return [h.strip().lower() for h in settings.MCP_ALLOWED_HOSTS.split(",") if h.strip()]


def _build_server():
    """Construit le serveur MCP bas niveau (import différé du SDK)."""
    from mcp import types
    from mcp.server import Server

    ping_tool = types.Tool(
        name=PING_TOOL,
        title="JobTracker : test de connexion",
        description="Vérifie que le serveur MCP de JobTracker répond. Ne lit ni n'écrit aucune donnée.",
        input_schema={"type": "object", "properties": {}, "additionalProperties": False},
        annotations=types.ToolAnnotations(read_only_hint=True, destructive_hint=False, idempotent_hint=True),
    )

    async def on_list_tools(ctx, params) -> types.ListToolsResult:
        return types.ListToolsResult(tools=[ping_tool])

    async def on_call_tool(ctx, params) -> types.CallToolResult:
        if params.name != PING_TOOL:
            return types.CallToolResult(
                content=[types.TextContent(type="text", text=json.dumps({"error": {"code": "unknown_tool"}}))],
                is_error=True,
            )
        payload = {"service": "jobtracker", "transport": "ok"}
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=json.dumps(payload))],
            structured_content=payload,
            is_error=False,
        )

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


async def _send_not_found(send) -> None:
    await send({"type": "http.response.start", "status": 404,
                "headers": [(b"content-type", b"application/json"),
                            (b"content-length", str(len(_NOT_FOUND)).encode())]})
    await send({"type": "http.response.body", "body": _NOT_FOUND})


class McpEndpoint:
    """Application ASGI montée sur `/api/mcp` (classe : Starlette la traite comme ASGI brute)."""

    # Lu par le middleware SlowAPI pour identifier le point d'entrée
    __name__ = "mcp_endpoint"

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or not mcp_enabled():
            await _send_not_found(send)
            return

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
