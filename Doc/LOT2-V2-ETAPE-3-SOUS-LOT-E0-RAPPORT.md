# JobTracker — Lot 2 V2 · Étape 3, sous-lot E0 : rapport de validation locale

> **Référence** : décisions V1 à V5 (8 octobre 2026) ·
> [LOT2-V2-ETAPE-3-E0-CONTROLES.md](./LOT2-V2-ETAPE-3-E0-CONTROLES.md) · **Preview retirée le
> 8 octobre 2026** : voir le [protocole de déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md)
> et le [rapport complémentaire](./LOT2-V2-ETAPE-3-SOUS-LOT-E0-COMPLEMENT.md).
> **Date** : 8 octobre 2026 · **Statut** : **modifications locales terminées, en attente de
> revue**. Aucun commit, push, déploiement (Preview ou production) ni modification de
> production. Ni serveur OAuth ni outil métier MCP.

## 1. Résultat

Suite backend complète (15 fichiers), MongoDB 7 éphémère, sur **trois piles** :

| Pile | Python | Résultat |
|---|---|---|
| `backend/.venv` **neuf** (versions figées) | 3.11.9, Windows | **658 réussis**, 0 échec |
| `backend/venv` existant, mis à jour sur place (§4) | 3.11.9, Windows | **658 réussis**, 0 échec |
| Conteneur `python:3.12-slim` (comme le runtime Vercel par défaut) | **3.12.15, Linux** | **656 réussis, 2 ignorés**, 0 échec |

Les 2 tests ignorés sous Linux sont des tests S3 qui lisent l'**historique git**, absent de la
copie montée dans le conteneur (« historique git indisponible »). Ils passent sur les deux
piles Windows.

**Décompte** : 618 tests de l'étape 2 + **40 nouveaux** (`test_vercel_routing.py` : 17 ;
`test_mcp_transport.py` : 23) = **658**.

## 2. Travaux réalisés

| # | Demande | Réalisation | Fichiers |
|---|---|---|---|
| 1 | Correctif `vercel.json` (V1) | 3 règles explicites `/.well-known/oauth-protected-resource(.*)`, `oauth-authorization-server(.*)` et `openid-configuration(.*)` → backend, **avant** les règles du frontend. Re-simulé avec `@vercel/routing-utils` sur le fichier réel. Test automatique ajouté | `vercel.json`, `tests/test_vercel_routing.py` |
| 2 | Aligner les dépendances (V3) | Dépendances directes **figées** sur la résolution Linux / Python 3.12 (runtime Vercel par défaut) ; `starlette` et `mcp==2.3.0` ajoutés ; outils de test dans `requirements-dev.txt` ; venv neuf `backend/.venv` | `requirements.txt`, `requirements-dev.txt`, `tests/run_mongo_tests.sh` (variable `PY`) |
| 3 | Transport MCP, API publiques (V4) | `mcp.server.Server` (bas niveau, public) avec `on_list_tools` et `on_call_tool` ; `StreamableHTTPSessionManager` **créé par requête** (sans état, JSON) ; route ASGI `/api/mcp` ; un seul outil de démonstration `jobtracker_ping` (lecture, aucune donnée). **Aucun attribut privé** du SDK | `utils/mcp_transport.py`, `server.py`, `config.py`, `.env.example` |
| 4 | Chargement différé et concurrence (V5) | SDK importé au **premier appel MCP** seulement ; serveur construit **une fois** par instance (verrou) ; 30 appels concurrents testés | `tests/test_mcp_transport.py` |
| 5 | Protocole de validation | Protocole Preview **remplacé** (décision du 8 octobre 2026) par le déploiement contrôlé | [LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md) |

### 2.1 Garde-fous du transport MCP (aucune authentification n'existe encore)

| Garde-fou | Effet | Test |
|---|---|---|
| `MCP_ENABLED=false` par défaut | `/api/mcp` répond **exactement** comme une route absente (404 `{"detail":"Not Found"}`, quelle que soit la méthode) | Oui |
| Blocage en production Vercel | `VERCEL_ENV=production` → 404, **même si `MCP_ENABLED=true`**. À lever uniquement quand OAuth sera livré | Oui |
| Hôtes autorisés (anti *DNS rebinding*) | `jobtracker.maadec.com` seulement ; sur Preview, les hôtes du déploiement (`VERCEL_URL`, `VERCEL_BRANCH_URL`) sont ajoutés automatiquement ; tout autre hôte → **421** ; alias `*.vercel.app` refusé hors Preview | Oui |
| Origine étrangère | **403** | Oui |
| Outil unique sans donnée | `jobtracker_ping` → `{"service":"jobtracker","transport":"ok"}`, `readOnlyHint: true` ; outil inconnu → `isError: true` | Oui |

### 2.2 Chargement différé (V5), vérifié dans un processus neuf

| Moment | SDK `mcp` chargé ? |
|---|---|
| Après le démarrage de l'application | **Non** |
| Après un appel à une autre route | **Non** |
| Après un appel à `/api/mcp` désactivé | **Non** |
| Après le premier appel MCP actif (200) | **Oui** |

Les autres routes de JobTracker (interface, extension, API agent) ne paient donc **jamais**
l'import du SDK.

### 2.3 Concurrence

30 requêtes simultanées (`initialize`, `tools/list`, `tools/call`) sur une instance froide,
répétées 5 fois : **30 × 200** à chaque fois. Chaque réponse correspond à sa requête
(identifiants JSON-RPC), et le serveur MCP n'est construit **qu'une seule fois**.

## 3. Dépendances (V3)

