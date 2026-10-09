# JobTracker — Lot 2 V2 · Étape 2 : plan détaillé des fondations backend

> **Référence** : [CDC-LOT2-JOBTRACKER-V2.md](./CDC-LOT2-JOBTRACKER-V2.md) §6, étape 2 ·
> Spécification : [LOT2-V2-ETAPE-1-SPECIFICATION.md](./LOT2-V2-ETAPE-1-SPECIFICATION.md),
> révision 1.2.
> **Date** : 8 octobre 2026 · **Statut** : **plan à valider**. Aucune implémentation n'a
> commencé. Aucun commit, push, déploiement ni changement de production.

## 1. Objectif et critères du CDC

**CDC, étape 2** : « implémenter la correction S3 approuvée, les paramètres de veille et les
adaptations minimales d'ingestion, sans recherche serveur ».

| Critère du CDC | Couverture dans ce plan |
|---|---|
| Tests de JWT invalide ou forgé | **Déjà livrés** avec S3 (`ef07ab6`, en production) : 45 tests dans `test_security_settings.py`. Rejoués ici en non-régression (§6, T10) |
| Isolation multi-utilisateur | T4, T6, T8 : chaque service et chaque route est filtré par `user_id`, avec tests croisés à deux comptes |
| Validation des préférences | T3 (modèles et service) et T8 (API) |
| Non-régression du Lot 1 | T10 : suite complète, avec une attention particulière à l'ingestion agent et à la conversion |

**Livrable** : code et tests en local, puis rapport. **STOP**, sans rotation ni déploiement
(CDC §6).

## 2. Point de départ

- `main` = `origin/main` = `ef07ab6` ; S3 corrigée et déployée ; suite backend de **260 tests**
  verte au dernier passage.
