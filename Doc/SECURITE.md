# Sécurité

Voir aussi : [OAUTH.md](./OAUTH.md), [DETTE-SECURITE.md](./DETTE-SECURITE.md),
[DEPLOIEMENT-ET-EXPLOITATION.md](./DEPLOIEMENT-ET-EXPLOITATION.md).

## Frontières de confiance

| Acteur | Authentification | Peut | Ne peut pas |
|---|---|---|---|
| Utilisateur (webapp) | JWT de session (e-mail/mot de passe ou Google) | Ses propres données | Données d'un autre compte |
| Administrateur | JWT de session, rôle `admin`, **webapp uniquement** | Administration, clients OAuth, interrupteur, politique CIMD | Utiliser le JWT de l'extension pour administrer |
| Extension Chrome | JWT « extension » (claim `source`) | Ajouter des offres, consulter | Gérer jetons d'API, consentements OAuth, administration |
| Agent par jeton d'API (Lot 1) | `Bearer jt_agent_…` (haché en base) | Créer des opportunités dans le compte du propriétaire | Lire des données, utiliser une source réservée (`chatgpt_watch`) |
| Client OAuth / agent MCP | Jeton `jt_oat_…` lié à la ressource `/api/mcp` | Les six outils, dans la limite de ses scopes effectifs | Agir pour un autre compte, toucher aux candidatures, documents, administration |

L'identité (`user_id`, `client_id`) est **toujours** dérivée du jeton vérifié, jamais d'un argument.

## Moindre privilège et séparation lecture/écriture

- Deux scopes : `watch:read` (lecture) et `opportunities:write` (ajout d'offres et de rapports).
  Aucun outil ne supprime, modifie une offre existante, ni n'accède aux candidatures.
- Scopes par client ; clients CIMD en lecture seule par défaut ; scopes effectifs recalculés à
  chaque appel ; un élargissement n'étend jamais une autorisation existante.
- Veille réservée au propriétaire : compte actif **et** `watch_enabled`, vérifié à chaque appel.

## Consentement

Page JobTracker anti-clickjacking, ticket de continuation à usage unique (le code ne passe jamais
par le JavaScript), affichage du nom du client, du domaine de retour, de l'éditeur pour un client
CIMD, avertissement pour un retour local. Un refus ne crée rien.

## Révocation et désactivation

| Action | Effet |
|---|---|
| Révoquer une autorisation (utilisateur ou admin) | Jetons de cette autorisation refusés immédiatement |
| Désactiver un client | Toutes ses autorisations et jetons révoqués ; nouvelles autorisations refusées |
| Régénérer un secret (confidentiel) | Ancien secret refusé immédiatement |
| Retirer une adresse de retour | Plus utilisable ; les connexions établies ne sont pas révoquées |
| Désactiver la veille d'un compte | Tous ses jetons refusés à l'appel suivant |
| Désactiver la politique CIMD / retirer un domaine | Nouvelles autorisations refusées ; jetons existants conservés (désactiver le client pour les couper) |

## Interrupteur d'urgence

`platform_settings.mcp_kill_switch`, **fermé par défaut** (base illisible = fermé). Fermé : MCP
et OAuth répondent 503 pour tous, sans redéploiement ; l'administration reste accessible.
Commande : Paramètres → API / Agents → Connexions OAuth / MCP → « Couper le service » (ou
`PUT /api/admin/settings/mcp-kill-switch` avec `{"active": true}`).

En production, le MCP exige en plus **deux** variables (`MCP_ENABLED` et `MCP_PRODUCTION_ALLOWED`) ;
sinon tout répond 404, comme une route absente.

## Quotas et protections contre les abus

| Protection | Valeur |
|---|---|
| Créations de la veille | 20 par exécution, 40 par jour et par compte (réservations atomiques) |
| Requêtes MCP | 30 par minute et par autorisation (par instance) |
| `/oauth/authorize`, `/oauth/token` | 10 par minute et par IP |
| Jetons d'API (Lot 1) | 30 requêtes par minute et par jeton, 500 créations par jour et par jeton, 10 jetons actifs |
| Corps MCP | 4 Mo |
| URL des offres | HTTPS directe, domaine public, sans raccourcisseur ; jamais visitée par le serveur |
| Documents CIMD | Domaines approuvés, anti-SSRF, anti DNS-rebinding, 5 s, 5 Ko |

## Secrets et journaux

- Secrets OAuth, jetons et jetons d'API **hachés** (SHA-256) en base ; secrets affichés une seule
  fois, jamais mis en cache côté navigateur, jamais réaffichés.
- `JWT_SECRET` et `SECRET_KEY` : distincts, aléatoires, longs ; la garde « S3 » refuse au démarrage
  en production une valeur absente, faible ou d'exemple. Contrôle préalable :
  `backend/scripts/check_signing_secrets.py`.
- Clés IA des utilisateurs chiffrées (`ENCRYPTION_KEY`).
- Journaux : jamais d'en-tête `Authorization`, de jeton, de code, de secret ni de contenu d'offre ;
  préfixes d'identifiants et compteurs seulement.
- Ne jamais coller dans un ticket ou une conversation une URL de retour OAuth contenant `code=`.
- Variables de production uniquement dans Vercel ; les fichiers `.env*` ne sont pas versionnés.

## Dette connue

Voir [DETTE-SECURITE.md](./DETTE-SECURITE.md) : S1 (contournement du quota IA par l'en-tête
`Origin`) et S2 (`is_admin` toujours faux dans les routes IA) restent ouverts ; S3 est corrigé
dans le code.