### 3.1 Méthode

1. Résolution de `requirements.txt` + `mcp==2.3.0` dans un conteneur **Linux / Python 3.12**
   (`python:3.12-slim`) : `pip check` sans erreur.
2. Chaque dépendance directe est figée (`==`) sur la version obtenue. `starlette` est épinglé
   explicitement, puisqu'il est imposé par FastAPI.
3. Venv neuf `backend/.venv` (Python 3.11.9, Windows) à partir de `requirements-dev.txt` :
   `pip check` sans erreur.
4. Suite complète sur trois piles (§1).

### 3.2 Écarts avec l'ancien venv local

| Paquet | Ancien venv local | Figé | Remarque |
|---|---|---|---|
| `fastapi` | 0.110.1 | **0.143.0** | |
| `starlette` | 0.37.2 | **1.7.0** | Version majeure |
| `uvicorn` | 0.25.0 | 0.54.0 | |
| `pydantic` | 2.12.5 | 2.14.0 | |
| `openai` | 1.99.9 | **3.26.1** | Version majeure (§5) |
| `google-genai` | 1.62.0 | **2.29.0** | Version majeure (§5) |
| `groq` | 1.0.0 | 1.7.0 | |
| `motor` | 3.3.1 | 3.7.1 | |
| `svglib` | 1.6.0 | 1.5.1 | Déjà épinglé dans `requirements.txt` ; le venv local s'en écartait |
| `mcp` | — | **2.3.0** | Nouveau |

**Important** : jusqu'ici, `requirements.txt` n'était pas figé (`>=`). Vercel installe donc
**les dernières versions à chaque déploiement**. La production a vraisemblablement déjà
installé des versions proches de celles qui sont figées, sans qu'on puisse le vérifier ici.
Les figer rend les prochains déploiements **reproductibles**.

## 4. Incident pendant la reconstruction du venv

- **Ce qui s'est passé** : le déplacement de l'ancien `backend/venv` vers le scratchpad a
  échoué (`Permission denied`) : **ton serveur de développement** (`uvicorn server:app --reload
  --port 8001`, PID 21756) tourne depuis ce venv et en verrouille les fichiers. Ma commande
  enchaînait la suite avec `;` au lieu de `&&`, et l'installation des versions figées s'est
  faite **dans l'ancien venv, mis à jour sur place**. Je ne l'ai pas arrêté.
- **État actuel** :
  - `backend/venv` (utilisé par ton serveur et par défaut par le script de tests) : versions
    figées installées, `pip check` OK, mais il contient encore **60 paquets hérités** hors
    `requirements.txt` (litellm, pandas, boto3, mypy…) ;
  - `backend/.venv` : **venv neuf et propre** (ignoré par git).
- **Retour arrière possible** : la liste exacte des anciennes versions est sauvegardée
  (`freeze-old-venv.txt`, scratchpad, 161 paquets).
- **À faire de ton côté, si tu valides** : arrêter le serveur de développement, puis remplacer
  `backend/venv` par le venv neuf, ou le recréer. Ton serveur de développement a peut-être
  rechargé l'application avec les nouvelles versions : à redémarrer après le remplacement.

## 5. Limites et risques

1. **SDK d'IA en version majeure** (`openai` 3.x, `google-genai` 2.x) : les méthodes et
   arguments utilisés par le code (`chat.completions.create` avec `model`, `messages`,
   `response_format` ; `models.generate_content` ; `.text`) **existent** dans les versions
   figées (vérification statique, sans appel réseau). Le comportement réel des appels d'IA
   **n'est pas testé** : aucun test ne les couvre et aucune clé n'a été utilisée. À contrôler
   manuellement sur la Preview, ou à comparer avec les versions déjà installées en production
   (journal de build Vercel du dernier déploiement).
2. **Version de Python** : local en 3.11, Vercel en 3.12 par défaut. La suite tourne sur les
   deux (§1). Pas de fichier `.python-version` ajouté : la production reste sur le comportement
   par défaut de Vercel. À figer plus tard si tu le souhaites.
3. **Démarrage à froid** : toujours à mesurer sur Vercel (protocole Preview, O4).
4. **Protection des Preview** : ChatGPT ne peut pas joindre une Preview protégée. Le test E0
   (OAuth avec ChatGPT) se fera donc plus tard, en production derrière les garde-fous.
5. **Prérequis S3 sur Preview** : si `JWT_SECRET` ou `SECRET_KEY` manquent en portée Preview,
   la fonction refusera de démarrer (comportement voulu). À vérifier avant le premier
   déploiement Preview (P2 du protocole).

## 6. Fichiers modifiés

| Fichier | Nature |
|---|---|
| `vercel.json` | 3 règles de réécriture |
| `backend/requirements.txt` | Versions figées, `starlette`, `mcp` |
| `backend/requirements-dev.txt` | **Nouveau** (`pytest`) |
| `backend/utils/mcp_transport.py` | **Nouveau** |
| `backend/server.py` | Route `/api/mcp` |
| `backend/config.py`, `backend/.env.example` | `MCP_ENABLED`, `MCP_ALLOWED_HOSTS` |
| `backend/tests/test_vercel_routing.py`, `backend/tests/test_mcp_transport.py` | **Nouveaux** |
| `backend/tests/run_mongo_tests.sh` | Variable `PY` ; nouveaux fichiers dans la liste |

**Statut** : résultats techniques validés le 8 octobre 2026, sous réserve du
[rapport complémentaire](./LOT2-V2-ETAPE-3-SOUS-LOT-E0-COMPLEMENT.md).
