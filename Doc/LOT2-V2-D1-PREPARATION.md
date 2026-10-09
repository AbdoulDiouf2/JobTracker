# JobTracker — Lot 2 V2 · Préparation du déploiement D1 (dormant)

> **Date** : 9 octobre 2026 · **Statut** : **prêt pour revue, D1 non autorisé**.
> Aucun commit, push ni déploiement. Serveur Uvicorn non touché. Aucune tâche ChatGPT
> modifiée. Les cinq outils métier MCP ne sont pas commencés.
> Références : [protocole de déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md) ·
> [checklist avant D1](./LOT2-V2-CHECKLIST-AVANT-D1.md).

## 1. Travaux de cette passe

| # | Demande | Résultat |
|---|---|---|
| 1 | Test du Lot 1 dépendant de minuit UTC | **Horloge figée** : fixture automatique qui fixe uniquement le jour du quota (`agent_token_service._today`) dans les 3 fichiers concernés (6 assertions exposées, pas une seule). **Logique métier des quotas inchangée** (aucun diff sur `agent_token_service.py`). Nouveau test : le compteur repart bien à zéro au changement de jour UTC (simulé) |
| 2 | Relance des suites | §6 |
| 3 | Manifeste | §2 |
| 4 | Checklist opérationnelle D1 | §3 et §4 |
| 5 | MCP inaccessible en production | §5. **Défaut trouvé et corrigé** : en production, 4 routes OAuth protégées par session répondaient **401** (au lieu de 404), ce qui révélait leur existence. Le contrôle d'activation est désormais évalué **avant** l'authentification ; un test de non-régression a été ajouté |

## 2. Manifeste des fichiers

### 2.1 Lot 2 — code applicatif (à déployer en D1)

| Fichier | État | Sous-lot |
|---|---|---|
| `backend/models/watch.py` | Nouveau | Étape 2 : modèles de veille |
| `backend/utils/watch_validation.py` | Nouveau | Étape 2 : `run_id`, URL (Public Suffix List), normalisations |
| `backend/services/watch_preferences_service.py` | Nouveau | Étape 2 : préférences versionnées |
| `backend/services/watch_ingest_service.py` | Nouveau | Étape 2 : ingestion, idempotence, quotas |
| `backend/routes/watch.py` | Nouveau | Étape 2 : `/api/watch/*` |
| `backend/models/__init__.py` | Modifié (+21) | Étape 2 : `watch`, `watch_enabled`, source réservée |
| `backend/services/opportunity_service.py` | Modifié (+9 −1) | Étape 2 : paramètre optionnel `watch` |
| `backend/routes/opportunities.py`, `backend/routes/agent.py` | Modifiés (+4, +4 −1) | Étape 2 : `chatgpt_watch` réservée (P3) |
| `backend/utils/mcp_transport.py` | Nouveau | Sous-lot E0 et OAuth : transport MCP, 5 contrôles |
| `backend/services/oauth_service.py` | Nouveau | OAuth : serveur d'autorisation |
| `backend/routes/oauth.py` | Nouveau | OAuth : routes, ticket, découverte |
| `backend/routes/admin.py` | Modifié (+53) | `watch_enabled` (D7), interrupteur d'urgence |
| `backend/server.py` | Modifié (+17) | Branchement des routes, de la découverte et du transport |
| `backend/config.py` | Modifié (+40) | Réglages `WATCH_*`, `MCP_*`, `OAUTH_*` bornés |
| `backend/scripts/manage_oauth_client.py` | Nouveau | OAuth : gestion du client (exécution sur autorisation) |
| `frontend/src/pages/OAuthConsentPage.jsx` | Nouveau | Consentement |
| `frontend/src/lib/oauthReturn.js` | Nouveau | Consentement : retour sûr, navigation |
| `frontend/src/App.js` (+4), `LoginPage.jsx` (+3 −1), `AuthCallback.jsx` (+6 −1) | Modifiés | Consentement : route, retour après connexion |

### 2.2 Lot 2 — configuration de build et de déploiement

