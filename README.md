# JobTracker

<p align="center"><img src="public/JobTracker-Logo.png" alt="JobTracker" width="520"></p>

Application SaaS de suivi de recherche d'emploi : candidatures, entretiens, statistiques,
conseiller IA, et une **boîte de réception d'opportunités** alimentée par des agents IA
externes (ChatGPT, Claude, Claude Code…) via un serveur **MCP** protégé par **OAuth 2.1**.

Production : <https://jobtracker.maadec.com> (Vercel).

## En bref

- **Frontend** : React 19, Tailwind CSS, Shadcn UI, TanStack Query (`frontend/`).
- **Backend** : FastAPI, Pydantic v2, MongoDB via Motor (`backend/`).
- **MCP** : `https://jobtracker.maadec.com/api/mcp`, six outils (veille et diagnostic).
- **OAuth** : clients confidentiels (P1), clients publics et retours locaux (P2), Client ID
  Metadata Documents (P3). Pas d'enregistrement dynamique (DCR).
- Les agents **cherchent** les offres ; JobTracker **valide, déduplique et enregistre**.

## Démarrage rapide

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows : .\venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                               # renseigner les valeurs
uvicorn server:app --reload --port 8001

# Frontend (autre terminal)
cd frontend
yarn install
cp .env.example .env                               # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

Tests : `cd backend && bash tests/run_mongo_tests.sh` (Docker requis) ·
`cd frontend && CI=true yarn test --watchAll=false`.

Détails : [installation, variables et tests](Doc/INSTALLATION-ET-CONFIGURATION.md).

## Documentation

| Sujet | Document |
|---|---|
| Index complet | [Doc/README.md](Doc/README.md) |
| Architecture | [Doc/ARCHITECTURE.md](Doc/ARCHITECTURE.md) |
| Fonctionnalités | [Doc/FONCTIONNALITES.md](Doc/FONCTIONNALITES.md) |
| Serveur MCP (six outils) | [Doc/MCP-REFERENCE.md](Doc/MCP-REFERENCE.md) |
| OAuth P1 / P2 / P3 (CIMD) | [Doc/OAUTH.md](Doc/OAUTH.md) |
| Connecter ChatGPT, Claude, Claude Code, Codex, VS Code | [Doc/GUIDES-CONNEXION.md](Doc/GUIDES-CONNEXION.md) |
| Veille programmée | [Doc/VEILLE-PROGRAMMEE.md](Doc/VEILLE-PROGRAMMEE.md) |
| Sécurité | [Doc/SECURITE.md](Doc/SECURITE.md) |
| Déploiement et exploitation | [Doc/DEPLOIEMENT-ET-EXPLOITATION.md](Doc/DEPLOIEMENT-ET-EXPLOITATION.md) |
| Historique, décisions, état réel | [Doc/HISTORIQUE-ET-DECISIONS.md](Doc/HISTORIQUE-ET-DECISIONS.md) |

## Organisation du dépôt

```
backend/            API FastAPI, serveur OAuth et MCP, tests (backend/tests)
frontend/           Application React, tests (frontend/src/__tests__)
chrome-extension/   Extension « JobTracker Clipper »
landing-page/       Site vitrine
Doc/                Documentation ; Doc/archives : documents historiques
vercel.json         Déploiement (frontend statique + backend serverless)
```

## Auteur

Abdoul — Data Engineer. JobTracker ne promet pas de miracle : il aide à rester organisé.
