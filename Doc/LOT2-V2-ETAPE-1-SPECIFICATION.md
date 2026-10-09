# JobTracker — Lot 2 V2 · Étape 1 : spécification du MCP réel (contrat et sécurité)

> **Référence** : [CDC-LOT2-JOBTRACKER-V2.md](./CDC-LOT2-JOBTRACKER-V2.md), étape 1 ·
> Gate 0 : [LOT2-V2-ETAPE-0-FAISABILITE.md §0 bis](./LOT2-V2-ETAPE-0-FAISABILITE.md),
> **GO conditionnel**.
> **Date** : 8 octobre 2026 · **Statut** : **révision 1.3, approuvée** (étape 1 clôturée ; D5
> précisée à l'approbation de l'étape 2).

## Journal des révisions

| Version | Date | Modifications |
|---|---|---|
| 1.0 | 8 octobre 2026 | Version initiale |
| **1.1** | 8 octobre 2026 | Prise en compte de la revue du propriétaire : **4 corrections** et verdicts D1 à D13. **OAuth** : machine d'états du grant, état « reconnexion nécessaire », test d'expiration accélérée E5 détaillé, test de compatibilité E0 en tête de l'étape 3 (§3.6, §3.7, §10). **Idempotence** : résultats par élément rejouables, réservation atomique par élément, quotas cohérents sous concurrence, reprise après interruption (§7). **Alertes** : distinction entre dernière exécution connue, absence présumée et détection automatique (non garantie sans service autonome) ; alertes uniquement sur événements observés (§7 bis). **Production** : interrupteur à deux niveaux, contrôles serveur, correction préalable de `/.well-known`, plan de retour arrière (§8 bis). **Divers** : URL dangereuses (§5.7), préférences détaillées champ par champ (§5.1), conditions de D13 (§8), tableau des décisions mis à jour (§11), plan avec portes de validation (§12) |
| **1.3** | 8 octobre 2026 | Précisions demandées à l'approbation de l'étape 2 : suffixe aléatoire des `run_id` manuels (pas de collision dans la même minute) ; fenêtre de validité détaillée (tâches retardées, reprises jusqu'à 24 h, heures inexistantes ou ambiguës lors des changements d'heure) ; jour du quota = date du `run_id` (§7.1) |
| **1.2** | 8 octobre 2026 | Clôture de l'étape 1. **D12 validée** : deux veilles par jour à **08:00** et **18:00**, Europe/Paris (§5.1). **D2** : 24 h n'est **qu'une mesure transitoire**, jamais une solution définitive (§3.7). **D5** : `run_id` en heure de Paris, avec le type d'exécution, qui distingue les exécutions indépendantes et reste identique lors des reprises (§7.1). Plan détaillé de l'étape 2 : [LOT2-V2-ETAPE-2-PLAN.md](./LOT2-V2-ETAPE-2-PLAN.md) |

> **Statuts des décisions (révision 1.2)** : validées (D3, D4, D5 précisée, D6, D7, D11, **D12**) ;
> conditionnelles, soumises à une preuve technique (D1, D2, D10, D13) ; ajustées, à revalider
> (D8, D9). Voir le §11.
> **Principe intangible (CDC §1)** : **ChatGPT cherche et qualifie les offres ; JobTracker
> reçoit, valide, déduplique et stocke.** Aucun moteur de recherche d'offres, cron de collecte
> ni LLM côté serveur.

---

## 1. Synthèse

- Le **MCP JobTracker est intégré au backend FastAPI existant**, servi par la même fonction
  Vercel. Endpoint unique : `https://jobtracker.maadec.com/api/mcp`, en transport
  **streamable HTTP sans état** (réponses JSON, sans flux longs).
- **JobTracker est son propre serveur d'autorisation OAuth 2.1** : code d'autorisation, PKCE
  S256, paramètre `resource` (RFC 8707), métadonnées RFC 9728 et RFC 8414. Les jetons sont
  **opaques, hachés en base, liés à l'audience du MCP**.
- **5 outils**, aux droits minimaux : `get_watch_preferences`, `create_opportunities` (20 au
  plus par appel et par exécution), `list_recent_opportunities`, `get_watch_status`,
  `report_watch_run`. Aucune suppression, aucune candidature, aucun accès admin.
- **Idempotence à deux niveaux** : `run_id` d'exécution, puis déduplication par offre du Lot 1
  (URL normalisée, `external_id`). Une exécution répétée (« Run now » ou retry) ne crée **jamais**
  de doublon.
- **Réutilisation maximale du Lot 1** : `opportunity_service`, mécanisme de quota atomique,
  conventions de hachage, validation des URL. **Aucun second stockage.**
- **Risque principal non levé** : le comportement de ChatGPT quand un **jeton expire pendant
  une tâche programmée** (R3), à tester en priorité à l'étape 5.

---

## 2. Architecture

```
ChatGPT (tâche programmée « Veille CDI Data junior »)
  │  1. recherche web + sélection (côté ChatGPT, hors JobTracker)
  │  2. appels MCP authentifiés (Bearer, jeton OAuth)
  ▼
https://jobtracker.maadec.com/api/mcp        ← même déploiement Vercel (fonction Python)
  │  FastAPI ── /api/mcp           : serveur MCP (SDK `mcp`, streamable HTTP, stateless, JSON)
  │          ── /api/oauth/*       : serveur d'autorisation (authorize, token, revoke)
  │          ── /.well-known/*     : métadonnées RFC 9728 / RFC 8414
  │          ── /api/watch/*       : préférences et état (UI JobTracker, JWT utilisateur)
  ▼
services (Lot 1 + Lot 2)
  ├─ opportunity_service   (ingestion idempotente, dédoublonnage) ← réutilisé tel quel
  ├─ watch_service         (préférences, exécutions, validation métier)  ← nouveau
  ├─ oauth_service         (clients, codes, jetons, révocation)          ← nouveau
  └─ quota (mécanisme atomique du Lot 1, généralisé)                    ← adapté
  ▼
MongoDB : opportunities · watch_preferences · watch_runs · oauth_clients · oauth_codes
          · oauth_grants · oauth_tokens · usage (quotas)
  ▼
Interface JobTracker : Opportunités (Lot 1) · Préférences de veille · Connexions ChatGPT · Exécutions
```

### 2.1 Intégration au backend existant

| Élément | Choix | Justification |
|---|---|---|
| Hébergement | Même projet Vercel et même fonction Python (`backend/api/index.py`) | Pas de nouveau service (CDC : éviter les services inutiles) |
| SDK | `mcp` (SDK officiel Python, version 2.x, déjà validé au Gate 0), monté comme application ASGI dans FastAPI | Prototype P0 à P2 validé avec ce SDK |
| Transport | **Streamable HTTP**, `stateless_http=True`, `json_response=True` | Compatible serverless (aucune session en mémoire, aucun flux long) ; validé au Gate 0 |
| Accès aux données | Exclusivement via les **services** ; aucun accès Mongo direct depuis les outils | Une seule couche métier (CDC §5.1) |
| Nouvelle dépendance | `mcp` (backend) | **Décision D13** : impact sur la taille de la fonction Vercel à vérifier |

### 2.2 Exposition HTTPS (Vercel)

| Chemin public | Cible | Remarque |
|---|---|---|
| `/api/mcp` | backend | Déjà couvert par la règle `/api/(.*)` |
| `/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/revoke` | backend | Déjà couverts |
| `/.well-known/oauth-protected-resource` et `/.well-known/oauth-protected-resource/api/mcp` | backend | ⚠️ **Nouvelle règle nécessaire**, à placer **avant** `/(.*)\.(.*)`, qui envoie aujourd'hui ces chemins vers le frontend (vérifié) |
| `/.well-known/oauth-authorization-server` | backend | Idem |
| `/oauth/consent` | frontend (React) | Page de consentement, avec session JobTracker existante |

**Ressource canonique** (RFC 8707 / RFC 9728) : `https://jobtracker.maadec.com/api/mcp`
(minuscules, sans slash final). L'alias `job-tracker-steel-eight.vercel.app` **n'est pas** une
ressource valide pour le MCP : un seul émetteur, une seule audience.

### 2.3 Isolation par utilisateur

- `user_id` est **dérivé du jeton** (grant OAuth), **jamais** d'un argument d'outil ni d'un
  texte produit par le LLM.
- Chaque service reçoit `user_id` en paramètre explicite. Les requêtes Mongo filtrent
  **toujours** sur `user_id`, comme au Lot 1.
- **MVP propriétaire uniquement** (CDC §2) : l'autorisation n'est accordée qu'aux comptes
  activés pour la veille (`watch_enabled=true`, positionné par l'admin, ou liste blanche
  `MCP_ALLOWED_USER_IDS`). Tout autre compte reçoit `access_denied` à l'étape de consentement
  (**D7**).

---

## 3. OAuth 2.1

### 3.1 Découverte

**Métadonnées de ressource protégée** (RFC 9728) : `GET /.well-known/oauth-protected-resource`,
et la variante suffixée `/.well-known/oauth-protected-resource/api/mcp`.

