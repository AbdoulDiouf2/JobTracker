# OAuth 2.1 du connecteur MCP (P1, P2, P3)

JobTracker est son propre **serveur d'autorisation** et la **ressource protégée** MCP.
Code : `backend/services/oauth_service.py`, `backend/services/cimd_service.py`,
`backend/routes/oauth.py`, `backend/routes/admin.py`, page `frontend/src/pages/OAuthConsentPage.jsx`.

> Ne pas confondre avec la connexion des **utilisateurs** à JobTracker (e-mail/mot de passe ou
> Google), qui produit un JWT de session et n'a rien à voir avec ce serveur OAuth.

## Points d'entrée

| Méthode | Chemin | Usage |
|---|---|---|
| GET | `/.well-known/oauth-protected-resource[/api/mcp]` | Métadonnées de la ressource (RFC 9728) |
| GET | `/.well-known/oauth-authorization-server` | Métadonnées du serveur (RFC 8414) |
| GET | `/api/oauth/authorize` | Demande d'autorisation → page `/oauth/consent` |
| GET | `/api/oauth/requests/{id}` | Détail pour la page de consentement (session web) |
| POST | `/api/oauth/consent` | Décision → URL de continuation (jamais le code) |
| GET | `/api/oauth/continue` | Émission du code et redirection vers le client |
| POST | `/api/oauth/token` | Échange du code, renouvellement |
| POST | `/api/oauth/revoke` | Révocation (RFC 7009) |
| GET / DELETE | `/api/oauth/grants[/{id}]` | Connexions de l'utilisateur |

Tous ces points répondent **404** si le MCP est inactif et **503** si l'interrupteur d'urgence
est fermé. Les routes d'administration (`/api/admin/oauth/*`) restent accessibles dans les deux cas.

## Socle commun

- **Code d'autorisation + PKCE S256 obligatoire** pour tous les clients (`plain` refusé).
- **`resource`** (RFC 8707) : la ressource est `https://jobtracker.maadec.com/api/mcp` ; le jeton y
  est lié et vérifié à chaque appel.
- **`iss`** dans la redirection (RFC 9207) ; `state` renvoyé tel quel.
- **Jetons opaques** `jt_oat_` (accès, 1 h) et `jt_ort_` (renouvellement, 30 j glissants, 90 j au
  plus) ; seuls leurs hachés SHA-256 sont stockés.
- **Rotation** du jeton de renouvellement à chaque usage ; réutilisation hors délai de grâce (30 s)
  → l'autorisation est révoquée (`compromised`).
- **Code** : usage unique, 60 s, lié au client, à l'adresse de retour et au défi PKCE ;
  réutilisation → révocation des jetons émis.
- **Consentement** : page JobTracker (anti-clickjacking : `X-Frame-Options: DENY`,
  `frame-ancestors 'none'`), décision par **ticket de continuation** à usage unique, de sorte que
  le code ne transite jamais par le JavaScript du frontend. La page affiche le nom du client, le
  **domaine de retour** et les permissions.
- **Propriétaire uniquement** : seul un compte actif avec `watch_enabled` (activé par un admin)
  peut consentir et utiliser les jetons ; vérifié au consentement, à l'émission et à chaque appel.
- **Limites** : `/authorize` et `/token` limités à 10 requêtes par minute et par IP.

## Scopes

| Scope | Outils |
|---|---|
| `watch:read` | `jobtracker_ping`, `get_watch_preferences`, `list_recent_opportunities`, `get_watch_status` |
| `opportunities:write` | `create_opportunities`, `report_watch_run` |

**Scopes effectifs** à chaque appel = scopes de l'autorisation **∩** scopes actuellement permis au
client. Une réduction par l'admin s'applique immédiatement ; au renouvellement, l'autorisation est
réduite d'autant (révoquée si plus rien ne reste). Un élargissement **n'étend jamais** une
autorisation existante : il faut un nouveau consentement.

