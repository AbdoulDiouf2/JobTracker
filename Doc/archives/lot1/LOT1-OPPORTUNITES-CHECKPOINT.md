# JobTracker — Lot 1 « Opportunités » : checkpoint final

> **État** : Lot 1 terminé et validé localement (étapes 1 à 6 du CDC), **non commité**.
> **Important** : l'API agent est prête, mais **ChatGPT n'est PAS connecté à JobTracker**.
> Aucune veille automatique, aucun MCP, aucun connecteur n'existe encore. Pour l'instant,
> une opportunité n'arrive que par un appel HTTP authentifié par un token agent, ou par
> l'API utilisateur.

Référence : [CDC - JobTracker - Module « Opportunités ».md](../../CDC%20-%20JobTracker%20-%20Module%20«%20Opportunités%20».md)
· Dette sécurité hors périmètre : [DETTE-SECURITE.md](../../DETTE-SECURITE.md)

---

## 1. Objectif

Ajouter une **boîte de réception d'opportunités**. Une opportunité est une offre repérée
pour l'utilisateur, à laquelle il n'a **pas encore** candidaté. Des systèmes externes
peuvent y déposer des offres. L'utilisateur peut ensuite :

- les consulter ;
- les ignorer ;
- les convertir en candidature suivie.

Une `Opportunity` est un concept **distinct** d'une `Application` : elle n'entre dans aucune
statistique de candidature.

```
Agent externe ──POST /api/agent/opportunities──▶ Opportunity:new ──▶ page Opportunités
                                                      │
                          ┌───────────────────────────┼──────────────────────────┐
                       Ignorer                    Candidater                 (doublon renvoyé
                   (status=ignored,          POST …/{id}/convert              → 200, rien créé)
                 candidature possible               │
                      plus tard)                    ▼
                                         Application:to_apply  « Pas encore envoyée »
                                         (hors métriques, date technique)
                                                    │  l'utilisateur envoie VRAIMENT
                                                    ▼  sa candidature
                                         Application:pending + vraie date_candidature
                                         (entre dans les métriques)
                                                    │
                                                    ▼
                                         positive / negative / no_response / …
```

## 2. Architecture

```
routes/opportunities.py  (JWT utilisateur) ─┐
routes/agent.py          (AgentToken)       ├──▶ services/opportunity_service.py ──▶ MongoDB
futur MCP / connecteur   (à venir)         ─┘            │
                                                         └──▶ services/application_service.py
routes/agent_tokens.py   (JWT webapp) ──▶ services/agent_token_service.py
utils/agent_auth.py      : get_agent_principal / require_agent_scope (séparé de get_current_user)
utils/job_urls.py        : validation http(s), normalisation d'URL, détection de plateforme
```

- **Une seule couche service** : les routes HTTP, l'API agent et le futur MCP appellent les
  mêmes fonctions. Aucune logique métier n'est dupliquée.
- **Création de candidature** : extraite dans `create_application_record`.
  `POST /api/applications` a gardé exactement son comportement, et la conversion réutilise
  cette même fonction.
- **Index MongoDB** : ils sont créés **à la première utilisation** de chaque service, car
  sur Vercel le `lifespan` ne s'exécute pas. Ils sont aussi créés au démarrage en local.

## 3. Modèles

### Opportunity — collection `opportunities`

| Champ | Notes |
|---|---|
| `id` | UUID texte (convention du repo) |
| `user_id` | toujours dérivé de l'authentification, jamais de la requête |
| `title`, `company`, `url` | obligatoires ; URL http(s) uniquement, 2000 caractères max |
| `url_normalized` | clé de dédoublonnage, jamais renvoyée au client |
| `location`, `country`, `contract_type`, `description` | optionnels ; description 10 000 caractères max |
| `source` | identifiant libre en minuscules (`chatgpt_watch`, `chrome_extension`, `manual`, `external_agent`, `other`…) |
| `external_id` | optionnel ; identifiant chez le fournisseur |
| `status` | `new` / `ignored` / `converted` |
| `discovered_at`, `created_at`, `updated_at`, `converted_at` | dates ISO (UTC) |
| `converted_application_id` | renseigné à la conversion ; sert aussi de réservation |
| `conversion_started_at` | champ interne de réservation (jamais exposé) |
| `metadata` | objet libre, 10 Ko max, clés `$…` ou contenant un `.` interdites |