```json
{
  "resource": "https://jobtracker.maadec.com/api/mcp",
  "authorization_servers": ["https://jobtracker.maadec.com"],
  "scopes_supported": ["watch:read", "opportunities:write"],
  "bearer_methods_supported": ["header"],
  "resource_name": "JobTracker"
}
```

**Métadonnées du serveur d'autorisation** (RFC 8414) :
`GET /.well-known/oauth-authorization-server`.

```json
{
  "issuer": "https://jobtracker.maadec.com",
  "authorization_endpoint": "https://jobtracker.maadec.com/api/oauth/authorize",
  "token_endpoint": "https://jobtracker.maadec.com/api/oauth/token",
  "revocation_endpoint": "https://jobtracker.maadec.com/api/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
  "scopes_supported": ["watch:read", "opportunities:write"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": false
}
```

`client_id_metadata_document_supported` passe à `true` si CIMD est retenu (**D1**).

**Défi 401** sur `/api/mcp` sans jeton, ou avec un jeton invalide ou expiré :

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://jobtracker.maadec.com/.well-known/oauth-protected-resource/api/mcp", scope="watch:read opportunities:write"
```

### 3.2 Enregistrement du client (D1)

> **Révision 1.1 (D1 conditionnelle)** : le client pré-enregistré reste l'option du MVP,
> **sous réserve d'une preuve réelle** que ChatGPT l'accepte **avec PKCE S256** et le paramètre
> `resource`. Cette preuve est le **test E0**, première porte de l'étape 3, avant tout
> développement des outils. **Repli** si E0 échoue : CIMD (option B), puis nouvelle revue.

| Option | Fonctionnement | Avis |
|---|---|---|
| **A. Client pré-enregistré** (*static credentials*) | Un `client_id` et un `client_secret` générés par JobTracker, que tu saisis dans la configuration du plugin ChatGPT (*« If static credentials are provided, then they will be used »*) | **Recommandé pour le MVP** (un seul utilisateur) : surface minimale, pas de récupération d'URL externe. Secret haché en base, rotation possible |
| B. CIMD | Le `client_id` est une URL HTTPS de ChatGPT ; JobTracker récupère et valide le document (`redirect_uris`) | Recommandé par OpenAI et MCP **à l'échelle**. Ajoute un appel HTTP sortant, un cache et une validation : complexité moyenne |
| C. DCR (RFC 7591) | Enregistrement automatique | **Déconseillé** : déprécié par la spécification MCP 2026-07-28 et surface d'abus plus large |

**URI de redirection autorisées** (liste blanche exacte, aucun motif générique) :
`https://chatgpt.com/connector_platform_oauth_redirect`, ainsi que l'URI
`https://chatgpt.com/connector/oauth/{callback_id}` **exacte** affichée dans la configuration
du plugin si ChatGPT l'utilise. **Toute autre URI est refusée**, sans redirection (protection
contre l'*open redirect*).

### 3.3 Flux d'autorisation

1. ChatGPT appelle `GET /api/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&code_challenge=…&code_challenge_method=S256&state=…&scope=…&resource=https%3A%2F%2Fjobtracker.maadec.com%2Fapi%2Fmcp`.
2. Le backend **valide tout** :
   - client connu ;
   - `redirect_uri` exacte ;
   - `S256` obligatoire (`plain` refusé) ;
   - `resource` égal à la ressource canonique ;
   - scopes inclus dans la liste autorisée.

   Il redirige ensuite vers la page frontend `/oauth/consent?request=<id>` (demande stockée
   10 minutes, à usage unique).
3. **Page de consentement** (JobTracker, session existante ; connexion demandée si absente).
   Elle affiche :
   - le client (« ChatGPT ») ;
   - les permissions en clair ;
   - le compte concerné.

   Boutons *Autoriser* et *Refuser*. Le compte doit être éligible (**D7**).
4. *Autoriser* → `POST /api/oauth/consent` (JWT utilisateur, protection CSRF par l'ID de
   demande à usage unique) → génération d'un **code d'autorisation** (aléatoire 256 bits,
   haché en base, **60 secondes**, usage unique, lié au client, à la `redirect_uri`, au
   `code_challenge`, à la ressource, aux scopes et à l'utilisateur) → redirection vers
   `redirect_uri?code=…&state=…&iss=https%3A%2F%2Fjobtracker.maadec.com` (RFC 9207).
5. `POST /api/oauth/token` (`grant_type=authorization_code`, `code`, `code_verifier`,
   `redirect_uri`, `resource`, authentification du client) → vérifications **PKCE**, usage
   unique et correspondance de tous les paramètres → émission des jetons.

### 3.4 Jetons

| Jeton | Format | Durée (proposition, **D2**) | Stockage |
|---|---|---|---|
| **Access token** | Opaque, `jt_oat_` + 256 bits | **1 heure** | SHA-256 seulement ; lié à `grant_id`, `user_id`, `aud`, `scopes`, `exp` |
| **Refresh token** | Opaque, `jt_ort_` + 256 bits | **30 jours glissants**, **rotation à chaque usage**, durée absolue **90 jours** | SHA-256 ; famille de rotation suivie |
| Code d'autorisation | Opaque | 60 s, usage unique | SHA-256 |

**Pourquoi des jetons opaques plutôt que des JWT** :
- révocation **immédiate** par simple consultation en base, comme pour les tokens agent du
  Lot 1 ;
- pas de JWKS à publier, puisque le serveur d'autorisation et le serveur de ressource sont le
  même service ;
- pas de dépendance à `JWT_SECRET` (S3).

**Validation à chaque requête MCP** :
- le jeton existe (recherche par hash) ;
- il n'est ni expiré ni révoqué ;
- `aud == https://jobtracker.maadec.com/api/mcp` ;
- le grant est actif ;
- l'utilisateur est actif et éligible ;
- les scopes couvrent l'outil appelé (403 `insufficient_scope` sinon).

Une seule lecture indexée, plus le contrôle de l'utilisateur.

**Rotation et réutilisation** : la réutilisation d'un refresh token déjà consommé **révoque
toute la famille** (vol présumé). Tolérance de 30 secondes pour une double requête légitime
(retry réseau) : on renvoie la même paire.

### 3.5 Scopes et permissions par outil

| Scope | Outils | Contenu |
|---|---|---|
| `watch:read` | `get_watch_preferences`, `list_recent_opportunities`, `get_watch_status` | Préférences de veille, résumé minimal des opportunités récentes (titre, entreprise, URL, statut, date), état du service |
| `opportunities:write` | `create_opportunities`, `report_watch_run` | Création d'opportunités `new` et compte-rendu d'exécution |

**Aucun scope ne donne accès** aux candidatures, documents, CV, entretiens, statistiques
détaillées, paramètres, clés IA, administration ou aux autres comptes.

Les scopes AgentToken du Lot 1 (`opportunities:create`) restent inchangés et séparés : un jeton
`jt_agent_` **n'est jamais accepté** sur `/api/mcp`, et un jeton OAuth jamais sur
`/api/agent/*`.

### 3.6 Révocation

- **Par l'utilisateur** : Paramètres → « Connexions ChatGPT » → *Révoquer*. Cela révoque le
  grant, tous ses access tokens et ses refresh tokens. **Effet immédiat**, puisque les jetons
  sont opaques.
- **Par ChatGPT** : `POST /api/oauth/revoke` (RFC 7009).
- **Automatique** :
  - compte désactivé ou plus éligible → refus à la validation ;
  - réutilisation d'un refresh token → révocation de la famille.

### 3.7 Expiration pendant une tâche ChatGPT (risque R3) — révisé en 1.1

**Principe (correction 1)** : le fonctionnement **ne repose sur aucune hypothèse** concernant le
renouvellement par ChatGPT pendant une tâche. Ce comportement est **non documenté** et sera
**mesuré** (E5). En attendant, chaque situation d'authentification fait passer le grant dans un
**état explicite**, visible dans l'interface.

#### Machine d'états du grant (`oauth_grants.status`)

| État | Signification | Entrée | Sortie |
|---|---|---|---|
| `active` | Autorisation valide, jetons utilisables | Consentement réussi ; refresh réussi | Expiration, révocation, réutilisation |
| `access_expired_observed` | Au moins un appel MCP a présenté un **access token expiré** depuis le dernier refresh réussi | 401 « jeton expiré » sur `/api/mcp` | → `active` si un refresh réussit ; → `reconnection_required` si aucun refresh dans les **15 min** suivant le premier rejet, **constaté à la consultation suivante** (pas de surveillance active) |
| `reconnection_required` | **Reconnexion nécessaire** : ChatGPT ne peut plus obtenir de jeton valide sans toi | Refresh token expiré (glissant ou absolu) ; `invalid_grant` au refresh ; état précédent non résolu ; **expiration absolue atteinte** | → `active` uniquement par un **nouveau consentement** (même client) ; l'ancien grant passe alors `superseded` |
| `revoked` | Révoqué par toi, par ChatGPT (RFC 7009) ou par l'admin | Action de révocation | Terminal |
| `compromised` | Réutilisation d'un refresh token déjà consommé, en dehors de la fenêtre de tolérance | Détection de réutilisation | Terminal : famille révoquée, alerte immédiate |
| `superseded` | Remplacé par un nouveau grant après reconnexion | Nouveau consentement | Terminal |

**Pré-alerte** : 7 jours avant l'expiration absolue (90 jours), l'état reste `active` mais
l'interface affiche **« Reconnexion à prévoir avant le JJ/MM »**.

#### Comportement serveur par situation

| Situation | Réponse HTTP | Effet sur le grant | Effet attendu côté ChatGPT | Statut |
|---|---|---|---|---|
| Access token expiré, refresh valide | 401 + `WWW-Authenticate` (`error="invalid_token"`, `error_description="expired"`) | `access_expired_observed` | Rafraîchit automatiquement **si** ChatGPT le fait en tâche | **Non documenté : E5** |
| Refresh réussi | — | → `active` | Appel suivant OK | — |
| Refresh token expiré ou révoqué | `400 invalid_grant` (endpoint token) | → `reconnection_required` | Nouvelle autorisation impossible en ton absence : **l'exécution échoue** | Certain |
| Grant `revoked`, `compromised` ou `superseded` | 401 | Inchangé | Idem | Certain |

#### Révision de D2 (durée des jetons) — **conditionnelle à E5**

| Résultat E5 | Réglage retenu |
|---|---|
| ChatGPT **rafraîchit** pendant les tâches | Access **1 h**, refresh **30 jours glissants**, **90 jours absolus** (hypothèse actuelle) |
| ChatGPT **ne rafraîchit pas** pendant les tâches | **Mesure transitoire uniquement** (voir ci-dessous) : access porté à **24 h**, **nouvelle revue de sécurité**, puis arbitrage définitif |
| Comportement **instable** | NO-GO conditionnel : arbitrage (CDC §4.4) |

> **Précision 1.2 : 24 h n'est pas une solution définitive.** Si ChatGPT ne renouvelle pas
> lui-même les jetons pendant une tâche, un access token de 24 h expire de toute façon au bout
> de 24 h. Il ne reste alors valide que si **tu ouvres ChatGPT** au moins une fois par jour pour
> provoquer un renouvellement. La veille dépend donc encore de ta présence, ce qui ne satisfait
> pas l'objectif « sans présence » (CDC §4.4 et §7.1). Elle élargit aussi la fenêtre
> d'exploitation d'un jeton volé.
>
> Règles, si ce cas se produit :
> - durée **24 h maximum**, jamais davantage (pas de 7 jours ni de jeton sans expiration) ;
> - mesure **limitée dans le temps** : **30 jours au plus**, ou jusqu'à la décision définitive ;
> - les échecs d'expiration restent visibles (§3.7, §7 bis), sans être masqués ;
> - **décision définitive obligatoire**, par arbitrage explicite du propriétaire (CDC §4.4) :
>   (a) nouveau test E5 si ChatGPT évolue, ou (b) **NO-GO conditionnel** du mode autonome. Un
>   mode seulement interactif ne remplit pas l'objectif principal du lot.

**Jamais d'invention** : JobTracker n'affirme pas qu'une veille a eu lieu sans signal reçu
(CDC §5.6). Les alertes sont traitées au §7 bis.

---

## 4. Catalogue des outils MCP

Tous les outils renvoient `structuredContent` et une copie JSON dans `content` (compatibilité
client). Les annotations `readOnlyHint` sont exactes, car ChatGPT les utilise pour ses règles de
confirmation.

| Outil | Scope | `readOnlyHint` | Rôle |
|---|---|---|---|
| `get_watch_preferences` | `watch:read` | `true` | Critères de veille du compte : **source de vérité lue au début de chaque exécution** |
| `create_opportunities` | `opportunities:write` | `false` (non destructif, idempotent par élément) | Envoi groupé de 1 à **20** offres pour une exécution `run_id` |
| `list_recent_opportunities` | `watch:read` | `true` | Offres déjà connues (pour ne pas reproposer les mêmes) |
| `get_watch_status` | `watch:read` | `true` | État : veille active ou en pause, quotas restants, dernière exécution |
| `report_watch_run` | `opportunities:write` | `false` | **Signal explicite de fin d'exécution** (CDC §5.6) : sans lui, JobTracker ne peut pas prouver qu'une veille s'est terminée (**D6**) |

**Exclus explicitement** : suppression, modification d'opportunité, conversion en candidature,
envoi de candidature, accès aux documents ou aux candidatures, administration, exécution de code.

**Séquence attendue d'une exécution** (inscrite dans l'instruction de la tâche ChatGPT) :
`get_watch_preferences` → (recherche web côté ChatGPT) → `list_recent_opportunities` (optionnel)
→ `create_opportunities` (un ou plusieurs appels, même `run_id`) → `report_watch_run`.

