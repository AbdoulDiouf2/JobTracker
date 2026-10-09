# Installation, configuration et tests

## Prérequis

- Python 3.11 ou 3.12 (la production Vercel utilise 3.12, fichier `.python-version`)
- Node.js 18+ et Yarn 1
- MongoDB 6+ (local, Docker ou Atlas)
- Docker, pour les tests backend qui utilisent une MongoDB éphémère

## Backend

```bash
cd backend
python -m venv venv
# Windows : .\venv\Scripts\activate    Linux/macOS : source venv/bin/activate
pip install -r requirements-dev.txt   # inclut requirements.txt + pytest
cp .env.example .env        # puis renseigner les valeurs
uvicorn server:app --reload --port 8001
```

Le `lifespan` local crée les index MongoDB et démarre le planificateur de rappels.

### Compte administrateur

```bash
cd backend
python seed_admin.py create --email <email> --password <mot-de-passe-robuste> --name "<Nom>"
python seed_admin.py promote <email>      # promouvoir un compte existant
python seed_admin.py list
```

Toujours fournir `--password` : la valeur par défaut du script est faible. Voir aussi
[`backend/ADMIN_SETUP.md`](../backend/ADMIN_SETUP.md).

## Frontend

```bash
cd frontend
yarn install
cp .env.example .env        # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start                  # http://localhost:3000
```

## Variables d'environnement (backend)

Noms seulement : les valeurs ne doivent jamais apparaître dans la documentation, un commit ou
un journal. Référence : `backend/config.py`. La durée des sessions (7 jours) et l'algorithme JWT
(HS256) sont fixés dans le code.

| Variable | Rôle | Par défaut |
|---|---|---|
| `MONGO_URL`, `DB_NAME` | Connexion MongoDB | — |
| `APP_ENV` | `development` / `test` : un secret absent ou faible est remplacé par un secret éphémère. Ailleurs, et toujours sur Vercel Production, il bloque le démarrage | — |
| `JWT_SECRET`, `SECRET_KEY` | Signature des sessions et du `state` Google ; **distincts**, longs, aléatoires | — (obligatoires) |
| `CORS_ORIGINS` | Origines autorisées | — |
| `BACKEND_URL`, `FRONTEND_URL` | URL publiques | `localhost:8001` / `:3000` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Connexion « Continuer avec Google » | — |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | Intégration Google Agenda | — |
| `EMERGENT_LLM_KEY`, `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY` | Clés IA de la plateforme (chaque utilisateur peut aussi saisir les siennes) | — |
| `ENCRYPTION_KEY` | Chiffrement des clés IA des utilisateurs | — |
| `SMTP_*`, `SUPPORT_EMAIL` | E-mails | — |
| `AGENT_RATE_LIMIT`, `AGENT_DAILY_CREATE_QUOTA`, `AGENT_MAX_ACTIVE_TOKENS` | Jetons d'API (Lot 1) | 30/minute, 500/jour/jeton, 10 jetons |
| `WATCH_MAX_PER_RUN`, `WATCH_DAILY_CREATE_QUOTA` | Plafonds de la veille | 20 par exécution, 40 par jour et par compte |
| `WATCH_RUN_WINDOW_PAST_HOURS`, `WATCH_RUN_RESUME_HOURS`, `WATCH_RUN_WINDOW_FUTURE_MINUTES`, `WATCH_ITEM_STALE_SECONDS` | Fenêtres de validité des `run_id` | 6 h, 24 h, 15 min, 60 s |
| `MCP_ENABLED`, `MCP_PRODUCTION_ALLOWED` | Activation du MCP et d'OAuth ; en production Vercel, **les deux** sont requises | `false` |
| `MCP_ALLOWED_HOSTS` | Hôtes acceptés par `/api/mcp` (anti DNS-rebinding) | `jobtracker.maadec.com` |
| `MCP_RATE_LIMIT_PER_MINUTE` | Requêtes MCP par minute et par autorisation | 30 |
| `OAUTH_ISSUER` | Émetteur OAuth ; la ressource MCP vaut émetteur + `/api/mcp` | `https://jobtracker.maadec.com` |
| `OAUTH_ACCESS_TTL_SECONDS`, `OAUTH_REFRESH_TTL_SECONDS`, `OAUTH_GRANT_MAX_SECONDS`, `OAUTH_CODE_TTL_SECONDS`, `OAUTH_REQUEST_TTL_SECONDS`, `OAUTH_REFRESH_REUSE_GRACE_SECONDS` | Durées OAuth | 1 h, 30 j, 90 j, 60 s, 10 min, 30 s |
| `OAUTH_RATE_LIMIT` | `/authorize` et `/token`, par IP | 10/minute |

> **Écart connu** : `backend/.env.example` nomme `GOOGLE_API_KEY`, alors que le code lit
> `GOOGLE_AI_API_KEY`. Utiliser `GOOGLE_AI_API_KEY`.

Vérifier un fichier d'environnement avant déploiement, sans afficher de valeur :
`python scripts/check_signing_secrets.py <fichier.env> --env production`.

Frontend : `REACT_APP_BACKEND_URL` (URL du backend ; en production, l'origine du site).

## Tests

### Backend

Les tests qui touchent MongoDB tournent contre une base **jetable** (conteneur Docker, données
en mémoire, supprimé à la fin) ; sans `MONGO_TEST_URL`, ils sont ignorés.

```bash
cd backend
bash tests/run_mongo_tests.sh                      # suite complète
bash tests/run_mongo_tests.sh tests/test_p3_cimd.py  # un fichier
PY=.venv/Scripts/python.exe MONGO_TEST_PORT=27031 bash tests/run_mongo_tests.sh  # autre interpréteur / port
pytest tests/test_job_urls.py                      # tests sans base
```

`conftest.py` refuse toute `MONGO_TEST_URL` qui ne pointe pas vers `localhost`/`127.0.0.1`.
Ordre de grandeur (octobre 2026) : environ 1185 tests réussis, 1 xfail connu (correctif Gemini
non appliqué, voir [archives](./archives/gemini/CORRECTIF-GEMINI-MODELES.md)).

### Frontend

```bash
cd frontend
CI=true yarn test --watchAll=false
```

Il n'existe pas de script `yarn lint` ; ESLint est appliqué par `craco` au build
(règles `react-hooks`).

### Avant un déploiement

Suites backend et frontend complètes au vert, puis [checklist de non-régression](./DEPLOIEMENT-ET-EXPLOITATION.md#checklist-de-non-régression).