- Code réutilisé, **sans le réécrire** :
  - `services/opportunity_service.py` : `find_existing_opportunity`, `ingest_opportunity`
    (`upsert` avec `$setOnInsert`), index uniques, création paresseuse des index (le
    `lifespan` ne s'exécute pas sur Vercel) ;
  - `services/agent_token_service.py` : modèle de compteur journalier atomique
    (`_reserve_creation` et `_release_creation`), repris **à l'identique dans un module
    séparé** (§4, décision P1) ;
  - `utils/job_urls.py` : `validate_http_url` et `normalize_job_url` ;
  - `models/__init__.py` : `OpportunityCreate`, `Opportunity`, `OpportunityResponse` ;
    `chatgpt_watch` est déjà dans `KNOWN_OPPORTUNITY_SOURCES`.
- `zoneinfo` fonctionne en local (`Europe/Paris`) grâce à `tzdata` 2025.3, installé
  **indirectement**. Il n'est pas déclaré dans `requirements.txt` (§4, décision P4).

## 3. Périmètre

**Inclus** : modèles de veille, validation métier, préférences, idempotence et quotas de
l'ingestion (§7 de la spécification), sous-document `watch` des opportunités, API utilisateur
JWT, drapeau administrateur `watch_enabled`, tests.

**Exclus**, reporté à l'étape 3 ou suivantes : serveur MCP, OAuth, dépendance `mcp`,
`vercel.json`, `/.well-known`, interrupteur `MCP_ENABLED` et `mcp_kill_switch`, machine
d'états du grant, e-mails d'alerte, interface (étape 4), toute connexion à ChatGPT, toute tâche
ChatGPT. **Les tâches ChatGPT existantes ne sont pas touchées.**

**Interdits** : aucune recherche d'offres, aucun scraping, aucun cron, aucun appel LLM côté
serveur. Aucune donnée ni variable de production modifiée.

## 4. Points à trancher avant de coder

| # | Question | Recommandation | Alternative |
|---|---|---|---|
| **P1** | Quota de veille : module séparé ou refactorisation du quota du Lot 1 ? | **Module séparé** (`watch_usage`, par utilisateur) qui reprend le même schéma atomique. Le code du Lot 1 n'est pas modifié : zéro risque de régression sur l'API agent | Extraire un compteur générique partagé : moins de duplication, mais modification du Lot 1 |
| **P2** | Jour de référence du plafond de 40 | **Jour de Paris** (`Europe/Paris`), cohérent avec les créneaux de 08:00 et 18:00 et avec `run_id` | Jour UTC, comme le Lot 1 : une veille de 01:30 (heure de Paris) compterait pour la veille |
| **P3** | Source `chatgpt_watch` réservée ? | **Oui** : refusée sur les routes manuelles et agent du Lot 1 (`source_reserved`), et imposée par le serveur pour la veille. Personne ne peut se faire passer pour la veille | Laisser libre : traçabilité moins fiable |
| **P4** | Déclarer `tzdata` dans `requirements.txt` | **Oui**, version épinglée. Sans elle, `zoneinfo` peut échouer sur Windows ou sur le runtime Vercel | Dépendre d'une installation indirecte : fragile |
| **P5** | Préférences modifiées en parallèle (deux onglets) | **Contrôle de version** : `PUT` exige `expected_version`, sinon `409 version_conflict` | Le dernier écrit gagne : perte silencieuse possible |
| **P6** | Accès à l'API de veille si `watch_enabled=false` | **403 `watch_not_enabled`** sur toutes les routes `/api/watch/*` | Lecture seule autorisée |

## 5. Lots de travail

### T1. Configuration (`config.py`, `.env.example`)

Nouveaux réglages, avec valeurs par défaut sûres et bornes vérifiées au démarrage :

| Variable | Défaut | Rôle |
|---|---|---|
| `WATCH_MAX_PER_RUN` | 20 | Plafond de créations par `run_id` |
| `WATCH_DAILY_CREATE_QUOTA` | 40 | Plafond par utilisateur et par jour de Paris |
| `WATCH_RUN_WINDOW_PAST_HOURS` | 6 | Fenêtre de validité de `run_id` (passé) |
| `WATCH_RUN_WINDOW_FUTURE_MINUTES` | 15 | Fenêtre de validité de `run_id` (futur) |
| `WATCH_ITEM_STALE_SECONDS` | 60 | Délai avant reprise d'un élément `pending` |
| `WATCH_TIMEZONE` | `Europe/Paris` | Fixe en v1, non modifiable par l'utilisateur |

Aucun secret. `.env.example` est documenté, sans valeur sensible.

### T2. Modèles Pydantic (`models/watch.py`, nouveau ; extension de `models/__init__.py`)

- `WatchPreferences` (stockage) et `WatchPreferencesResponse` : champs du §5.1.
- `WatchPreferencesUpdate` : contraintes du §5.1, `expected_version` obligatoire,
  `extra="forbid"`. `preferences_version` et `updated_at` ne sont **jamais** acceptés en entrée.
- `WatchOpportunityItem` : élément de `create_opportunities` (§5.2), `extra="forbid"` ;
  `user_id` et `source` refusés.
- `WatchBatchRequest` : `run_id`, `preferences_version`, 1 à 20 éléments.
- `WatchItemResult` et `WatchBatchResult` : sortie du §5.2, avec `replayed`.
- `WatchRunReport` : entrée de `report_watch_run` (§5.5).
- `WatchRun` et `WatchRunItem` : documents de `watch_runs` et `watch_run_items`.
- `OpportunityWatchInfo` : sous-document `watch` (D4). Champ **optionnel** ajouté à
  `Opportunity` et à `OpportunityResponse` : sans effet sur les opportunités du Lot 1.

### T3. Validation métier (`utils/watch_validation.py`, nouveau)

Fonctions pures, testables sans base :

1. **`parse_run_id(run_id, now, schedule)`** (§7.1) : regex
   `^veille-(\d{8})-(\d{4})-(prog|manuel)$` ; date et heure valides en `Europe/Paris`
   (`fold=0`) ; fenêtre de −6 h à +15 min ; `prog` hors `schedule.times` → avertissement
   `slot_not_in_schedule`. Codes d'erreur : `invalid_run_id`, `run_id_out_of_window`.
2. **`validate_watch_url(url)`** (§5.7) : HTTPS seul ; pas d'identifiants ; pas d'IP littérale
   (v4 ou v6) ni `localhost`, `.local`, `.internal` ; port absent ou 443 ; raccourcisseurs et
   redirecteurs refusés (liste fermée, dans le code) ; IDN ou punycode → champ ajouté à
   `uncertain_fields`. Puis `normalize_job_url` du Lot 1.
3. **`normalize_contract(value)`** : `CDI`, `permanent`, `unbefristet`, `indefinite`,
   `contrat à durée indéterminée`… → `permanent` ; table fermée et testée par pays (FR, CH,
   BE, LU) ; inconnu → `None`, donc rejet `contract_not_targeted`.
4. **`normalize_country(value)`** : ISO alpha-2 en majuscules, plus noms usuels (`France`,
   `Suisse`, `Schweiz`, `Belgique`, `België`, `Luxembourg`…) ; inconnu → rejet.
5. **`check_item_against_preferences(item, prefs)`** : pays, contrat, niveau, `min_score`,
   bornes, avec la liste complète des raisons de rejet (§5.2).

### T4. Service des préférences (`services/watch_preferences_service.py`, nouveau)

- Collection `watch_preferences`, index unique `user_id`, création paresseuse des index.
- `get_or_create(db, user_id)` : valeurs initiales du §5.1 (08:00 et 18:00, Europe/Paris), via
  `upsert` avec `$setOnInsert`, sans course possible.
- `update(db, user_id, data)` : mise à jour conditionnée par
  `{user_id, preferences_version: expected_version}`, `$inc` de la version, `updated_at` ;
  échec → `VersionConflict` (P5).
- Aucune fonction ne prend un `user_id` venant du client : il vient toujours de l'identité
  vérifiée.

### T5. Service d'ingestion de veille (`services/watch_ingest_service.py`, nouveau)

Point d'entrée unique, que l'outil MCP appellera à l'étape 3 :
`ingest_batch(db, user_id, request) -> WatchBatchResult`.

- **Collections et index** (création paresseuse) :
  - `watch_runs` : unique `(user_id, run_id)` ; compteurs `reserved`, `created`, `duplicate`,
    `rejected`, `error` ; `warnings` ; dernier rapport ;
  - `watch_run_items` : unique `(user_id, run_id, item_key)` ; `state`, `claimed_at`,
    résultat enregistré ;
  - `watch_usage` : unique `(user_id, date_paris)`, compteur `creations`, TTL de rétention.
- **Algorithme exact du §7.3**, dans cet ordre : validation (élément `rejected` enregistré) →
  réservation de l'élément (`$setOnInsert`, `pending`) → rejeu si terminé, attente bornée à
  2 s si `pending` récent, reprise atomique conditionnée à l'ancien `claimed_at` si `pending`
  de plus de 60 s → doublon avant quota → double réservation atomique (exécution, puis jour, avec
  libération de la première si la seconde échoue) → `ingest_opportunity` avec
  `source="chatgpt_watch"` et sous-document `watch` → libération si doublon révélé ou
  exception → finalisation et `$inc` des compteurs de l'exécution.
- **Veille en pause** (`active=false`) : tous les éléments `rejected` (`watch_paused`), sans
  écriture d'opportunité.
- **`item_key`** : `external_id` normalisé s'il est présent, sinon `url_normalized`.
- `report_watch_run(db, user_id, report)` : dernier rapport retenu ; renvoie les compteurs
  **observés** à côté des chiffres déclarés.
- `get_watch_status(db, user_id)` et `list_runs(db, user_id, limit)` : faits enregistrés
  uniquement, rien d'inventé (§7 bis, niveau 1). Le calcul de « l'absence présumée » (niveau 2)
  est fait à la lecture, à partir de `schedule.times`.

**Adaptation minimale du Lot 1** : `ingest_opportunity` reçoit un paramètre optionnel
`watch: dict | None = None`, écrit dans `$setOnInsert`. La signature reste compatible et aucun
appel existant ne change. Pour P3 : refus de `source="chatgpt_watch"` dans les routes
manuelles et agent du Lot 1.

### T6. API utilisateur (`routes/watch.py`, nouveau ; branché dans `server.py`)

Authentification JWT existante (`get_current_user`), `user_id` toujours issu du jeton :

| Route | Rôle |
|---|---|
| `GET /api/watch/preferences` | Lecture (création des valeurs initiales au premier accès) |
| `PUT /api/watch/preferences` | Mise à jour complète, avec `expected_version` → 200, 409 ou 422 |
| `GET /api/watch/status` | État : active, quotas restants du jour, dernière exécution, absence présumée |
| `GET /api/watch/runs?limit=20` | Historique des exécutions **observées** (1 à 50) |

Toutes renvoient **403 `watch_not_enabled`** si le drapeau du compte est désactivé (P6).
**Aucune route d'écriture d'offres** n'est exposée en HTTP à cette étape : l'ingestion reste
une fonction de service, testée directement, et ne sera exposée qu'au travers du MCP à
l'étape 3.

### T7. Drapeau administrateur `watch_enabled` (D7)

- Champ `watch_enabled: bool = False` sur l'utilisateur. Absent = `false` : **aucune migration
  de données**.
- `PUT /api/admin/users/{user_id}/watch` `{"enabled": true|false}`, réservé à l'admin
  (`get_admin_user` existant) ; journalisé, sans donnée sensible.
- **Aucune activation n'est faite à cette étape**, ni en local sur des données réelles, ni en
  production. L'activation de ton compte en production se fera à l'étape d'activation
  (§8 bis de la spécification), sur autorisation.

### T8. Dépendances

- `tzdata` ajouté et épinglé dans `requirements.txt` (P4). **Aucune autre dépendance**, en
  particulier pas `mcp` (étape 3, porte E0b).

## 6. Tests (Mongo Docker, `run_mongo_tests.sh`)

| # | Fichier | Contenu |
|---|---|---|
| **T-V** | `tests/test_watch_validation.py` (pur) | `run_id` : formats valides et invalides, UUID, fenêtre (bornes −6 h et +15 min), **heure d'été et d'hiver**, journées de bascule (29 mars et 25 octobre 2026), heure ambiguë, `prog` hors créneau → avertissement. URL : chaque règle du §5.7, IDN. Contrats et pays : table complète, valeurs inconnues |
| **T-P** | `tests/test_watch_preferences.py` | Valeurs initiales (08:00 et 18:00, Europe/Paris) ; bornes de chaque champ ; champs interdits ; `expected_version` (succès, conflit 409) ; **création concurrente** du document initial : un seul document |
| **T-I** | `tests/test_watch_ingest.py` | **Tous les tests du §7.5** : N appels identiques simultanés → 1 création par offre et résultats identiques ; 30 offres distinctes en parallèle sur un même `run_id` → **exactement 20** créées ; deux `run_id` concurrents → **exactement 40** par jour ; rejeu ×3 → 0 écriture ; interruption simulée après réservation, reprise après 60 s → aucun doublon ni quota perdu ; exception pendant l'ingestion → quotas libérés, `error` retryable ; doublon → 0 quota, même quota épuisé ; veille en pause ; `manuel` puis `prog` → offres existantes en `duplicate` ; offre ignorée ou convertie → non réactivée |
| **T-R** | `tests/test_watch_report.py` | Dernier rapport retenu ; compteurs observés ≠ déclarés ; `run_id` inconnu → exécution créée avec 0 élément (rapport d'échec sans offre) |
| **T-A** | `tests/test_watch_api.py` | 401 sans jeton, 401 avec jeton forgé ; 403 si `watch_enabled=false` ; **isolation** : le compte B ne voit ni ne modifie rien du compte A ; 422 sur entrées invalides ; 409 sur conflit de version |
| **T-D** | `tests/test_watch_admin.py` | Activation et désactivation par l'admin ; 403 pour un non-admin ; absence du champ = désactivé |
| **T-L1** | Lot 1 (existants, plus 3 nouveaux) | Suites Lot 1 inchangées vertes ; nouveaux tests : `chatgpt_watch` refusé en manuel et par l'agent (P3) ; `ingest_opportunity` sans `watch` → document identique à avant |
| **T10** | Suite complète | `pytest` backend complet (260 tests et plus, dont les 45 de S3) ; `yarn test` frontend inchangé (aucune modification du frontend) |

**Seuil de réussite** : 100 % vert, sans test désactivé ni marqué « attendu en échec ». Les
tests de concurrence sont répétés **20 fois** pour écarter un succès dû au hasard.

## 7. Ordre d'exécution

1. T1, T8, T2 : configuration, dépendance `tzdata`, modèles.
2. T3 et T-V : validation pure, testée en premier.
3. T4 et T-P : préférences.
4. T5, T-I, T-R : ingestion et idempotence. **C'est la partie critique** ; les tests de
   concurrence sont écrits **avant** l'implémentation de l'algorithme.
5. Adaptation minimale du Lot 1 et T-L1.
6. T6, T7, T-A, T-D : API et drapeau administrateur.
7. T10 : suite complète, puis rapport.

## 8. Fichiers touchés (prévision)

| Fichier | Nature |
|---|---|
| `backend/config.py`, `backend/.env.example` | Modifié : réglages `WATCH_*` |
| `backend/requirements.txt` | Modifié : `tzdata` |
| `backend/models/watch.py` | **Nouveau** |
| `backend/models/__init__.py` | Modifié : `watch` optionnel sur `Opportunity` et `OpportunityResponse` ; `watch_enabled` utilisateur |
| `backend/utils/watch_validation.py` | **Nouveau** |
| `backend/services/watch_preferences_service.py` | **Nouveau** |
| `backend/services/watch_ingest_service.py` | **Nouveau** |
| `backend/services/opportunity_service.py` | Modifié : paramètre optionnel `watch` |
| `backend/routes/opportunities.py`, `backend/routes/agent.py` | Modifié : refus de `chatgpt_watch` (P3) |
| `backend/routes/watch.py` | **Nouveau** |
| `backend/routes/admin.py` | Modifié : route `watch_enabled` |
| `backend/server.py` | Modifié : branchement du routeur |
| `backend/tests/test_watch_*.py` | **Nouveaux** (6 fichiers) |

**Non touchés** : frontend, `vercel.json`, extension Chrome, landing page, variables et
données de production.

## 9. Risques de l'étape

| Risque | Parade |
|---|---|
| Course entre réservation d'élément et quota → dépassement de 20 ou 40 | Conditions dans chaque `update_one` atomique ; tests de concurrence répétés 20 fois |
| Élément bloqué `pending` après un timeout | Reprise conditionnée à l'ancien `claimed_at` (mécanisme déjà éprouvé par la conversion du Lot 1) |
| Régression du Lot 1 | Paramètre optionnel seulement ; P1 évite de toucher au quota agent ; suite complète |
| Fuseau horaire faux en production | `tzdata` épinglé ; tests sur les dates de bascule ; aucune dépendance au fuseau de la machine |
| Index absents sur Vercel | Création paresseuse, comme au Lot 1 |

## 10. Rapport de fin d'étape (contenu prévu)

Fichiers modifiés et créés, résultats complets des tests (nombre, durée, répétitions de
concurrence), écarts éventuels avec la spécification, points ouverts pour l'étape 3. **STOP**,
sans commit, push ni déploiement, sauf autorisation distincte.