---

## 5. Contrats JSON

### 5.1 `get_watch_preferences`

**Entrée** : `{}`.

**Sortie** :
```json
{
  "active": true,
  "countries": ["FR", "CH", "BE", "LU"],
  "job_families": ["data_engineering", "data_science", "big_data", "ai_ml", "data_analytics"],
  "title_keywords": ["Data Engineer", "Data Scientist", "ML Engineer", "Ingénieur Data"],
  "exclusions": ["stage", "alternance", "senior", "lead", "freelance"],
  "seniority": ["junior", "entry_level", "graduate"],
  "contract_types": ["permanent"],
  "languages": ["fr", "en"],
  "min_score": 75,
  "max_per_run": 20,
  "schedule": {"timezone": "Europe/Paris", "times": ["08:00", "18:00"]},
  "scoring_rubric": "Pays cible +20 ; CDI/permanent +25 ; junior/jeune diplômé +25 ; métier Data cœur +20 ; lien direct vers l'offre +10. Exclure si stage/alternance/senior.",
  "preferences_version": 3,
  "updated_at": "2026-10-08T10:00:00Z"
}
```

`preferences_version` permet de tracer **quelle version** des critères ChatGPT a appliquée
(CDC §7.5). Le champ `scoring_rubric` est éditable et révisable (CDC §2).

#### Détail des champs — **D12 validée (révision 1.2)**

| Champ | Type et contraintes | Valeur initiale proposée | Modifiable dans l'interface | Utilisé par |
|---|---|---|---|---|
| `active` | booléen | `true` | Oui (pause logique) | ChatGPT (arrêt), serveur (`watch_paused`) |
| `countries` | liste ISO alpha-2, 1 à 10 | `FR, CH, BE, LU` | Oui | ChatGPT et **validation serveur** |
| `job_families` | liste parmi `data_engineering`, `data_science`, `big_data`, `ai_ml`, `data_analytics`, `mlops`, `bi` | les 5 premières | Oui | ChatGPT |
| `title_keywords` | liste de 0 à 20 chaînes ≤ 60 caractères | Data Engineer, Data Scientist, ML Engineer, Ingénieur Data | Oui | ChatGPT |
| `exclusions` | liste de 0 à 20 chaînes ≤ 60 caractères | stage, alternance, senior, lead, freelance | Oui | ChatGPT |
| `seniority` | liste parmi `junior`, `entry_level`, `graduate`, `mid` | `junior, entry_level, graduate` | Oui | ChatGPT et **validation serveur** (si fourni) |
| `contract_types` | liste parmi `permanent`, `fixed_term`, `freelance`, `internship`, `apprenticeship` | `permanent` | Oui | ChatGPT et **validation serveur** |
| `languages` | liste ISO 639-1 | `fr, en` | Oui | ChatGPT |
| `min_score` | entier de 50 à 100 | **75** | Oui | ChatGPT et **validation serveur** |
| `max_per_run` | entier de 1 à 20 | **20** | Oui (à la baisse) | ChatGPT et serveur |
| `schedule` | fuseau **`Europe/Paris` fixe en v1** ; 1 à 4 heures `HH:MM` | **`08:00`, `18:00`** (**validé**) | Oui (heures seulement) | **Information** (`run_id` `prog`, absence présumée, §7.1 et §7 bis) : **ne programme rien** côté ChatGPT |
| `scoring_rubric` | texte ≤ 1 500 caractères | grille ci-dessus | Oui | ChatGPT |
| `preferences_version` | entier, incrémenté à chaque modification | 1 | Non | Traçabilité |

> **Limite importante (CDC §5.5)** : modifier `schedule` dans JobTracker **ne modifie pas** les
> horaires de la tâche ChatGPT. Ils doivent être mis à jour **à la main** dans ChatGPT.
> L'interface l'indiquera explicitement. Les **critères** (pays, métiers, seuil…), eux, sont
> lus par ChatGPT à chaque exécution via `get_watch_preferences`, à condition que
> l'instruction de la tâche impose cet appel.

> **D12 (validée le 8 octobre 2026)** : deux veilles par jour, à **08:00** et **18:00**, heure
> de Paris (`Europe/Paris`, heure d'été et d'hiver gérées). Ces horaires sont destinés
> **uniquement** à la future automatisation ChatGPT → MCP → JobTracker, qui sera créée à
> l'étape 6. **Les tâches ChatGPT existantes ne sont pas modifiées.**

### 5.2 `create_opportunities`

