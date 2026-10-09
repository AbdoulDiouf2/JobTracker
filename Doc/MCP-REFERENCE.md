# Référence du serveur MCP

Point d'entrée : `https://jobtracker.maadec.com/api/mcp` (transport HTTP « streamable », mode
sans état, réponses JSON). Code : `backend/utils/mcp_transport.py` (transport, contrôles) et
`backend/services/mcp_tools.py` (outils).

## Principe

**JobTracker ne cherche aucune offre.** La recherche est faite par un agent externe (ChatGPT,
Claude…) qui applique les critères lus dans JobTracker, puis transmet ses résultats par MCP.
JobTracker **valide, déduplique, applique les quotas et enregistre** ; il ne visite jamais les
URL reçues.

Séquence attendue d'une exécution de veille :

```
get_watch_preferences → recherche web (agent) → list_recent_opportunities (facultatif)
  → create_opportunities (1 ou plusieurs appels, même run_id) → report_watch_run
```

## Contrôles à chaque requête

Dans cet ordre (avant tout outil) :

1. **MCP actif** : `MCP_ENABLED` (et, en production Vercel, `MCP_PRODUCTION_ALLOWED`). Sinon
   **404** identique à une route absente.
2. **Interrupteur d'urgence** (`platform_settings.mcp_kill_switch`, fermé par défaut) : fermé
   → **503**.
3. **Jeton d'accès OAuth** (`Authorization: Bearer jt_oat_…`) : opaque, lié à la ressource
   `…/api/mcp`, autorisation active, client actif, compte actif avec veille activée. Sinon
   **401** + `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp", scope="…"`.
4. **Limite de débit** : `MCP_RATE_LIMIT_PER_MINUTE` (30) par autorisation et par instance →
   **429** + `Retry-After`.
5. **Scope de l'outil appelé** → **403** `insufficient_scope` ; revérifié dans l'outil.
6. **Hôte et origine** (protection DNS-rebinding du SDK) ; corps limité à 4 Mo (**413**).

Les scopes effectifs sont l'intersection des scopes de l'autorisation et de ceux actuellement
permis au client (voir [OAUTH.md](./OAUTH.md)). L'identité (`user_id`, `client_id`) vient
**toujours** du jeton : tout argument `user_id`, `client_id` ou `source` est refusé.

## Format des réponses et erreurs

Succès : `structuredContent` + copie JSON dans `content[0].text`, `isError: false`.
Erreur d'outil : `isError: true` et `{"error": {"code": …, "details": […]}}` — les `details`
donnent l'emplacement et le type de l'erreur, **jamais la valeur reçue**.

| Code | Sens |
|---|---|
| `invalid_arguments` | Arguments non conformes au schéma, ou argument d'identité fourni |
| `invalid_run_id` | `run_id` mal formé, aléatoire, ou heure inexistante (passage à l'heure d'été) |
| `run_id_out_of_window` | Instant désigné hors fenêtre (voir plus bas) |
| `watch_not_enabled` | Veille non activée pour le compte |
| `insufficient_scope` | Scope manquant (défense en profondeur) |
| `temporarily_unavailable` | Base indisponible ; `retryable: true` |
| `unknown_tool` | Outil inconnu |

## Outils

### `jobtracker_ping`

| | |
|---|---|
| Objectif | Diagnostic de la connexion |
| Scope | `watch:read` |
| Paramètres | aucun |
| Réponse | `{"service": "jobtracker", "transport": "ok", "authenticated": true}` |
| Effets de bord | Aucun |

### `get_watch_preferences`

| | |
|---|---|
| Objectif | Critères de veille du compte, à lire **au début** de chaque exécution |
| Scope | `watch:read` (lecture seule) |
| Paramètres | aucun (tout argument → `invalid_arguments`) |
| Réponse | `active`, `countries`, `job_families`, `title_keywords`, `exclusions`, `seniority`, `contract_types`, `languages`, `min_score`, `max_per_run`, `schedule` (`timezone`, `times`), `scoring_rubric`, `preferences_version`, `updated_at` |
| Effets de bord | Crée les préférences par défaut au premier accès |

Si `active` vaut `false`, l'agent doit arrêter l'exécution sans rien envoyer.

### `create_opportunities`

| | |
|---|---|
| Objectif | Transmettre de 1 à 20 offres trouvées pour une exécution |
| Scope | `opportunities:write` |
| Paramètres | `run_id` (requis), `preferences_version` (facultatif), `opportunities` (1 à 20) |
| Effets de bord | Crée des opportunités au statut `new`, `source=chatgpt_watch`, avec le sous-document `watch` (score, raisons, preuve, champs incertains, version des critères, `client_id` et nom du client vérifié) ; met à jour l'exécution et les quotas |

Champs d'une offre : `title`, `company`, `url`, `country`, `contract_type`,
`relevance_score`, `relevance_reasons` (requis) ; `location`, `seniority`, `description`,
`external_id`, `discovered_at`, `source_evidence`, `uncertain_fields` (facultatifs).

Réponse :

```json
{
  "run_id": "veille-20261010-0800-prog",
  "summary": {"received": 3, "replayed": 0, "created": 1, "duplicate": 1, "rejected": 1, "error": 0},
  "run_totals": {"created": 1, "remaining_for_run": 19, "remaining_today": 39},
  "warnings": [],
  "results": [
    {"index": 0, "status": "created", "opportunity_id": "…", "warnings": []},
    {"index": 1, "status": "duplicate", "opportunity_id": "…", "duplicate_reason": "url"},
    {"index": 2, "status": "rejected", "reasons": ["score_below_threshold"]}
  ]
}
```