## P1 — Multi-client (clients confidentiels)

- Plusieurs clients enregistrés, chacun avec `client_id` (`jt_oc_…`), secret (`jt_ocs_…`,
  **haché**, affiché une seule fois à la création ou à la rotation), nom, adresses de retour,
  statut.
- Authentification au point `/token` : `client_secret_basic` ou `client_secret_post`.
- Adresses de retour : HTTPS exactes (domaine en minuscules, sans port, requête, fragment ni
  identifiants), 10 au plus. Une adresse partagée avec un autre client est acceptée et signalée.
- Noms uniques (insensibles à la casse) parmi les clients créés à la main.
- Le consentement d'un compte pour un client **remplace** sa précédente autorisation pour ce même
  client (`superseded`) ; les clients sont indépendants entre eux.
- Désactiver un client révoque toutes ses autorisations et ses jetons ; un jeton d'un client
  inactif est refusé, même si une autorisation avait échappé à la révocation.
- Traçabilité : chaque opportunité créée par MCP porte `watch.client_id` (client vérifié) et une
  copie du nom du client ; chaque exécution porte `client_ids` et `report_client_id`.

## P2 — Clients publics et isolation

- `client_type` : `confidential` (défaut, et valeur implicite des clients antérieurs) ou `public`.
- **Client public** : `token_endpoint_auth_method=none`, identifiant seul, **tout secret refusé** ;
  la sécurité repose sur PKCE S256, l'adresse de retour exacte, la rotation des jetons de
  renouvellement et le consentement. Pas de rotation de secret.
- **Adresses de retour locales** (RFC 8252 §7.3), réservées aux clients publics : enregistrées
  `http://127.0.0.1/<chemin>` ou `http://[::1]/<chemin>` **sans port** ; à l'usage, tout port
  1-65535 est accepté pour ces deux hôtes, chemin comparé à l'identique. Refus de `localhost`
  (sauf CIMD, voir P3), autres IP, encodages, requête, fragment, identifiants, segments `..`.
  Le consentement affiche alors un avertissement « application installée sur cet appareil ».