**Index** :

| Nom | Champs | Particularité |
|---|---|---|
| `opp_id_unique` | `id` | unique |
| `opp_user_discovered` | `user_id` + `discovered_at` | — |
| `opp_user_status_discovered` | `user_id` + `status` + `discovered_at` | — |
| `opp_user_url_unique` | `user_id` + `url_normalized` | unique |
| `opp_user_source_external_id_unique` | `user_id` + `source` + `external_id` | unique, seulement si `external_id` est une chaîne |

Les champs prévus pour plus tard (`matching_score`, `selected_cv_id`…) pourront être
ajoutés sans migration.

### AgentToken — collection `agent_tokens`

| Champ | Notes |
|---|---|
| `id`, `user_id`, `name` | nom de 1 à 100 caractères |
| `token_prefix` | 13 premiers caractères (ex. `jt_agent_a82f`), pour l'affichage |
| `token_hash` | SHA-256 en hexadécimal ; **le token brut n'est jamais stocké** |
| `scopes` | permissions, refusées par défaut |
| `created_at`, `last_used_at`, `revoked_at` | dates ISO |

**Index** :
- `agent_tokens` : `id` unique, `token_hash` unique, `user_id` + `created_at` ;
- `agent_token_usage` : `token_id` + `date` unique, suppression automatique après 90 jours.

## 4. Endpoints

### API utilisateur (JWT, isolation stricte : une ressource hors de son compte → 404)

| Méthode | Route | Réponses |
|---|---|---|
| GET | `/api/opportunities?status=&search=&page=&per_page=` | 200, pagination |
| GET | `/api/opportunities/count` | `{"new": n}` (badge de navigation) |
| POST | `/api/opportunities` | 201 si créée · 200 si doublon · 422 si invalide (`user_id` dans la requête compris) |
| GET | `/api/opportunities/{id}` | 200 · 404 |
| PATCH | `/api/opportunities/{id}` | champs descriptifs ; statut `new` ↔ `ignored` ; 409 si convertie |
| POST | `/api/opportunities/{id}/ignore` | idempotent ; 409 si convertie ou en cours de conversion |
| POST | `/api/opportunities/{id}/convert` | 200 `{success, opportunity_id, application_id, created}` · 409 + `Retry-After` si une conversion est en cours |
| POST | `/api/agent-tokens` | 201, le token brut **une seule fois** ; 409 au-delà de 10 tokens actifs |
| GET | `/api/agent-tokens` | métadonnées, jamais le token ni son hash |
| DELETE | `/api/agent-tokens/{id}` | révocation immédiate, idempotente (200) ; l'enregistrement est conservé pour l'audit |

La gestion des tokens est **refusée au JWT de l'extension Chrome** (403).

### API agent

```
POST /api/agent/opportunities
Authorization: Bearer jt_agent_<43 caractères base64url>
Content-Type: application/json

{"title": "...", "company": "...", "url": "https://...", "location": "...", "country": "...",
 "contract_type": "CDI", "description": "...", "source": "external_agent", "external_id": "..."}
```

| Cas | Réponse |
|---|---|
| Offre créée | **201** `{"created": true, "duplicate": false, "opportunity_id": "…", "duplicate_reason": null}` |
| Doublon | **200** `{"created": false, "duplicate": true, "opportunity_id": "…", "duplicate_reason": "url" \| "external_id"}` |
| Token absent, malformé, inconnu, révoqué, ou propriétaire désactivé | 401 (réponse identique) |
| Scope absent | 403 |
| Requête invalide, ou `user_id` fourni | 422 |
| Limite par minute ou quota journalier atteint | 429 (`Retry-After` pour le quota) |