**Entrée** :
```json
{
  "run_id": "veille-20261009-0800-prog",
  "preferences_version": 3,
  "opportunities": [
    {
      "title": "Data Engineer Junior",
      "company": "Orange",
      "url": "https://careers.orange.com/jobs/12345",
      "country": "FR",
      "location": "Paris",
      "contract_type": "CDI",
      "seniority": "junior",
      "description": "Pipelines Spark/Airflow… (texte brut, 10 000 caractères max)",
      "external_id": "orange:12345",
      "discovered_at": "2026-10-09T06:02:00Z",
      "relevance_score": 86,
      "relevance_reasons": ["CDI à Paris", "Poste junior explicite", "Stack Spark/Airflow"],
      "source_evidence": {"url": "https://careers.orange.com/jobs/12345", "excerpt": "Jeune diplômé(e) bienvenu(e)…"},
      "uncertain_fields": ["seniority"]
    }
  ]
}
```

**Validation** : schéma strict, `additionalProperties: false`. Un `user_id` ou un `source`
fourni est **refusé**.

| Champ | Règle | Si non respectée |
|---|---|---|
| `run_id` | Requis, `^veille-\d{8}-\d{4}-(prog\|manuel-[a-z0-9]{6})$`, heure de Paris, fenêtre de validité, UUID refusé (§7.1, **D5**) | Appel refusé (`invalid_run_id` / `run_id_out_of_window`) |
| `opportunities` | 1 à 20 éléments | Appel refusé |
| `title`, `company` | Requis, 1 à 200 caractères, sans contrôle de caractères | Élément `rejected` |
| `url` | Requis, **HTTPS uniquement** (**D11**), 2 000 caractères max, protections du §5.7, normalisé (Lot 1) | `rejected` (`invalid_url` ou code du §5.7) |
| `country` | Requis, ISO-3166 alpha-2 ∈ `preferences.countries` | `rejected` (`country_not_targeted`) |
| `contract_type` | Requis ; normalisé (`CDI`, `permanent`, `unbefristet`, `indefinite`… → `permanent`) ∈ `preferences.contract_types` | `rejected` (`contract_not_targeted`) |
| `seniority` | Optionnel ; si présent, ∈ `preferences.seniority` | `rejected` (`seniority_not_targeted`) |
| `relevance_score` | Requis, entier de 0 à 100 ; **≥ `min_score`** | `rejected` (`score_below_threshold`) |
| `relevance_reasons` | 1 à 5 chaînes de 200 caractères max | `rejected` |
| `source_evidence` | Optionnel ; `url` HTTPS et `excerpt` de 500 caractères max | Champ ignoré si invalide (avertissement) |
| `uncertain_fields` | Optionnel ; noms de champs connus | Affiché « incertain » dans l'interface (CDC §7.4) |
| `description` | 10 000 caractères max, texte brut | Tronqué (avertissement) |
| `external_id` | Optionnel, 200 caractères max | — |
| *Toute* exécution | Veille en pause (`active=false`) | Tous les éléments `rejected` (`watch_paused`) |
| *Toute* exécution | Plus de 20 créations sur le même `run_id`, ou quota journalier atteint | Éléments excédentaires `rejected` (`run_limit_reached` / `daily_quota_reached`) ; doublons et rejeux sans coût (§7.3) |

Le score de ChatGPT est **conservé comme estimation** et jamais recalculé ni garanti. Les règles
**déterministes** (pays, contrat, format, bornes, cohérence du lien) sont toujours vérifiées
côté serveur (CDC §5.4).

**Sortie** :
```json
{
  "run_id": "veille-20261009-0800-prog",
  "summary": {"received": 3, "created": 1, "duplicate": 1, "rejected": 1, "error": 0},
  "run_totals": {"created": 1, "remaining_for_run": 19, "remaining_today": 39},
  "results": [
    {"index": 0, "status": "created", "opportunity_id": "9b1d…", "warnings": []},
    {"index": 1, "status": "duplicate", "opportunity_id": "77ac…", "duplicate_reason": "url"},
    {"index": 2, "status": "rejected", "reasons": ["score_below_threshold"]}
  ]
}
```

**Stockage** : le champ `source` vaut `chatgpt_watch` (imposé par le serveur), statut `new`.
Les champs de pertinence vont dans un sous-document dédié `watch`
(`run_id`, `relevance_score`, `relevance_reasons`, `source_evidence`, `uncertain_fields`,
`preferences_version`). **D4 validée** : sous-document dédié.

### 5.3 `list_recent_opportunities`

- **Entrée** : `{"days": 14, "limit": 50}`, avec `days` de 1 à 60 et `limit` de 1 à 100.
- **Sortie** : `{"items": [{"title", "company", "url", "status", "discovered_at"}], "total"}`.
- **Aucune** description, aucune candidature, aucune donnée personnelle au-delà de ces champs.

### 5.4 `get_watch_status`

**Sortie** :
```json
{"service": "ok", "active": true, "preferences_version": 3,
 "remaining_today": 39, "max_per_run": 20,
 "last_run": {"run_id": "veille-20261009-0800-prog", "status": "completed", "created": 1, "at": "2026-10-09T06:04:10Z"}}
```

### 5.5 `report_watch_run`

**Entrée** :
```json
{"run_id": "veille-20261009-0800-prog", "status": "completed",
 "searched_sources": 12, "candidates_considered": 35, "sent": 3,
 "notes": "Peu d'offres junior en Suisse cette fois."}
```

- `status` ∈ `completed | partial | failed`.
- `notes` : 500 caractères max, texte brut.
- **Idempotent** : le dernier rapport du `run_id` fait foi (**D6 validée**, statuts `completed`, `partial`, `failed`).
- **Sortie** : `{"run_id", "recorded": true, "observed": {"created", "duplicate", "rejected"}}`.
  Les compteurs **observés par JobTracker** sont renvoyés à côté des chiffres **déclarés** par
  ChatGPT : JobTracker distingue ce qu'il a vu de ce qui lui est déclaré (CDC §5.6).

### 5.6 Erreurs

