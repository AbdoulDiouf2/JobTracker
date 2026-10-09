"""
Gestion du client OAuth pré-enregistré du connecteur MCP ChatGPT (Lot 2, D1).

ATTENTION : s'exécute contre la base désignée par MONGO_URL / DB_NAME. Contre la
production, c'est une création d'identifiant réel : autorisation explicite requise.

Usage (depuis backend/) :
  python scripts/manage_oauth_client.py create --name ChatGPT [--redirect-uri URI ...]
  python scripts/manage_oauth_client.py list
  python scripts/manage_oauth_client.py add-redirect-uri --client-id jt_oc_... --redirect-uri URI
  python scripts/manage_oauth_client.py rotate-secret --client-id jt_oc_...
  python scripts/manage_oauth_client.py deactivate --client-id jt_oc_...

`create` et `rotate-secret` affichent le secret UNE SEULE FOIS : le saisir directement dans
la configuration du connecteur ChatGPT, ne jamais le copier ailleurs.
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from config import settings  # noqa: E402
from services import oauth_service  # noqa: E402


async def main(args) -> int:
    client = AsyncIOMotorClient(settings.MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[settings.DB_NAME]
    try:
        if args.command == "create":
            uris = args.redirect_uri or [oauth_service.CHATGPT_DEFAULT_REDIRECT]
            created = await oauth_service.create_client(db, args.name, uris)
            print(f"client_id     : {created['client_id']}")
            print(f"client_secret : {created['client_secret']}   (affiché une seule fois)")
            print(f"redirect_uris : {', '.join(created['redirect_uris'])}")
        elif args.command == "list":
            async for c in db[oauth_service.CLIENTS].find({}, {"_id": 0, "secret_hash": 0}):
                print(f"{c['client_id']}  {c['name']}  actif={c['active']}  redirect_uris={c['redirect_uris']}")
        elif args.command == "add-redirect-uri":
            uris = await oauth_service.add_redirect_uri(db, args.client_id, args.redirect_uri)
            print(f"redirect_uris : {', '.join(uris)}")
        elif args.command == "rotate-secret":
            secret = await oauth_service.rotate_client_secret(db, args.client_id)
            print(f"nouveau client_secret : {secret}   (affiché une seule fois)")
        elif args.command == "deactivate":
            revoked = await oauth_service.deactivate_client(db, args.client_id)
            print(f"client désactivé ; connexions révoquées : {revoked}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Client OAuth du connecteur MCP")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--name", default="ChatGPT")
    create.add_argument("--redirect-uri", action="append", help="URI exacte (répétable)")
    sub.add_parser("list")
    add_uri = sub.add_parser("add-redirect-uri")
    add_uri.add_argument("--client-id", required=True)
    add_uri.add_argument("--redirect-uri", required=True, help="URI exacte, HTTPS")
    for name in ("rotate-secret", "deactivate"):
        sub.add_parser(name).add_argument("--client-id", required=True)
    sys.exit(asyncio.run(main(parser.parse_args())))
