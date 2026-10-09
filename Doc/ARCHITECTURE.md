# Architecture de JobTracker

> État au 10 octobre 2026, branche `main`. Ce document décrit le code réellement présent ;
> en cas de doute, le code et les tests font foi.

## Vue d'ensemble

```
Navigateur ──► jobtracker.maadec.com (Vercel)
                 ├── /            → frontend React (build statique)
                 ├── /api/*       → backend FastAPI (fonction Python serverless)
                 ├── /api/mcp     → serveur MCP (transport HTTP, OAuth 2.1)
                 └── /.well-known/oauth-* → découverte OAuth (backend)
Backend ──► MongoDB (Motor, asynchrone)
Agents externes (ChatGPT, Claude, Claude Code…) ──OAuth + MCP──► /api/mcp
Extension Chrome ──JWT « extension »──► /api/*
```

Un seul projet Vercel sert le frontend et le backend (`vercel.json`, builds « legacy »).
Le backend est importé par `backend/api/index.py`, version de Python fixée par
`.python-version` (3.12).

## Backend (`backend/`)

| Élément | Rôle |
|---|---|
| `server.py` | Application FastAPI : CORS, limiteur slowapi, `lifespan` (index MongoDB, planificateur), routeurs sous `/api`, routeur `.well-known`, montage de `/api/mcp` |
| `config.py` | Réglages lus dans l'environnement ; garde « S3 » : en production, un `JWT_SECRET`/`SECRET_KEY` absent, faible ou d'exemple bloque le démarrage |
| `models/__init__.py`, `models/watch.py` | Modèles Pydantic v2 (candidatures, opportunités, veille, OAuth…) |
| `routes/` | Une route par domaine (voir ci-dessous) |
| `services/` | Logique métier : `opportunity_service`, `watch_ingest_service`, `watch_preferences_service`, `agent_token_service`, `oauth_service`, `cimd_service`, `mcp_tools`… |
| `utils/` | Authentification JWT, `mcp_transport` (MCP), `watch_validation` (règles de la veille), `job_urls` (normalisation des URL), planificateur, chiffrement… |
| `scripts/` | Administration ponctuelle : `manage_oauth_client.py` (clients OAuth), `oauth_manual_check.py` (essai OAuth/MCP sans ChatGPT), `check_signing_secrets.py` (contrôle des secrets avant déploiement) |
| `seed_admin.py` | Création ou promotion d'un compte administrateur |
| `tests/` | Tests pytest (unitaires et intégration avec MongoDB éphémère) |

### Routes (`/api/...`)

| Préfixe | Fichier | Domaine |
|---|---|---|
| `/auth` | `routes/auth.py` | Inscription, connexion, Google OAuth (connexion utilisateur), profil, codes extension |
| `/applications` | `applications.py`, `tracking.py` | Candidatures et suivi |
| `/interviews` | `interviews.py` | Entretiens |
| `/statistics` | `statistics.py` | Tableau de bord |
| `/opportunities` | `opportunities.py` | Opportunités : liste filtrée, facettes, création, ignorer, convertir |
| `/watch` | `watch.py` | Veille : préférences, état, historique des exécutions (API, sans interface) |
| `/agent-tokens`, `/agent` | `agent_tokens.py`, `agent.py` | Jetons d'API (Lot 1) et dépôt d'opportunités par un agent |
| `/oauth` (+ `.well-known`) | `oauth.py` | Serveur d'autorisation OAuth 2.1 du connecteur MCP |
| `/admin` | `admin.py` | Administration (utilisateurs, veille, OAuth/MCP, interrupteur d'urgence, CIMD…) |
| `/ai`, `/documents`, `/export`, `/import`, `/notifications`, `/calendar`, `/reminders`, `/onboarding`, `/contact`, `/search` | fichiers homonymes | Fonctions annexes |

`/api/mcp` n'est pas un routeur FastAPI : c'est une application ASGI (`utils/mcp_transport.py`)
montée par `app.add_route`.

### Planificateur

`utils/scheduler.py` (APScheduler) gère les rappels. Il est démarré dans le `lifespan`, **qui ne
s'exécute pas sur Vercel** : les rappels planifiés ne fonctionnent qu'en exécution locale ou
sur un hébergement long. Pour la même raison, les index MongoDB sont aussi créés
« paresseusement » par les services.

## Base de données (MongoDB)

Collections principales :

| Collection | Contenu |
|---|---|
| `users` | Comptes (`role`, `is_active`, `watch_enabled`, clés IA chiffrées…) |
| `applications`, `interviews`, `documents`… | Données de suivi |
| `opportunities` | Offres repérées (statut `new`/`ignored`/`converted`, `source`, sous-document `watch`) |
| `agent_tokens` | Jetons d'API (hachés) |
| `watch_preferences` | Critères de veille versionnés, un document par compte |
| `watch_runs`, `watch_run_items`, `watch_usage` | Exécutions de veille, éléments rejouables, quotas journaliers |
| `oauth_clients`, `oauth_requests`, `oauth_codes`, `oauth_grants`, `oauth_tokens` | Serveur OAuth (secrets et jetons **hachés**) |
| `platform_settings` | Réglages globaux : `mcp_kill_switch`, `oauth_cimd_policy`, quotas IA |

Les dates des opportunités sont stockées en ISO 8601 UTC (chaînes).

## Frontend (`frontend/`)

React 19 (Create React App via `craco`), Tailwind CSS, composants Shadcn (`src/components/ui`),
TanStack Query, React Router 7, Framer Motion, Recharts, `sonner`, `lucide-react`.

| Élément | Rôle |
|---|---|
| `src/App.js` | Routage : pages publiques, `/dashboard/*`, `/admin/*`, `/oauth/consent` |
| `src/pages/` | Pages (tableau de bord, opportunités, candidatures, paramètres, consentement OAuth…) |
| `src/components/opportunities/` | Cartes, détail, filtres des opportunités |
| `src/components/settings/` | Paramètres → API / Agents (jetons, connexions OAuth / MCP) |
| `src/hooks/` | Accès API via TanStack Query |
| `src/lib/` | Logique pure (filtres ↔ URL, retour OAuth sûr) |
| `src/i18n/` | Français / anglais |
| `src/__tests__/` | Tests Jest / Testing Library |

## Autres dossiers

| Dossier | Contenu |
|---|---|
| `chrome-extension/` | Extension « JobTracker Clipper » ([README](../chrome-extension/README.md), [déploiement](../chrome-extension/DEPLOYMENT.md)) |
| `landing-page/` | Site vitrine |
| `Doc/` | Documentation (ce dossier) ; `Doc/archives/` : documents historiques |
| `tests/` (racine), `test_reports/` | Restes de l'époque Emergent (paquet vide, rapports JSON) ; les tests actuels sont dans `backend/tests/` et `frontend/src/__tests__/` |

## Voir aussi

- [Installation et configuration](./INSTALLATION-ET-CONFIGURATION.md)
- [Fonctionnalités](./FONCTIONNALITES.md)
- [OAuth](./OAUTH.md) · [Référence MCP](./MCP-REFERENCE.md)