- Sans `source`, la valeur `external_agent` est appliquée.
- **Lot 2** : la source `chatgpt_watch` est **réservée** à la veille ChatGPT (MCP) et refusée ici
  (`422 source_reserved`).
- **Un retry de veille est sans risque** : il est idempotent et ne consomme aucun quota.

### Scopes

Un seul scope existe : `opportunities:create`. Pour en ajouter un (par exemple
`opportunities:read` pour le futur MCP) :
1. l'ajouter dans l'enum `AgentScope` (`models/__init__.py`) ;
2. protéger l'endpoint avec `require_agent_scope(AgentScope.X)`.

Aucun token n'a accès à l'admin, aux candidatures, aux documents, aux paramètres ni aux clés IA.

## 5. Sémantique de `to_apply`

`to_apply` (« À postuler ») signifie : **« je souhaite candidater, mais la candidature n'est
pas encore envoyée »**.

- La conversion crée **toujours** une candidature `to_apply`, jamais `pending`.
- `date_candidature` est obligatoire dans le modèle actuel. Pour une `to_apply`, elle contient
  donc une **valeur technique** (la date de conversion), **sans valeur métier**.
- **Exclue de toutes les métriques « envoyée »** via `sent_applications_filter()` :
  - dashboard et dashboard V2 (objectifs, Job Search Score, insights, évolution hebdomadaire) ;
  - statistiques et répartitions ;
  - taux et délai de réponse ;
  - efficacité par plateforme, analyse IA ;
  - export Excel des statistiques ;
  - signal admin d'inactivité ;
  - contexte envoyé à l'assistant IA.

  Les compteurs **globaux** de l'admin l'incluent, comme statut distinct (validé).
- **Relances** :
  - la liste des relances ne retient que `pending` ;
  - la génération d'un e-mail de relance et « relance envoyée » renvoient **422** pour une `to_apply` ;
  - le bouton « Relance » est masqué dans l'interface.
- **Sortir de `to_apply`** :
  - le backend **exige une `date_candidature` explicite** (422 sinon) et n'invente jamais de date ;
  - la modification groupée laisse les `to_apply` intactes et en renvoie le nombre dans `skipped_to_apply` ;
  - revenir vers `to_apply` est autorisé.
- **Interface** :
  - la candidature affiche « Pas encore envoyée · ajoutée le … » (d'après `created_at`), jamais la date technique ;
  - le menu rapide ne propose que « En attente » ;
  - le Dialog « Candidature envoyée » demande la vraie date d'envoi (préremplie à aujourd'hui, pas de date future) ;
  - dans le formulaire d'édition, le champ devient « Date d'ajout », en lecture seule.
- **Parcours normal** : `to_apply` → `pending` avec la vraie date → `positive` / `negative` / `no_response` / …

## 6. Idempotence et concurrence

| Invariant | Mécanisme |
|---|---|
| Même offre envoyée N fois en même temps → 1 opportunité | Index unique sur `user_id` + `url_normalized`, `upsert` + `$setOnInsert`, erreur de clé dupliquée traitée comme un doublon |
| Même `external_id` → 1 opportunité | Index unique partiel sur `user_id` + `source` + `external_id`, prioritaire sur l'URL |
| URL normalisée | http/https unifiés, `www.` retiré, port par défaut, `#…`, `/` final, `utm_*`, `gclid`, `fbclid`, `trk`/`trackingId`/`refId` (LinkedIn) supprimés ; paramètres triés ; **les paramètres qui identifient l'offre sont conservés** |
| Conversion concurrente → 1 candidature | **Réservation atomique** : `converted_application_id` est posé par un `find_one_and_update`, uniquement s'il est encore vide ; les autres appels attendent et renvoient la même candidature |
| Retry ou double clic → même candidature | Une opportunité convertie renvoie `created=false` avec le même `application_id` |
| Échec de création → rien de bloqué | Rollback : suppression de la candidature de la tentative et libération de la réservation. **Une réservation de plus de 60 s est reprise.** Crash après insertion : la tentative suivante finalise. Tentative lente dont la réservation a été reprise : elle supprime sa propre candidature |
| Doublon → quota inchangé | Vérification de doublon en lecture seule **avant** de réserver du quota ; la réservation est rendue si l'ingestion finit en doublon ou en erreur |
| Quota jamais dépassé | Réservation atomique (`$lt quota` + `$inc` en upsert, retry sans upsert sur clé dupliquée) ; retry court (1 s) pour éviter un faux 429 entre requêtes identiques |