- **Scopes par client** (`allowed_scopes`, défaut : les deux).
- **Isolation des exécutions par client** : voir [MCP-REFERENCE.md](./MCP-REFERENCE.md#run_id-idempotence-et-quotas).
- La découverte annonce `none` parmi les méthodes d'authentification.

## P3 — Client ID Metadata Documents (CIMD)

Un client inconnu s'identifie par l'**URL HTTPS de son document de métadonnées**
(draft-ietf-oauth-client-id-metadata-document, spécification MCP 2025-11-25). Il est traité comme
un client **public**.

### Politique de confiance

Réglée par l'admin (`platform_settings.oauth_cimd_policy`, Paramètres → API / Agents) :
**désactivée par défaut** ; liste **exacte** des domaines approuvés (un sous-domaine n'est pas
couvert) ; scopes accordés par défaut aux nouveaux clients CIMD (**lecture seule** recommandée).
La découverte annonce `client_id_metadata_document_supported: true` **seulement** si la politique
est activée et compte au moins un domaine.

### Récupération sécurisée du document

- URL du client : https, nom de domaine (pas d'IP), port par défaut, chemin sans `.`/`..`/`//`,
  sans identifiants, requête, fragment ni encodage `%`, 512 caractères au plus.
- Domaine vérifié contre la politique **avant** tout accès réseau.
- **Anti-SSRF** : résolution DNS préalable ; refus si **une seule** adresse n'est pas publique
  (privée, loopback, lien local, CGNAT, multicast, réservée, IPv4 encapsulée dans IPv6, et
  **formes IPv6 de transition portant une IPv4** : NAT64 `64:ff9b::/96` et `64:ff9b:1::/48`,
  6to4 `2002::/16`, IPv4-compatible `::/96` — c'est l'IPv4 transportée qui doit être publique).
- **Anti DNS-rebinding** : connexion à l'**adresse vérifiée**, certificat TLS vérifié pour le
  nom (SNI) ; pas de seconde résolution.
- Aucune redirection suivie, aucun proxy, délai 5 s, taille ≤ 5 Ko, type `application/json`.
- Champs `logo_uri`, `client_uri`, `jwks_uri` jamais récupérés.

### Validation du document

`client_id` **identique** à l'URL ; aucun `client_secret` ; `token_endpoint_auth_method` absent ou
`none` ; `client_name` valide ; 1 à 10 `redirect_uris`, HTTPS exactes ou locales.
`localhost` est accepté **uniquement** pour un client CIMD dont le document le déclare (Claude
Code, Codex) ; un port déclaré (VS Code : `:33418`) n'empêche pas un autre port.

### Cache

`Cache-Control` respecté dans [5 min, 24 h] (1 h par défaut ; `no-store` → 5 min). Erreurs et
documents invalides **jamais** mis en cache. À expiration, un document modifié est pris en
compte ; un document indisponible ou invalide **bloque les nouvelles autorisations** sans
couper les connexions existantes.

### Cycle de vie

1. `/authorize` : document récupéré et validé, **conservé dans la demande** ; aucun client créé.
2. Consentement **refusé** ou compte non éligible : **rien n'est créé**.
3. Consentement **approuvé** : politique revérifiée, puis client enregistré (`registration:
   "cimd"`, public, scopes par défaut de la politique, aucun privilège automatique).
4. Échange du code : politique revérifiée (domaine retiré entre-temps → `invalid_grant`).
5. Relectures ultérieures du document : nom et adresses mis à jour, **scopes jamais modifiés**.

### Désactivation et changement de politique

| Action | Jetons existants | Nouvelles autorisations |
|---|---|---|
| Désactiver le client CIMD | **Révoqués** immédiatement ; renouvellement refusé | Refusées, sans accès réseau |
| Désactiver la politique ou retirer le domaine | **Restent valides** (choix documenté) | Refusées, même avec un document en cache ; une demande ou un code en cours échoue |

Pour couper les accès existants après un changement de politique : désactiver le client concerné.

### Risques résiduels

- **Usurpation via `localhost`** (signalée par la spécification MCP) : un programme local peut
  présenter l'URL d'un client légitime. Protections : consentement explicite, affichage
  « Identité publiée par {domaine} », avertissement local, lecture seule par défaut.
- Avant le premier consentement approuvé, chaque `/authorize` relit le document (limite 10/min/IP).
- Codex peut publier un document par `callback_id` : un client par document.

## Pourquoi pas de DCR

L'enregistrement dynamique (RFC 7591) n'est **pas implémenté** et `registration_endpoint` est
absent :

- aucun client ciblé n'en a besoin : Claude Code, Codex et VS Code utilisent CIMD lorsqu'il est
  annoncé ; ChatGPT et Claude web utilisent des clients pré-enregistrés ;
- la spécification MCP le rend facultatif (« MAY », conservé pour compatibilité) et privilégie CIMD ;
- un point d'inscription ouvert multiplierait les clients et la surface d'attaque.

Conséquence : un client qui ne connaît **que** DCR ne peut pas se connecter.

## Administration

Paramètres → API / Agents → **Connexions OAuth / MCP** (admin) : état du service et interrupteur,
politique CIMD, cartes repliables par client (type, statut, permissions, adresses de retour,
régénération du secret pour les confidentiels, désactivation), liste et révocation des
autorisations. Routes : `/api/admin/oauth/{status,clients,grants,cimd-policy}`,
`/api/admin/settings/mcp-kill-switch`. Script de secours : `backend/scripts/manage_oauth_client.py`.

## Tests

`test_oauth.py`, `test_admin_oauth.py`, `test_p1_multiclient.py`, `test_p2_public_clients.py`,
`test_p3_cimd.py`, `test_a0_activation.py`.
