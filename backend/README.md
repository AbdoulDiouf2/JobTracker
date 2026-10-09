# Backend JobTracker (FastAPI)

API, serveur OAuth 2.1 et serveur MCP de JobTracker.

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows : .\venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn server:app --reload --port 8001
```

- Point d'entrée : `server.py` (local) ; `api/index.py` (Vercel).
- Configuration : `config.py` ; variables listées dans
  [Doc/INSTALLATION-ET-CONFIGURATION.md](../Doc/INSTALLATION-ET-CONFIGURATION.md).
- Organisation des modules : [Doc/ARCHITECTURE.md](../Doc/ARCHITECTURE.md).
- Documentation interactive locale : <http://localhost:8001/docs>.

## Tests

```bash
bash tests/run_mongo_tests.sh                 # suite complète, MongoDB éphémère (Docker)
bash tests/run_mongo_tests.sh tests/<fichier>.py
```

## Scripts

| Script | Usage |
|---|---|
| `seed_admin.py` | Créer, promouvoir ou lister les administrateurs ([ADMIN_SETUP.md](./ADMIN_SETUP.md)) |
| `scripts/manage_oauth_client.py` | Gérer les clients OAuth en ligne de commande (secours ; le panneau d'administration est la voie normale) |
| `scripts/oauth_manual_check.py` | Essai OAuth/MCP sans agent. **Attention** : un nouveau consentement sur un client remplace l'autorisation existante de ce client |
| `scripts/check_signing_secrets.py` | Vérifier `JWT_SECRET` / `SECRET_KEY` d'un fichier d'environnement sans les afficher |