| Fichier | État | Effet |
|---|---|---|
| `vercel.json` | Modifié (+35) | 3 réécritures `/.well-known/*` → backend ; en-têtes anti-*clickjacking* sur `/oauth…` |
| `backend/requirements.txt` | Modifié (+35 −28) | Versions figées (Linux, Python 3.12) ; `tzdata`, `publicsuffixlist`, `mcp==2.3.0` |
| `.python-version` | Nouveau | `3.12` |
| `backend/.env.example` | Modifié (+22) | Documentation des réglages, sans secret |

### 2.3 Lot 2 — tests (non déployés en pratique, versionnés)

| Fichier | État | Tests |
|---|---|---|
| `backend/tests/test_watch_validation.py`, `test_watch_preferences.py`, `test_watch_ingest.py`, `test_watch_api.py` | Nouveaux | Étape 2 |
| `backend/tests/test_vercel_routing.py`, `test_mcp_transport.py`, `test_ai_sdk_offline.py` | Nouveaux | Sous-lot E0 |
| `backend/tests/test_oauth.py` | Nouveau | OAuth et consentement |
| `backend/tests/test_agent_api.py`, `test_agent_token_service.py`, `test_lot1_e2e.py` | Modifiés | Source `veille_externe` (P3) ; horloge figée |
| `backend/tests/run_mongo_tests.sh` | Modifié | Liste des fichiers ; variable `PY` |
| `backend/requirements-dev.txt` | Nouveau | `pytest` (non installé par Vercel) |
| `frontend/src/__tests__/OAuthConsentPage.test.jsx`, `oauthReturn.test.jsx` | Nouveaux | Consentement |

### 2.4 Documentation