| Niveau | Cas | Réponse |
|---|---|---|
| HTTP | Jeton absent, invalide ou expiré | **401** + `WWW-Authenticate` (§3.1) |
| HTTP | Scope insuffisant | **403** `error="insufficient_scope"`, `scope=…`, `resource_metadata=…` |
| HTTP | Rafale dépassée | **429** + `Retry-After` |
| MCP (`isError: true`) | Arguments invalides | `{"error": {"code": "invalid_arguments", "details": [...]}}` (sans écho des valeurs) |
| MCP | Indisponibilité temporaire (base de données) | `{"error": {"code": "temporarily_unavailable", "retryable": true}}` |
| Par élément | Règle métier | `status: "rejected"` et `reasons` (jamais d'échec global pour un seul élément) |

### 5.7 URL des offres : protections (D11 validée, renforcée en 1.1)

**JobTracker ne visite jamais les URL des offres** : il n'y a donc aucun risque de SSRF côté
serveur. Les protections visent ce qui est **stocké** et **affiché** puis cliqué par toi.

| Règle | Refus (`rejected`, raison) |
|---|---|
| Schéma `https` uniquement | `invalid_url` |
| Pas d'identifiants dans l'URL (`user:pass@`) | `url_userinfo_forbidden` |
| Hôte = nom de domaine public ; refus des adresses IP littérales, de `localhost`, des domaines locaux (`.local`, `.internal`, `.lan`), des suffixes **inconnus de la Public Suffix List** et des hôtes qui **sont** un suffixe public (`co.uk`, `github.io`) | `url_host_forbidden` |
| Port par défaut uniquement (443) | `url_port_forbidden` |
| Longueur ≤ 2 000, sans caractères de contrôle ni espaces | `invalid_url` |
| **Raccourcisseurs et redirecteurs connus** (`bit.ly`, `t.co`, `lnkd.in`, `goo.gl`, `tinyurl.com`, paramètres de redirection `url=`, `redirect=`, `dest=` pointant vers un autre **domaine enregistrable**, déterminé par la Public Suffix List : `a.co.uk` et `b.co.uk` sont deux sites distincts) | `url_redirector_forbidden` : on exige le **lien direct** vers l'offre (CDC §5.4) |
| Domaine **IDN / punycode** (`xn--`) | **Accepté**, mais signalé `uncertain_fields: ["url"]` (risque d'homographe), et le domaine est affiché en clair dans l'interface |
| Incohérence entre le domaine enregistrable (PSL) de `url` et celui de `source_evidence.url` | Accepté, mais marqué `uncertain` |

**Affichage** : le domaine est montré en clair à côté du lien. Le lien s'ouvre dans un nouvel
onglet avec `rel="noopener noreferrer"` (Lot 1). Seuls les liens `https` sont cliquables
(`toSafeExternalUrl`, Lot 1).

---

## 6. Sécurité

### 6.1 Principes

| Exigence | Mesure |
|---|---|
| Moindre privilège | 2 scopes ; 5 outils bornés ; aucun outil destructif |
| Aucun accès à d'autres comptes | `user_id` dérivé du grant ; filtres `user_id` systématiques ; arguments `user_id` refusés ; MVP propriétaire uniquement (§2.3) |
| Liaison de l'audience | `aud` vérifié à chaque appel (RFC 8707) ; aucun autre jeton accepté, aucun transit de jeton (*token passthrough* interdit par la spécification MCP) |
| Secrets | Jetons, codes et `client_secret` **hachés** (SHA-256) ; bruts montrés une seule fois ; jamais dans les URL (sauf le code d'autorisation, à usage unique et de 60 s, selon OAuth) |
| Journalisation | Sans en-tête `Authorization` ni jeton. Champs journalisés : horodatage, `grant_id` (préfixe), `user_id`, outil, `run_id`, compteurs, codes d'erreur. Contenu des offres non journalisé |
| Consentement | Page JobTracker, `X-Frame-Options: DENY` et CSP `frame-ancestors 'none'` (anti-clickjacking), demande à usage unique |
| Redirections | Liste blanche exacte ; aucune redirection si `redirect_uri` est invalide |
| Injection de contenu (offres web manipulées) | Texte brut uniquement, tailles bornées, URL HTTPS validées, rendu React échappé (Lot 1), aucun outil exploitable pour exfiltrer des données |
| S3 | Corrigée et déployée (`ef07ab6`). Les jetons OAuth n'en dépendent pas |
| S1 et S2 (dette) | Hors périmètre, non aggravées (aucune route IA touchée) |

### 6.2 Limites de débit et quotas

> **Révision 1.1 (D9 ajustée)** : les compteurs atomiques, l'ordre de réservation et la gestion
> des retries et de la concurrence sont spécifiés au **§7.3**. Les valeurs ci-dessous sont
> inchangées et configurables par variables d'environnement.

| Niveau | Valeur proposée (**D9**) | Mécanisme |
|---|---|---|
| Rafale par grant | 30 requêtes MCP par minute | slowapi, clé = hash du jeton (par instance, comme au Lot 1) |
| Éléments par appel | 20 au plus | Schéma |
| Créations par `run_id` | 20 au plus | Compteur atomique dans `watch_runs` |
| Créations par jour et par utilisateur | **40** (2 exécutions × 20) | Réservation atomique Mongo, mécanisme du Lot 1 généralisé ; **un doublon ne consomme rien** |
| Endpoint token | 10 requêtes par minute et par IP, plus par client | slowapi |
| Endpoint authorize et consentement | 10 requêtes par minute et par utilisateur | slowapi |

---

## 7. Idempotence — révisé en 1.1 (correction 2)

### 7.1 `run_id` : stable, jamais aléatoire par appel (D5 validée, précisée en 1.2 et 1.3)

**Format** (révision 1.3) :

- exécution programmée : `veille-AAAAMMJJ-HHMM-prog` ;
- exécution manuelle : `veille-AAAAMMJJ-HHMM-manuel-xxxxxx`, où `xxxxxx` est un **suffixe de
  6 caractères `[a-z0-9]`** tiré **une seule fois** au démarrage.

Expression contrôlée par le serveur :
`^veille-(\d{8})-(\d{4})-(prog|manuel-[a-z0-9]{6})$`.

| Élément | Règle |
|---|---|
| **Fuseau** | `AAAAMMJJ` et `HHMM` sont **toujours en heure de Paris** (`Europe/Paris`, heure d'été ou d'hiver), **jamais en UTC**. Le serveur les interprète avec `zoneinfo("Europe/Paris")` |
| **`prog`** (tâche programmée) | `HHMM` est l'**heure prévue du créneau** (`0800` ou `1800`), **pas** l'heure réelle d'appel. L'identifiant est donc **déterministe** : un retard de l'ordonnanceur (2 à 4 min mesurées) ou un recalcul donnent toujours le même |
| **`manuel`** (« Run now » ou conversation) | `HHMM` est la **minute réelle de démarrage** en heure de Paris, suivie du suffixe aléatoire. **Deux exécutions manuelles indépendantes lancées dans la même minute ont donc deux identifiants distincts** (1 chance sur 2,2 milliards de collision) |
| **Calcul** | Une seule fois, **au début** de l'exécution (instruction de la tâche) |
| **Reprises** | L'identifiant **d'origine**, suffixe compris, est réutilisé pour tous les appels de l'exécution : envois successifs, retries réseau, reprise après erreur, `report_watch_run`. Il ne doit **jamais** être recalculé |

**Exécutions indépendantes : toujours des identifiants distincts**

| Cas | Identifiants |
|---|---|
| Veille de 08:00 et veille de 18:00 du même jour | `veille-20261009-0800-prog` ≠ `veille-20261009-1800-prog` |
| Même créneau, jour suivant | `veille-20261009-0800-prog` ≠ `veille-20261010-0800-prog` |
| « Run now » à 08:03 en plus de la veille programmée de 08:00 | `veille-20261009-0803-manuel-k3x9q2` ≠ `veille-20261009-0800-prog` |
| Deux « Run now » **dans la même minute** | `…-1432-manuel-a81kzq` ≠ `…-1432-manuel-p0d7m4` |
| **Reprise** de la veille de 08:00 (retry, second envoi, rapport) | **Toujours** `veille-20261009-0800-prog` |
| **Reprise** d'une exécution manuelle | **Toujours** le même identifiant, par exemple `…-1432-manuel-a81kzq` |

**Fenêtre de validité** (révision 1.3) : l'« instant désigné » est la date et l'heure du
`run_id`, interprétées en heure de Paris.

| Situation | Règle | Sinon |
|---|---|---|
| **Nouvelle exécution** (`run_id` encore inconnu) | Instant désigné entre **maintenant − 6 h** et **maintenant + 15 min** | `run_id_out_of_window` |
| **Reprise** (`run_id` déjà enregistré pour ce compte) | Instant désigné **au plus 24 h** dans le passé (et pas plus de 15 min dans le futur) | `run_id_out_of_window` |
| **Heure inexistante** (passage à l'heure d'été, par exemple 02:30 le 29 mars 2026) | Refus : une telle heure ne peut pas être une heure réelle de démarrage ni un créneau valide | `invalid_run_id` |
| **Heure ambiguë** (passage à l'heure d'hiver, 02:00–02:59 le 25 octobre 2026) | Accepté si **l'une ou l'autre** des deux occurrences est dans la fenêtre | — |

Conséquences vérifiées par les tests de l'étape 2 :
- une tâche programmée **retardée** de quelques minutes, ou jusqu'à 6 h, est acceptée ;
- une **reprise** jusqu'à 24 h après l'instant désigné est acceptée (rejeu et suite de
  l'exécution), même si elle franchit minuit ;
- les créneaux 08:00 et 18:00 correspondent à 06:00 et 16:00 UTC en été, 07:00 et 17:00 UTC en
  hiver, y compris les jours de bascule ;
- le **jour du quota de 40** est la date `AAAAMMJJ` du `run_id` (heure de Paris), et non le jour
  du traitement : une reprise après minuit reste imputée au jour de l'exécution d'origine.

**Autres contrôles serveur** :
- format non conforme ou identifiant aléatoire (UUID) : **refusé** (`invalid_run_id`) ;
- `prog` dont l'heure n'est pas dans `schedule.times` : **accepté** avec l'avertissement
  `slot_not_in_schedule`, enregistré dans `watch_runs`. Une tâche ChatGPT restée à l'ancien
  horaire continue de fonctionner, et le décalage devient **visible** (§7 bis).

**Limites résiduelles, toutes sûres** :
- si ChatGPT **recalcule** par erreur un identifiant `manuel` en cours d'exécution, il obtient un
  nouveau suffixe : le niveau « offre » (§7.2) empêche tout doublon, et le plafond de 40 par
  jour reste respecté ;
- si un « Run now » utilise la forme `prog` du créneau, il est traité comme une **reprise** de
  l'exécution programmée : aucun doublon, plafond de 20 partagé.

### 7.2 Trois niveaux de clés

| Niveau | Clé unique (index Mongo) | Rôle |
|---|---|---|
| **Exécution** | `watch_runs(user_id, run_id)` | Compteurs de l'exécution : `created`, `duplicate`, `rejected`, `reserved` ; statut ; rapport |
| **Élément d'exécution** | `watch_run_items(user_id, run_id, item_key)`, avec `item_key = external_id` normalisé s'il est présent, sinon `url_normalized` | **Résultat rejouable** : une reprise renvoie le résultat déjà calculé (`created`, `duplicate` ou `rejected`, avec `opportunity_id` et raisons) sans retraiter |
| **Offre** | `opportunities(user_id, url_normalized)` et `(user_id, source, external_id)` (Lot 1) | Garantie ultime : jamais deux opportunités pour la même offre, quels que soient les `run_id` |

### 7.3 Traitement d'un élément : ordre exact et atomicité

Pour chaque offre reçue :

1. **Validation** du schéma et des règles métier (§5.2). En cas d'échec, l'élément est
   **enregistré** comme `rejected` dans `watch_run_items`, pour qu'une reprise donne le même
   résultat, et le traitement passe au suivant.
2. **Réservation de l'élément** :
   `watch_run_items.update_one({user_id, run_id, item_key}, {$setOnInsert: {state: "pending", claimed_at}}, upsert=True)`.
   - **Si l'élément existe déjà et est terminé** : on **renvoie le résultat enregistré**,
     marqué `replayed: true`.
   - **S'il est `pending`** depuis moins de 60 s (appel concurrent en cours) : attente courte
     (2 s au plus), puis résultat enregistré, ou `in_progress` (retryable).
   - **S'il est `pending`** depuis plus de 60 s (interruption, par exemple un timeout
     serverless) : **reprise atomique**, par une mise à jour conditionnée à l'ancien
     `claimed_at` (même mécanisme que la conversion du Lot 1).
3. **Doublon avant quota** : `find_existing_opportunity` (Lot 1). Si l'offre existe déjà, elle
   est enregistrée `duplicate`, **sans consommer de quota**.
4. **Réservation des quotas**, deux compteurs **atomiques conditionnels** :
   - **par exécution** : `watch_runs.update_one({user_id, run_id, reserved: {$lt: 20}}, {$inc: {reserved: 1}})` ;
   - **par jour** : `usage(user_id, day).creations < 40`, `$inc` conditionnel avec `upsert`
     (mécanisme du Lot 1, retry sans `upsert` sur clé dupliquée).

   Si le second échoue, on **libère** le premier. Si un plafond est atteint, l'élément est
   enregistré `rejected` (`run_limit_reached` / `daily_quota_reached`).
5. **Ingestion** : `opportunity_service.ingest_opportunity` (Lot 1, `upsert` avec
   `$setOnInsert`).
   - **Création** : quotas **conservés**.
   - **Doublon révélé** par une course concurrente : quotas **libérés**, élément `duplicate`.
   - **Exception** : quotas **libérés**, élément `error` (retryable), puis l'état `pending` est
     relâché.
6. **Finalisation** : l'élément passe à son résultat définitif et les compteurs de l'exécution
   sont mis à jour par `$inc`.

**Invariants garantis, même en concurrence** :
- au plus **une** opportunité par offre ;
- `created` ≤ 20 par `run_id` et ≤ 40 par jour (les compteurs **ne dépassent jamais**, grâce à
  des conditions dans les mises à jour atomiques) ;
- un doublon ou un rejet ne consomme **jamais** de quota ;
- une reprise renvoie **le même résultat** sans nouvelle écriture.

### 7.4 Scénarios de répétition

| Scénario | Résultat |
|---|---|
| Retry réseau du même appel (même `run_id`) | Chaque élément renvoie son résultat enregistré (`replayed: true`) ; 0 écriture ; 0 quota |
| Deux appels **simultanés** identiques | L'un traite, l'autre attend puis renvoie le résultat enregistré ; 1 création au plus par offre |
| Appel interrompu en cours (timeout) | Éléments terminés : rejoués. Éléments `pending` de plus de 60 s : repris. Quotas cohérents (libérés si rien n'est créé) |
| « Run now » (`manuel`) puis horaire (`prog`) : `run_id` **différents**, exécutions indépendantes | Niveau « offre » : les offres déjà créées → `duplicate` ; seules les nouvelles sont créées ; plafond de 20 par exécution et de 40 par jour |
| Reprise de la même exécution (même `run_id`) | Rejeu : 0 création supplémentaire |
| Offre déjà ignorée ou convertie | `duplicate` ; l'offre n'est **pas** réactivée (Lot 1) |
| `report_watch_run` envoyé plusieurs fois | Le dernier fait foi ; les compteurs **observés** restent ceux du serveur |

### 7.5 Tests requis (étape 2)

- Concurrence : N appels simultanés identiques, résultats identiques, 1 création par offre.
- Concurrence au plafond : 30 offres distinctes envoyées en parallèle sur un même `run_id`,
  exactement 20 créées.
- Reprise : interruption simulée après la réservation, reprise après 60 s, aucun doublon ni
  quota perdu.
- Rejeu : même `run_id` rejoué 3 fois, 0 écriture supplémentaire.
- `run_id` aléatoire ou hors de la fenêtre : refusé.
- `run_id` en heure de Paris : créneaux 08:00 et 18:00 en heure d'été et d'hiver (dates de
  bascule incluses), heure inexistante refusée, heure ambiguë acceptée, distinction `prog` /
  `manuel`, deux `manuel` dans la même minute distincts, tâche retardée, reprise jusqu'à 24 h,
  avertissement `slot_not_in_schedule`.

---

## 7 bis. Observabilité et alertes — nouveau en 1.1 (correction 3, D8 ajustée)

**Constat** : **sans service de surveillance autonome** (exclu par le CDC), JobTracker **ne
peut pas garantir** la détection d'une tâche ChatGPT qui ne s'est jamais exécutée. Il ne
« voit » que les appels qu'il reçoit. La spécification distingue donc trois niveaux, sans en
promettre davantage.

| Niveau | Ce que JobTracker affiche ou fait | Garantie |
|---|---|---|
| **1. Dernière exécution connue** | `last_run` : `run_id`, heure, statut déclaré (`report_watch_run`), compteurs **observés** (créées, doublons, rejets) ; état du grant OAuth (§3.7) | **Exact** : uniquement des faits reçus |
| **2. Absence présumée (calcul paresseux)** | **À l'ouverture** de l'interface, ou à l'appel de `get_watch_status`, comparaison des horaires déclarés dans les préférences (`schedule.times`) avec les exécutions reçues. Un créneau passé de plus de 30 min sans exécution affiche « **Aucune exécution reçue pour le créneau de 08:00** » | **Indicatif** : calculé seulement si quelqu'un consulte. **Aucune notification** si personne ne regarde |
| **3. Détection automatique d'absence** | **Non fournie** par JobTracker. Elle exigerait un processus planifié côté serveur, ce qui est hors CDC | **Aucune.** Option externe possible : **D8-bis** ci-dessous |

**Alertes par e-mail (D8 ajustée)** : envoyées **uniquement en réaction à un événement observé
par JobTracker**, au moment où il se produit pendant une requête, **jamais** par une boucle de
surveillance :

| Événement observé | Alerte |
|---|---|
| Grant → `reconnection_required` (refresh refusé) | E-mail « Reconnexion ChatGPT nécessaire » (une fois par grant) |
| Grant → `compromised` (réutilisation de refresh) | E-mail immédiat « Accès ChatGPT révoqué par sécurité » |
| `report_watch_run` avec `status=failed` | E-mail récapitulatif (au plus un par jour) |
| Pré-alerte d'expiration absolue (moins de 7 jours) | Bandeau dans l'interface ; e-mail au plus une fois, envoyé lors d'un appel MCP reçu dans cette fenêtre |

**Ce que ces alertes ne couvrent pas** : une tâche **jamais déclenchée** (tâche en pause,
supprimée, panne ChatGPT, compte déconnecté avant tout appel). Dans ce cas, JobTracker ne
reçoit rien et ne peut rien signaler activement. Seul le niveau 2 le montre, à la consultation
suivante.

**D8-bis (option, à décider)** : un « **dead man's switch** » externe, par exemple un service
de type *healthchecks* qui alerte s'il ne reçoit pas de signal à l'heure prévue. Il pourrait
être appelé par **ChatGPT lui-même**, à la fin de la tâche, ou par JobTracker à la réception de
`report_watch_run`. C'est un **service tiers**, pas un service JobTracker. Il demande une
décision explicite (données transmises : aucune donnée personnelle, seulement un « ping »).

## 8. Contraintes Vercel

| Contrainte | Conséquence |
|---|---|
| Fonctions serverless sans processus permanent | MCP **sans état** ; aucune session en mémoire ; **aucun service de veille autonome** (conforme au CDC) |
| Durée max 300 s (Hobby) | Un appel `create_opportunities` (20 éléments) prend quelques secondes : large marge. Aucun appel sortant lent (pas de recherche serveur) ; seul le mode CIMD ferait un appel sortant, mis en cache |
| Démarrages à froid (2 à 5 s) | Acceptables. Les index Mongo sont créés à la première utilisation (pattern du Lot 1) |
| `lifespan` non exécuté | Aucune initialisation critique dans le `lifespan` (pattern du Lot 1) |
| Ancien format `vercel.json` (`builds`) | Ajouter les règles `/.well-known/*` **avant** `/(.*)\.(.*)` (§2.2) ; valider sur un déploiement réel |
| Previews protégées par l'authentification Vercel | ChatGPT **ne peut pas** joindre une Preview → stratégie de recette (**D10**) |
| slowapi en mémoire | Limites de rafale par instance seulement ; les **quotas Mongo** sont la protection fiable |
| Taille de la fonction | Ajout du SDK `mcp` : à mesurer (**D13**, conditions ci-dessous) |
| Pas de cron | Absence présumée calculée **à la consultation** uniquement (§7 bis) ; aucune détection active |

### 8.1 Conditions de D13 (dépendance `mcp`) — **conditionnelle**

À prouver **au début de l'étape 3** (porte E0b), sur un **déploiement réel** (voir §8 bis pour
l'environnement) :

| Critère | Seuil d'acceptation |
|---|---|
| Compatibilité | `mcp` 2.x installé avec les dépendances actuelles (FastAPI, Pydantic v2, Starlette) **sans conflit** de versions ; la suite existante (260 tests) reste verte |
| Taille | Taille décompressée de la fonction **sous la limite Vercel**, avec au moins 20 % de marge (mesure avant et après) |
| Démarrage à froid | Augmentation **inférieure à 1,5 s** par rapport à la fonction actuelle (médiane de 5 démarrages à froid) |
| Fonctionnement | `initialize`, `tools/list`, `tools/call` en streamable HTTP sans état, servis par la fonction Vercel |

**Repli si D13 échoue** : implémenter un **sous-ensemble minimal du protocole MCP** (JSON-RPC
`initialize`, `tools/list`, `tools/call`, en réponses JSON sans état), directement dans
FastAPI, sans SDK, suivi d'une revue dédiée.

## 8 bis. Recette et activation en production — nouveau en 1.1 (correction 4, D10 conditionnelle)

### 8 bis.1 Prérequis avant **tout** test OAuth

1. **Correction des routes `/.well-known/`** dans `vercel.json`, **avant** la règle
   `/(.*)\.(.*)`. Vérification **sur le déploiement réel** :
   `GET /.well-known/oauth-protected-resource/api/mcp` doit renvoyer le JSON du backend, et non
   le HTML du frontend. C'est la **porte E0a**.
2. Vérification de l'émetteur et de la ressource canonique (`https://jobtracker.maadec.com`,
   `…/api/mcp`) dans les métadonnées servies.

### 8 bis.2 Défense en profondeur : `MCP_ENABLED` ne suffit pas

Chaque requête MCP et OAuth passe **tous** les contrôles suivants, **côté serveur** :

| Couche | Contrôle | Effet si refus |
|---|---|---|
| 1. Interrupteur global | `MCP_ENABLED=true` (variable d'environnement) **et** interrupteur d'urgence `platform_settings.mcp_kill_switch=false` (base, modifiable par l'admin **sans redéploiement**) | `/api/mcp` et `/api/oauth/*` → 503, les métadonnées → 404 |
| 2. Identité | Jeton valide (§3.4) ; grant `active` ; utilisateur actif ; **`watch_enabled=true`** (drapeau admin, D7) | 401 / 403 |
| 3. Permissions | Scope de l'outil (§3.5) ; arguments sans `user_id` | 403 `insufficient_scope` / `invalid_arguments` |
| 4. Quotas | Rafale (slowapi) ; plafonds par exécution et par jour (§7.3) | 429 ou `rejected` |
| 5. Validation | Schéma strict et règles métier, URL sûres (§5.7) | `rejected` |

### 8 bis.3 Plan d'activation et de retour arrière

| Étape | Action | Autorisation |
|---|---|---|
| A1 | Déployer le code **avec `MCP_ENABLED=false`** : aucune route MCP ni OAuth active | Commit, push, déploiement |
| A2 | Vérifier la non-régression (santé, routes du Lot 1, contrôles S3) | — |
| A3 | Activer `watch_enabled` **sur ton compte uniquement** | Toi (admin) |
| A4 | Passer `MCP_ENABLED=true`, redéployer, puis portes **E0a, E0b et E0** | Autorisation distincte |
| A5 | Recette E1 à E9 | Au fil des tests |

**Retour arrière, du plus rapide au plus complet** :
1. **Interrupteur d'urgence en base** (`mcp_kill_switch=true`) : effet **immédiat**, sans
   redéploiement. MCP et OAuth sont coupés, les données restent intactes.
2. **Révocation** de tous les grants (interface ou admin) : ChatGPT perd l'accès
   immédiatement.
3. `MCP_ENABLED=false` puis redéploiement.
4. **Instant Rollback** Vercel vers le déploiement précédent (les secrets S3 sont conservés).
5. Les **données créées** (opportunités `chatgpt_watch`) restent en base. Elles peuvent être
   ignorées depuis l'interface ; **aucune suppression automatique**.

---

## 9. Matrice des risques

Probabilité (P) et impact (I) : 1 = faible, 3 = élevé.

| # | Risque | P | I | Atténuation | Test |
|---|---|---|---|---|---|
| **R1** | Une exécution en absence prolongée (ChatGPT fermé des heures) ne s'exécute pas ou attend une confirmation | 2 | 3 | Observabilité « exécution manquante » ; alerte | **E4** |
| **R2** | La récurrence 2 fois par jour est peu fiable sur plusieurs jours | 2 | 2 | Retards tolérés (2 à 4 min mesurés) ; suivi des exécutions | **E4** (3 jours) |
| **R3** | **Expiration OAuth pendant une tâche** : ChatGPT ne rafraîchit pas en arrière-plan → échecs silencieux | **3** | **3** | Durées adaptées (D2) ; détection et alerte ; procédure de reconnexion | **E5** (TTL court en recette) |
| **R4** | L'envoi groupé de 20 offres est rejeté, tronqué ou trop lent | 2 | 2 | Outil groupé avec `run_id` ; repli possible en appels multiples | **E6** |
| **R5** | Le comportement « sans confirmation » change (bêta OpenAI) | 2 | 3 | Veille sur les notes de version ; détection d'exécution manquante ; contrôle canari | **E8** (suivi continu) |
| **R6** | Exécutions multiples d'une même tâche → doublons | 3 | 1 | Idempotence `run_id` et dédoublonnage du Lot 1 | **E7** |
| R7 | Injection via le contenu des offres (pages manipulées) → données trompeuses | 2 | 2 | Validation stricte, texte brut, aucun outil sensible, décision humaine finale (Lot 1) | Tests de sécurité étape 3 |
| R8 | Vol de jeton OAuth | 1 | 3 | Hachage, TTL court, rotation et détection de réutilisation, révocation immédiate, audience liée | Tests étape 3 |
| R9 | Erreur de configuration Vercel (`/.well-known` servi par le frontend) | 3 si oublié | 3 | Règle explicite et test sur un déploiement réel | **E1** |
| R10 | Qualité de la sélection ChatGPT (faux positifs, liens morts) | 2 | 2 | Seuil de 75, règles déterministes, `uncertain_fields`, décision humaine (ignorer/convertir) | Suivi qualitatif |
| R11 | Coût ou plafond de l'abonnement Plus (nombre de tâches, quotas) | 1 | 2 | 1 tâche à 2 horaires ; plafond Plus : 5 tâches actives (documenté) | — |

---

## 10. Plan de validation de bout en bout (étape 5 du CDC)

Prérequis : étapes 2 à 4 livrées et testées. Environnement de recette selon **D10**.

| Test | Objectif | Procédure résumée | Critère GO |
|---|---|---|---|
| **E0a** Routes `/.well-known` (porte) | R9 | Sur le déploiement réel : `GET` des deux métadonnées | JSON du backend (pas le HTML du frontend), émetteur et ressource exacts |
| **E0b** Dépendance `mcp` (porte, D13) | D13 | Mesures du §8.1 (compatibilité, taille, démarrage à froid, `tools/list`) | Tous les seuils du §8.1 respectés |
| **E0** Compatibilité OAuth (porte, D1) | D1, R3 | **Avant tout outil métier** : MCP minimal (un seul outil de lecture) protégé par OAuth ; connexion depuis ChatGPT avec un client **pré-enregistré** | ChatGPT réalise le flux complet : client statique, **PKCE S256**, `resource`, `iss`, consentement, échange du code, appel authentifié. Sinon, repli sur CIMD (D1) |
| **E1** Découverte et connexion OAuth | R9 | Ajouter le MCP réel dans ChatGPT (OAuth), consentir | Métadonnées servies par le backend, flux PKCE réussi, outils listés |
| **E2** Lecture et écriture manuelles | Contrat | En conversation : `get_watch_preferences`, puis `create_opportunities` avec 2 offres de test | 2 créations, puis 2 `duplicate` au second appel |
| **E3** Tâche programmée ponctuelle | Reprise de P2 sur le MCP réel | Une tâche avec la séquence complète | 1 exécution, offres créées, `report_watch_run` reçu |
| **E4** Absence prolongée et récurrence | **R1, R2** (ex-P3) | Tâche réelle à 2 horaires, **3 jours**, ChatGPT fermé, aucune intervention | 6 exécutions sur 6 observées, 0 doublon, 0 confirmation |
| **E5** Expiration accélérée | **R3** | Voir le §10.1 | Rafraîchissement automatique **observé en absence**, ou à défaut transition correcte vers `reconnection_required` et alerte reçue |
| **E6** Lot de 20 offres | **R4** | Exécution produisant 20 offres valides | 20 résultats par élément ; durée < 30 s |
| **E7** Répétitions | **R6** | « Run now » plus horaire ; retry manuel du même `run_id` | 0 doublon ; quotas cohérents |
| **E8** Canari continu | **R5** | Après la mise en service : alerte si une exécution attendue manque | Alerte reçue lors d'une panne simulée (pause de la tâche) |
| E10 Retour arrière | Correction 4 | Interrupteur d'urgence activé pendant qu'une tâche tourne ; puis révocation | 503 immédiat sans redéploiement ; ChatGPT n'accède plus ; aucune donnée perdue |
| E9 Sécurité | R7, R8 | Jeton d'un autre compte ou d'une autre audience, scope insuffisant, `user_id` injecté, URL non HTTPS, révocation | Tous refusés, révocation immédiate |

---

### 10.1 Détail de E5 : expiration accélérée (correction 1)

**But** : mesurer, **sans hypothèse**, le comportement de ChatGPT quand un jeton expire
pendant une tâche programmée en ton absence.

1. **Configuration de recette**, sur ton compte seulement : access token de **10 min** et
   refresh token de **2 h**, par variables d'environnement `OAUTH_ACCESS_TTL` et
   `OAUTH_REFRESH_TTL`. Elle est restaurée après le test.
2. Tâche de test programmée à **T+30 min** et **T+90 min**, avec la séquence MCP complète, sur
   un `run_id` de type `manuel` (créneaux hors `schedule.times`) et des offres fictives (`source_evidence` absent, `external_id` préfixé
   `test-e5-`).
3. **Absence stricte** : ChatGPT fermé, aucune interaction.
4. **Observations côté serveur**, fiables et sans dépendre de ChatGPT :
   - journal des refus 401 « expiré » sur `/api/mcp` ;
   - journal des appels à `/api/oauth/token` (`grant_type=refresh_token`) : présents ou
     absents, réussis ou non ;
   - transitions d'état du grant (§3.7) ;
   - exécutions reçues.
5. **Variante B** : laisser le refresh token expirer (plus de 2 h) avant l'exécution suivante,
   pour vérifier la transition vers `reconnection_required`, l'e-mail d'alerte et l'affichage.

| Observation | Conclusion |
|---|---|
| 401 « expiré », puis **refresh réussi**, puis appel MCP réussi, sans intervention | ChatGPT rafraîchit en tâche → D2 = 1 h / 30 jours |
| 401 « expiré », **sans aucun refresh** | ChatGPT ne rafraîchit pas en tâche → D2 alternatif (24 h) et nouvelle revue de sécurité |
| Variante B : `reconnection_required`, alerte reçue, interface correcte | Correction 1 validée |

Les offres de test sont ignorées puis laissées en base. Elles restent identifiables par leur
`run_id` et leur `external_id`.

## 11. Décisions — état après la revue 1.1

| # | Décision | Verdict de la revue | Contenu retenu dans la révision 1.1 | Reste à faire |
|---|---|---|---|---|
| **D1** | Client OAuth | **Conditionnel** | Client pré-enregistré pour le MVP ; **preuve E0** (client statique + PKCE S256 + `resource`) avant tout outil métier ; repli CIMD (§3.2) | Résultat E0 |
| **D2** | Durée des jetons | **Conditionnel** | Hypothèse 1 h / 30 jours / 90 jours ; règles de bascule selon E5 (§3.7) ; état « reconnexion nécessaire ». **1.2** : 24 h est une mesure **transitoire** (30 jours au plus), jamais définitive, suivie d'un arbitrage obligatoire | Résultat E5 |
| **D3** | Emplacement MCP | **Validé** | `/api/mcp` dans FastAPI | — |
| **D4** | Données de pertinence | **Validé** | Sous-document `watch` | — |
| **D5** | `run_id` | **Validé, précisé en 1.2 et 1.3** | `veille-AAAAMMJJ-HHMM-prog` ou `…-manuel-xxxxxx` en **heure de Paris** ; `prog` = créneau prévu (déterministe), `manuel` = minute réelle et suffixe aléatoire tiré une fois (pas de collision dans la même minute) ; **identifiant d'origine conservé pour les reprises** ; UUID refusé ; fenêtre de −6 h à +15 min pour une nouvelle exécution, 24 h pour une reprise ; changements d'heure traités (§7.1 à §7.3) | — |
| **D6** | `report_watch_run` | **Validé** | Statuts `completed`, `partial`, `failed` ; dernier rapport retenu ; compteurs observés séparés des déclarés (§5.5) | — |
| **D7** | Comptes autorisés | **Validé** | `watch_enabled=true` activé explicitement par l'admin, **ton compte uniquement** | — |
| **D8** | Alertes | **Ajusté, à revalider** | **Aucune surveillance autonome** ; trois niveaux (dernière exécution connue, absence présumée à la consultation, pas de détection automatique) ; e-mails **uniquement sur événement observé** (§7 bis) | Valider le §7 bis ; décider de **D8-bis** (*dead man's switch* externe : oui ou non) |
| **D9** | Quotas | **Ajusté, à revalider** | Compteurs atomiques conditionnels par exécution et par jour ; ordre de réservation et libération ; rejeu sans quota ; reprise après interruption (§7.3) | Valider le §7.3 |
| **D10** | Recette en production | **Conditionnel** | Défense en profondeur sur 5 couches, interrupteur d'urgence en base sans redéploiement, activation par étapes et retour arrière en 5 niveaux (§8 bis) | Autorisations à chaque étape d'activation |
| **D11** | HTTPS | **Validé et renforcé** | URL dangereuses refusées (identifiants, IP, localhost, ports, redirecteurs, raccourcisseurs) ; IDN signalé (§5.7) | — |
| **D12** | Préférences | **Validé (1.2)** | Champs et valeurs initiales du §5.1 ; **08:00 et 18:00, Europe/Paris** ; `schedule` est informatif et ne programme rien dans ChatGPT ; tâches ChatGPT existantes non modifiées | — |
| **D13** | Dépendance `mcp` | **Conditionnel** | Porte E0b : compatibilité, taille (marge ≥ 20 %), démarrage à froid (+1,5 s au plus), fonctionnement ; repli sur un sous-ensemble MCP sans SDK (§8.1) | Résultat E0b |

---

## 12. Plan de réalisation (étapes du CDC, STOP et validation après chacune)

| Étape | Contenu | Tests | Livrable |
|---|---|---|---|
| **2. Fondations backend** | Modèles et services `watch_preferences` et `watch_runs` ; règles de validation métier (§5.2) et URL sûres (§5.7) ; collections `watch_runs` et `watch_run_items`, réservation des éléments et double compteur atomique (§7.3), avec **tous les tests du §7.5** ; normalisation des contrats et des pays ; quota généralisé (créations par utilisateur, doublons gratuits) ; API utilisateur `/api/watch/preferences` (JWT) ; sous-document `watch` (D4) | Mongo Docker : validation, isolation, quotas, concurrence, non-régression du Lot 1 et de S3. **Plan détaillé** : [LOT2-V2-ETAPE-2-PLAN.md](./LOT2-V2-ETAPE-2-PLAN.md) | Rapport et tests ; aucun déploiement |
| **3. OAuth et serveur MCP** | **Portes, dans cet ordre, avec arrêt si l'une échoue** : (1) règles `vercel.json` `/.well-known` → **E0a** ; (2) dépendance `mcp` → **E0b** ; (3) serveur d'autorisation et MCP minimal avec un outil de lecture → **E0** depuis ChatGPT. **Ensuite seulement** : machine d'états du grant (§3.7), rotation, révocation, 5 outils, idempotence complète (§7), interrupteurs (§8 bis) | Tests négatifs : PKCE, `redirect_uri`, audience, scopes, réutilisation de refresh, révocation, `user_id` injecté, aucun secret dans les journaux ; tests de contrat des outils (client MCP réel en local) ; idempotence | Démonstration locale |
| **4. Interface** | Préférences de veille ; « Connexions ChatGPT » (révocation) ; historique des exécutions et alertes ; page de consentement OAuth ; affichage du score, des raisons et des champs incertains dans Opportunités | Jest, responsive réel desktop et mobile | Captures et tests |
| **5. Connexion ChatGPT et recette** | Déploiement derrière le drapeau (autorisation distincte) ; E1 à E9 | Matrice E1 à E9 | Résultats factuels |
| **6. Non-régression et mise en service** | Suites complètes ; documentation d'exploitation (reconnexion, révocation, incidents) ; tâche réelle « Veille CDI Data junior » mise à jour avec la séquence MCP | — | Autorisation distincte : commit, push, déploiement et activation |

**Hors périmètre, rappel** : recherche d'offres côté serveur, scraping, cron de collecte, LLM
backend, candidature automatique, multi-utilisateur.

## 13. Sources (consultées le 8 octobre 2026)

- [MCP Specification — Authorization (2026-07-28)](https://modelcontextprotocol.io/specification/latest/basic/authorization) : lu
- [OpenAI — Authentication (plugins MCP)](https://developers.openai.com/plugins/build/auth) : lu (découverte, redirections ChatGPT, CIMD, PKCE S256, `resource`, validation, 401)
- [OpenAI — Create custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server) : lu (identifiants statiques, OAuth ou aucune authentification, `readOnlyHint`)
- [OpenAI — Build an MCP server](https://developers.openai.com/plugins/build/mcp-server) : lu (streamable HTTP, annotations)
- Gate 0 : [LOT2-V2-ETAPE-0-PREUVES.md](./LOT2-V2-ETAPE-0-PREUVES.md)