## 7. Sécurité

- **AgentToken** :
  - 256 bits aléatoires (`secrets`) ;
  - seul le hash SHA-256 est stocké ;
  - le token brut n'est renvoyé qu'à la création ;
  - jamais journalisé (testé sur des logs capturés en DEBUG) ;
  - révocation immédiate ;
  - scope obligatoire ;
  - propriétaire actif obligatoire ;
  - JWT et token agent **ne se croisent jamais**.
- **Frontend** :
  - le token brut ne vit que dans un state local, effacé à la fermeture du Dialog ;
  - **jamais dans le cache TanStack** (création sans `useMutation`), ni dans le storage, l'URL ou la console ;
  - un clic hors du Dialog ne le ferme pas.
- **URL** :
  - http(s) uniquement côté backend (`validate_http_url`) et côté frontend (`toSafeExternalUrl`) ;
  - `javascript:` et `data:` sont rejetés ou jamais rendus comme liens ;
  - nouvel onglet avec `rel="noopener noreferrer"`.
- **Requêtes** : modèles Pydantic en `extra=forbid` (un `user_id`, un `status` ou un champ inconnu → 422), limites de taille, `metadata` contrôlé.
- **Journal d'activité de l'API agent**, sans secret : `agent_ingest endpoint=… result=created|duplicate|quota_exceeded token_id=… prefix=… user_id=… opportunity_id=… duplicate=…`.
- **Dette existante** ([DETTE-SECURITE.md](../../DETTE-SECURITE.md), points S1 à S3) : non corrigée, et **pas aggravée** par ce lot.
  - Les tokens agent ne dépendent ni de `JWT_SECRET` ni de l'en-tête `Origin`.
  - `get_current_user` n'a pas été modifié.

## 8. Quotas et limites (variables d'environnement)

| Variable | Défaut | Rôle |
|---|---|---|
| `AGENT_RATE_LIMIT` | `30/minute` | limite par token (slowapi, compteurs en mémoire, donc par instance) |
| `AGENT_DAILY_CREATE_QUOTA` | `500` | créations par jour UTC et par token (MongoDB, fiable en serverless) |
| `AGENT_MAX_ACTIVE_TOKENS` | `10` | tokens actifs par utilisateur |
| `AGENT_LAST_USED_THROTTLE_SECONDS` | `300` | `last_used_at` mis à jour au plus une fois toutes les 5 minutes |

## 9. Frontend

- **Page `/dashboard/opportunities`** :
  - cartes responsives (1 colonne sur mobile, 2 sur tablette, 3 sur desktop) ;
  - filtres Toutes / Nouvelles / Ignorées / Converties, recherche avec délai de 300 ms ;
  - pagination du backend ;
  - détail en Dialog ;
  - actions Voir l'offre / Ignorer (avec « Annuler ») / Candidater, ou « Voir candidature » ;
  - après conversion : redirection vers `/dashboard/applications?id=…` ;
  - 409 : message lisible avec « Réessayer ».