Un élément invalide ne fait jamais échouer tout l'appel : il est `rejected` avec ses raisons.

| Raison de rejet | Règle |
|---|---|
| `invalid_item` | Élément non conforme (champ manquant, type, longueur, `user_id`/`source`/`client_id` dans l'élément…) |
| `invalid_url`, `url_userinfo_forbidden`, `url_host_forbidden`, `url_port_forbidden`, `url_redirector_forbidden` | URL HTTPS directe obligatoire : nom de domaine public (Public Suffix List), port par défaut, sans identifiants, sans raccourcisseur ni paramètre de redirection vers un autre site |
| `invalid_country`, `country_not_targeted` | Pays ISO non reconnu ou absent des préférences |
| `contract_not_targeted` | Contrat (normalisé : CDI → `permanent`…) absent des préférences |
| `seniority_not_targeted` | Séniorité fournie mais non ciblée |
| `score_below_threshold` | `relevance_score` inférieur à `min_score` |
| `watch_paused` | Préférences `active=false` |
| `run_limit_reached`, `daily_quota_reached` | Plafond par exécution ou par jour atteint |

Avertissements possibles : `description_truncated`, `source_evidence_ignored`,
`uncertain_fields_filtered` (par élément), `slot_not_in_schedule` (exécution `prog` dont l'heure
n'est pas dans `schedule.times`). Un élément peut aussi revenir en `error` avec
`reasons: ["in_progress"]` ou `["temporarily_unavailable"]` et `retryable: true`.

### `list_recent_opportunities`

| | |
|---|---|
| Objectif | Connaître les offres déjà présentes pour ne pas les reproposer |
| Scope | `watch:read` (lecture seule) |
| Paramètres | `days` (1-60, défaut 14), `limit` (1-100, défaut 50) |
| Réponse | `{"items": [{"title", "company", "url", "status", "discovered_at"}], "total", "days"}` — toutes sources confondues, aucune description |
| Effets de bord | Aucun |

### `get_watch_status`

| | |
|---|---|
| Objectif | État de la veille |
| Scope | `watch:read` (lecture seule) |
| Paramètres | aucun |
| Réponse | `service: "ok"`, `active`, `preferences_version`, `max_per_run`, `daily_quota`, `remaining_today`, `timezone`, `last_run`, `presumed_missing_slots` |
| Effets de bord | Crée les préférences par défaut au premier accès |

`last_run` est la dernière exécution **du compte, tous clients confondus** (`run_id` d'origine,
`kind`, `scheduled_for`, `quota_day`, `first_seen_at`, `last_seen_at`, `observed`, `warnings`,
`report`). Interprétation : [VEILLE-PROGRAMMEE.md](./VEILLE-PROGRAMMEE.md).

### `report_watch_run`

| | |
|---|---|
| Objectif | Signaler la **fin** d'une exécution, même sans offre ou en cas d'échec |
| Scope | `opportunities:write` |
| Paramètres | `run_id`, `status` (`completed` / `partial` / `failed`) requis ; `searched_sources`, `candidates_considered`, `sent`, `notes` (500 caractères) facultatifs |
| Réponse | `{"run_id", "recorded": true, "observed": {"created", "duplicate", "rejected", "error"}}` |
| Effets de bord | Enregistre le rapport déclaré ; le dernier rapport fait foi |

Les chiffres **déclarés** par l'agent sont conservés à côté des compteurs **observés** par
JobTracker.

## `run_id`, idempotence et quotas

**Format** (heure de Paris) : `veille-AAAAMMJJ-HHMM-prog` (exécution programmée ; `HHMM` = heure
**prévue** du créneau) ou `veille-AAAAMMJJ-HHMM-manuel-xxxxxx` (exécution manuelle ; minute de
démarrage + 6 caractères `[a-z0-9]` tirés une fois). Calculé une seule fois au début et réutilisé
pour tous les appels et le rapport.

**Fenêtre** : nouvelle exécution entre −6 h et +15 min ; reprise d'une exécution connue jusqu'à
24 h. Heure inexistante refusée, heure ambiguë acceptée.

**Trois niveaux de clés** :

| Niveau | Clé | Effet |
|---|---|---|
| Exécution | `(compte, run_id, client)` | Compteurs, plafond de 20, rapport |
| Élément | exécution + `external_id` ou URL normalisée | Résultat **rejouable** : un renvoi rend le résultat enregistré (`replayed: true`) sans réécrire |
| Offre | `(compte, URL normalisée)` et `(compte, source, external_id)` | Jamais deux opportunités pour la même offre, quels que soient l'exécution ou le client |

**Isolation par client (P2)** : deux clients qui emploient le même `run_id` (par exemple le même
créneau `prog`) ont deux exécutions distinctes (clé interne `run_id#client_id`). Le `run_id`
renvoyé reste celui envoyé. Une exécution antérieure à P2 est poursuivie sous sa clé d'origine
par le même client.

**Quotas** : 20 créations par exécution (`min(max_per_run, WATCH_MAX_PER_RUN)`), 40 par jour et
par compte (`WATCH_DAILY_CREATE_QUOTA`), tous clients confondus ; le jour est celui du `run_id`
(heure de Paris). Les réservations sont atomiques ; **un doublon ou un rejet ne consomme rien**.

## Tests

`backend/tests/test_mcp_tools.py`, `test_mcp_transport.py`, `test_watch_ingest.py`,
`test_p2_public_clients.py`, `test_opportunity_origin.py`.