- `Doc/LOT1-OPPORTUNITES-CHECKPOINT.md` (modifié : exemple de l'API agent avec `external_agent`).
- **Nouveaux** : `Doc/CDC-LOT2-JOBTRACKER-V2.md`, `LOT2-AUDIT-FAISABILITE.md`,
  `LOT2-V2-ETAPE-0-*.md`, `LOT2-V2-PROTOCOLE-P0-P3.md`, `LOT2-V2-ETAPE-1-SPECIFICATION.md`,
  `LOT2-V2-ETAPE-2-*.md`, `LOT2-V2-ETAPE-3-*.md`, `LOT2-V2-CHECKLIST-AVANT-D1.md`, ce
  document.
- `Doc/Lot 2 - Integration de la veille ChatGTP.md` : ton document d'origine, non modifié.

### 2.5 Correctif Gemini — SÉPARÉ, hors D1

| Fichier | Rôle |
|---|---|
| `Doc/CORRECTIF-GEMINI-MODELES.patch` (SHA-256 `fe6c8e1b8230073e…`) | Patch de 8 fichiers, **non appliqué** |
| `Doc/CORRECTIF-GEMINI-MODELES.md` | Documentation et vérifications |
| `Doc/verifier-modeles-gemini.py` | Vérification de l'accès aux modèles, à lancer par toi avec ta clé |

**Aucun fichier du correctif n'est présent dans l'arbre de travail** (`utils/ai_models.py`
absent). Le seul lien est un test du Lot 2 (`test_ai_sdk_offline.py`) dont le `xfail` devient
un test normal si le correctif est appliqué.

### 2.6 Local uniquement, jamais versionné

`backend/.venv` (venv neuf) et `backend/venv` (ton venv mis à jour sur place), tous deux
ignorés par git ; `frontend/build` (ignoré).

### 2.7 Proposition de découpage des commits (sur autorisation)

1. `feat(watch): watch preferences, ingestion, quotas and reserved source` (étape 2)
2. `feat(mcp): vercel routing, pinned dependencies and dormant MCP transport` (sous-lot E0)
3. `feat(oauth): OAuth 2.1 server for the MCP connector` (backend OAuth)
4. `feat(oauth): consent page` (frontend)
5. `test(lot1): freeze quota day in date-dependent tests`
6. `docs(lot2): specification, protocols and reports`

## 3. Checklist opérationnelle D1

### 3.1 Variables d'environnement (Vercel, portée **Production**)

| Variable | État requis pour D1 | Remarque |
|---|---|---|
| `MONGO_URL`, `DB_NAME`, `ENCRYPTION_KEY`, `FRONTEND_URL`, SMTP, Google OAuth… | **Inchangées** | Existantes |
| `JWT_SECRET`, `SECRET_KEY` | **Présentes**, inchangées (S3) | Le démarrage échoue sinon (protection voulue) |
| `MCP_ENABLED` | **Absente** (ou `false`) | Même posée par erreur, le code bloque le MCP en production (§5) |
| `MCP_ALLOWED_HOSTS`, `OAUTH_*`, `WATCH_*` | **Absentes** | Valeurs par défaut de la spécification |
| `GEMINI_DEFAULT_MODEL`, `GEMINI_LITE_MODEL` | **Absentes** | Correctif Gemini hors D1 |
| `REACT_APP_BACKEND_URL` (build du frontend) | Inchangée | Sert aussi d'origine autorisée pour la page de consentement (dormante en D1) |

**Aucune variable à créer ni à modifier pour D1.**

### 3.2 État des interrupteurs après D1

| Interrupteur | État | Effet |
|---|---|---|
| `MCP_ENABLED` | Absent | MCP, OAuth et découverte → 404 |
| Blocage de production dans le code | Actif | Idem, même si `MCP_ENABLED=true` |
| `platform_settings.mcp_kill_switch` | Absent (= inactif) | Sans effet tant que le MCP est fermé |
| `watch_enabled` | Absent pour tous les comptes | `/api/watch/*` → 403 |
| Client OAuth | **Aucun** en base | Rien ne peut s'authentifier |

### 3.3 Contrôles avant le déploiement

| # | Contrôle | Qui | État |
|---|---|---|---|
| P1 | Suites backend Windows et Linux, frontend, build | Moi | §6 |
| P2 | Checklist avant D1, parties A et B : versions du dernier build, clients `chatgpt_watch`, existence des secrets | Toi | À faire |
| P3 | Revue du diff (manifeste §2) | Toi | À faire |
| P4 | 🔒 Autorisation de commit puis de push sur `main` | Toi | — |

### 3.4 Vérification des routes après déploiement (lecture seule, anonyme)

| # | Requête | Attendu |
|---|---|---|
| R1 | `GET /api/health` | 200 `healthy` |
| R2 | `GET /.well-known/oauth-protected-resource`, `…/api/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration` | **404 `application/json`** (preuve du routage E0a, plus de HTML) |
| R3 | `GET` et `POST /api/mcp` | 404 JSON |
| R4 | `GET /api/oauth/authorize`, `POST /api/oauth/token`, `GET /api/oauth/continue`, `GET /api/oauth/grants` | 404 JSON (pas 401) |
| R5 | `curl -sI https://jobtracker.maadec.com/oauth/consent` | 200 HTML avec `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Cache-Control: no-store` |
| R6 | `GET /.well-known/security.txt`, `/`, `/manifest.json` | Frontend inchangé |
| R7 | Connecté (ton compte) : `GET /api/watch/status` | 403 `watch_not_enabled` |

### 3.5 Non-régression après déploiement (contrôles C1 à C10 du protocole)

- **C1, journal de build** : Python 3.12 lu depuis `.python-version` ; installation des versions
  figées (dont `openai` 3.26.1, `google-genai` 2.29.0, `mcp` 2.3.0) ; taille de la fonction.
- **Fonctions** : connexion (mot de passe et Google), candidatures, Opportunités (liste et
  conversion), jetons agent (ingestion avec une source autre que `chatgpt_watch`), extension
  Chrome.
- **IA (C7)**, avec ta clé : OpenAI et Groq doivent fonctionner. **Google échouera très
  probablement, comme aujourd'hui** (modèles Gemini arrêtés, correctif séparé non inclus) : ce
  n'est pas une régression de D1, à vérifier en comparant avec l'avant D1.
- Journaux Vercel pendant 24 h : pas de hausse des 5xx.

### 3.6 Retour arrière

| Niveau | Action | Délai | Effet |
|---|---|---|---|
| 1 | Vercel → Deployments → déploiement précédent (`ef07ab6`) → **Instant Rollback** | Immédiat | Code, routage et dépendances précédents |
| 2 | Revert des commits sur `main`, puis push (🔒) | Quelques minutes | Historique propre |

**Aucune migration de données** : les nouvelles collections (`watch_*`, `oauth_*`) ne sont
créées qu'au premier usage, ce qui ne peut pas arriver en D1 (tout est fermé). Aucune variable
à restaurer.

## 4. Après GO D1 (non autorisé aujourd'hui)

Paliers A1 à A4 du protocole : `watch_enabled` sur ton compte, levée du blocage de production
conditionnée à OAuth (décision et changement de code revus), création du client avec
`manage_oauth_client.py`, puis protocole E0 avec ChatGPT.

## 5. Confirmation : MCP inaccessible en production, aucun outil métier exposé

**Vérification exécutée** : application réelle dans un processus isolé simulant la production
Vercel (`VERCEL_ENV=production`), **avec `MCP_ENABLED=true`** (le pire cas d'erreur de
configuration), des secrets aléatoires jetables et une base **injoignable** (jamais
contactée).

| Requête (avec un faux jeton Bearer) | Statut |
|---|---|
| `POST` et `GET /api/mcp` | **404** |
| 4 chemins `/.well-known/*` | **404** |
| `/api/oauth/authorize`, `token`, `revoke`, `continue`, `requests/{id}`, `consent`, `grants` | **404** (les 4 dernières répondaient 401 avant correction) |

- `mcp_enabled()` vaut `False` ; le **SDK `mcp` n'est pas chargé** ; le **serveur MCP n'est
  pas construit**.
- **Outils déclarés : `jobtracker_ping` uniquement** (démonstration, aucune donnée lue ni
  écrite). Aucun des cinq outils métier n'existe dans le code.
- **L'ingestion de veille n'a aucune route HTTP** (test `test_no_http_ingestion_route`).
- Tests permanents : `test_blocked_in_vercel_production` (OAuth et découverte),
  `test_blocked_in_vercel_production_even_if_enabled` (MCP) et
  `test_inactive_service_hides_session_routes` (nouveau, 12 cas).

## 6. Résultats des suites

| Suite | Windows, Python 3.11 | Linux, Python 3.12 |
|---|---|---|
| 3 fichiers corrigés (horloge figée) | **66 réussis** | **66 réussis** |
| **Backend complet** (17 fichiers) | **818 réussis, 1 xfail**, 0 échec | **816 réussis, 2 ignorés, 1 xfail**, 0 échec |
| Frontend (`yarn test`), inchangé depuis le sous-lot consentement | **89 réussis** | — |
| `yarn build` | **Compiled successfully** | — |

- **Décompte backend** : 806 + 1 (changement de jour UTC) + 12 (routes masquées quand le
  service est inactif) = **819** sur chaque plateforme.
- **xfail** : défaut de la lettre vide, corrigé par le correctif Gemini séparé.
- **2 ignorés** sous Linux : tests lisant l'historique git, absent du conteneur.
- Aucun conteneur de test ne reste actif.

## 7. Derniers contrôles préalables (9 octobre 2026)

### 7.1 Versions du dernier build de production

| Élément | Constat | Source |
|---|---|---|
| Dernier déploiement de production | **`ef07ab6`**, statut *success*, 8 octobre 2026 à 01:22 UTC | API GitHub publique (déploiements), lecture seule |
| Journal de build Vercel | **Non accessible** : pas de CLI Vercel, pas de jeton, lien du journal protégé par la connexion Vercel | — |
| Python | **Non relevé**. Aucun fichier ne fixait la version dans `ef07ab6` : le comportement documenté de Vercel est 3.12 par défaut (déduction, pas une mesure) | Documentation Vercel |
| FastAPI, Starlette, OpenAI, Google GenAI | **Non relevées**. `requirements.txt` n'était pas figé (`>=`) : le build du 8 octobre 01:22 a installé les dernières versions publiées à ce moment-là (déduction, pas une mesure) | — |
| Secrets S3 présents | **Oui, prouvé** : la garde S3 (`ef07ab6`) empêche le démarrage sans secrets robustes, et `/api/health` répond 200 | Lecture seule |

**À relever par toi** (Vercel → Deployments → `ef07ab6` → Build Logs) : Python, `fastapi`,
`starlette`, `openai`, `google-genai`. Ce n'est **pas bloquant**, car le contrôle C7 après D1 et
le retour arrière instantané couvrent le risque.

### 7.2 Usages de `chatgpt_watch` (lecture seule)

Base interrogée : celle de `backend/.env` (cluster Atlas `clusterjobtracker`, base
`jobtracker` ; 27 comptes, 677 candidatures, dernière connexion le 8 octobre 2026 : base
réelle, **très probablement celle de la production**, sans preuve formelle puisque les
variables Vercel ne sont pas lisibles). Requêtes agrégées uniquement : aucune écriture, aucun
index créé.

| Contrôle | Résultat |
|---|---|
| Opportunités `chatgpt_watch` | **0** (aucune opportunité, toutes sources confondues) |
| Jetons agent (actifs ou révoqués) | **0** |
| Créations via l'API agent | **Aucune** |
| Collections `watch_*` / `oauth_*` déjà présentes | **Aucune** |
| Comptes `watch_enabled=true` | **0** |
| Interrupteur d'urgence en base | Absent |

**Conclusion** : la réservation de `chatgpt_watch` (P3) **n'impacte aucun client existant**.

**Observation** : ton serveur de développement local utilise cette même base Atlas. Les tests
du Lot 2 n'y ont jamais écrit (bases Docker jetables uniquement). À garder en tête pour tout
essai manuel en local.

### 7.3 Revue finale du diff (périmètre D1)

25 fichiers de code et de configuration passés en revue (§2.1, §2.2) :
- aucun reste de débogage (seuls les `print` du script d'administration, voulus) ;
- aucun secret ni URL de base de données avec identifiants ;
- `localhost` uniquement dans des valeurs par défaut déjà existantes ou dans des **contrôles de
  sécurité** (listes d'interdiction, tolérance réservée au développement local) ;
- aucune référence au correctif Gemini.

Point **non bloquant** relevé : le script d'administration accepte une `redirect_uri`
`http://localhost` (prévue pour le développement). En production, seule l'URI exacte de ChatGPT
doit être enregistrée (protocole E0).

### 7.4 Correctif Gemini hors du périmètre D1 : confirmé

- `backend/utils/ai_models.py` **absent** de l'arbre de travail ; aucun fichier de code ne le
  référence (le seul lien est un test qui vérifie son absence).
- Les 3 fichiers du correctif sont **dans `Doc/` uniquement** (`CORRECTIF-GEMINI-MODELES.md`,
  `.patch`, `verifier-modeles-gemini.py`), et non suivis par git.
- **Consigne pour les commits D1** : **exclure ces 3 fichiers** du commit de documentation
  (commit n°6, §2.7). Ils seront versionnés avec le correctif, séparément.

### 7.5 Synthèse GO / NO-GO

| Critère | État |
|---|---|
| Tests : backend Windows 818 + 1 xfail, Linux 816 + 2 ignorés + 1 xfail, frontend 89, build | ✔ |
| MCP inaccessible en production, même avec `MCP_ENABLED=true` (13 routes en 404) | ✔ |
| Aucun outil métier exposé (`jobtracker_ping` uniquement, ingestion sans route HTTP) | ✔ |
| Aucune variable Vercel à créer ou modifier | ✔ |
| Secrets S3 présents en production | ✔ (prouvé) |
| `chatgpt_watch` : aucun client impacté | ✔ |
| Correctif Gemini exclu | ✔ (consigne de commit §7.4) |
| Retour arrière sans migration | ✔ |
| Versions du build actuel | ⚠ non relevées (journal inaccessible), **non bloquant** |
| IA Google après D1 | ⚠ échec attendu **déjà présent avant D1** (correctif séparé), non bloquant |

**Verdict : GO technique pour D1**, aucun point bloquant. Le déploiement reste soumis à ton
autorisation explicite de commit et de push sur `main`.