- **Navigation** : entrée « Opportunités » avec un badge qui compte les nouvelles opportunités (masqué à 0, rafraîchi toutes les 60 s, au retour sur l'onglet et après chaque action).
- **Paramètres → « API / Agents »** : liste, création (le token est affiché une seule fois, avec Copier), révocation confirmée.
- **Hooks** : `useOpportunities`, `useOpportunityCount`, `useOpportunityActions`, `useAgentTokens`. Les invalidations sont ciblées (`['opportunities']`, `['applications']`, `['agent-tokens']`).

## 10. Tests

| Suite | Commande | Résultat |
|---|---|---|
| Backend (MongoDB Docker jetable, 127.0.0.1, données en mémoire, base supprimée à la fin) | `cd backend && bash tests/run_mongo_tests.sh` | **215 passés** |
| Frontend (Jest via craco, Testing Library) | `cd frontend && CI=true yarn test --watchAll=false` | **42 passés** |
| Build de production | `cd frontend && yarn build` | Compiled successfully, sans warning |

Le scénario métier complet est couvert par `tests/test_lot1_e2e.py`, avec de vrais appels
HTTP sur l'application FastAPI :
- token, ingestion, compteur, conversion, `to_apply` hors stats ;
- passage à `pending` avec date, entrée dans les stats, réenvoi sans duplication ;
- offre ignorée puis candidatée ;
- « Voir candidature » sans duplication ;
- isolation entre deux utilisateurs.

⚠️ `tests/test_jobtracker_api.py` et `tests/test_dashboard_v2.py` sont d'**anciens tests**
qui appellent une URL distante. Ils ne doivent pas être lancés avec ce lot ; le script ne les inclut pas.

## 11. Limitations connues

- **Limite par minute** : slowapi garde ses compteurs en mémoire, donc chaque instance serverless a les siens. Le quota MongoDB reste la limite fiable.
- **Abandon d'une `to_apply`** : il n'existe pas de statut « abandonnée avant candidature » (évolution future). Il faut garder la candidature ou la supprimer ; ne pas utiliser `cancelled`.
- **Formulaire d'édition d'une `to_apply`** : la date technique reste dans la requête (en lecture seule, sans effet métier tant que le statut ne change pas).
- **Pas de dédoublonnage de secours** par entreprise + titre + lieu (risque de faux positifs).
- **Pas de notification** à l'arrivée d'une opportunité : seul le badge l'indique.
- **`package-lock.json`** n'est pas maintenu : les dépendances sont gérées avec yarn (`yarn.lock`).
- **Configuration Jest** (`craco.config.js`) : mappings CommonJS pour `react-router-dom` v7 et `date-fns/locale` (Jest 27 ignore le champ `exports`), et plugin « visual-edits » limité au serveur de dev.
- **Hors lot, existant** : `ApplicationDetailModal` provoque un avertissement Radix « Missing Description » en test.

## 12. Dettes hors périmètre

Voir [DETTE-SECURITE.md](../../DETTE-SECURITE.md) :
- S1 : contournement du quota IA par l'en-tête `Origin` ;
- S2 : `is_admin` toujours faux ;
- S3 : secrets avec valeur par défaut.

## 13. Préparer le futur MCP / connecteur

**Déjà prêt** :
- l'endpoint `POST /api/agent/opportunities` (authentification, scope, idempotence, quota) ;
- la couche service unique (`opportunity_service`).

**À faire dans un lot suivant**, non implémenté :
1. **Connecteur ou serveur MCP**. Il utiliserait un token agent créé par l'utilisateur dans
   Paramètres → API / Agents (stocké côté connecteur, **jamais** dans le frontend public).
   Il appellerait l'API agent, ou directement `opportunity_service` s'il tourne côté serveur.
2. **Scope `opportunities:read`**, si le MCP doit lire la boîte de réception (refusé par défaut aujourd'hui).
3. **Envoi par ChatGPT ou par une veille** : appeler l'endpoint avec un `external_id` stable,
   pour profiter du dédoublonnage prioritaire.
4. **Notifications groupées** (push ou e-mail) des nouvelles opportunités, avec une stratégie anti-spam.

Toujours hors périmètre : Playwright, candidature automatique, scraping, cron de veille.
