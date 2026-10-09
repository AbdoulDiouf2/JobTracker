# JobTracker — Lot 2 V2 · Plan d'activation OAuth et veille (A1 à A4)

> **Date** : 9 octobre 2026 · **Statut** : **plan à valider, rien n'est activé**.
> État de départ : D1 déployé (`e9989a3`), tout fermé. Aucun client OAuth, veille désactivée.
> Légende : 🤖 réalisable par l'agent (sur autorisation) · 👤 nécessite ton accès
> (Vercel, ChatGPT, compte admin JobTracker, base réelle).

## 1. Conditions nécessaires

| # | Condition | État actuel | Qui |
|---|---|---|---|
| C1 | **Lever le blocage de production dans le code.** `mcp_enabled()` renvoie toujours `False` quand `VERCEL_ENV=production`. **Sans ce changement, aucune variable n'ouvre OAuth en production** | Bloqué | 🤖 code et tests, puis 👤 autorisation de commit, push et déploiement |
| C2 | `MCP_ENABLED=true` en portée **Production**, puis **redéploiement** (Vercel n'applique une variable qu'aux nouveaux déploiements) | Absente | 👤 Vercel |
| C3 | Interrupteur d'urgence **actif** avant l'ouverture (activation en sécurité), puis désactivé au moment voulu | Absent | 👤 admin JobTracker |
| C4 | `watch_enabled=true` sur **ton** compte uniquement (D7) | Absent | 👤 admin JobTracker |
| C5 | Client OAuth ChatGPT créé (secret affiché une seule fois) | Aucun | 👤 (base réelle), ou 🤖 sur autorisation explicite d'accès à la base |
| C6 | Aucune autre variable : `OAUTH_ISSUER` (`https://jobtracker.maadec.com`), `MCP_ALLOWED_HOSTS` et les durées de jetons gardent leurs valeurs par défaut | OK | — |

### C1 : changement de code proposé (non fait)

Remplacer le blocage absolu par **deux clés indépendantes** en production :

```python
def mcp_enabled() -> bool:
    if not settings.MCP_ENABLED:
        return False
    if (os.environ.get("VERCEL_ENV") or "").strip().lower() == "production":
        # Production : il faut EN PLUS l'autorisation explicite MCP_PRODUCTION_ALLOWED=true
        return os.environ.get("MCP_PRODUCTION_ALLOWED", "").strip().lower() == "true"
    return True
```

- Une variable posée seule par erreur ne suffit plus à ouvrir le service.
- Dans le même commit : correction de l'écart `{"detail": "Not Found"}` (forme compacte) et
  tests associés (production sans la seconde clé → 404 ; avec les deux → actif ; interrupteur
  d'urgence prioritaire).
- C2 devient donc : `MCP_ENABLED=true` **et** `MCP_PRODUCTION_ALLOWED=true`.

## 2. Client OAuth ChatGPT (C5)

| Élément | Valeur |
|---|---|
| Type | Client **confidentiel** pré-enregistré (D1, option A) |
| Méthodes d'authentification acceptées au point `token` | `client_secret_basic` **et** `client_secret_post` (pas `none`) |
| Adresses de retour (liste blanche **exacte**) | `https://chatgpt.com/connector_platform_oauth_redirect`, plus l'URI **exacte** `https://chatgpt.com/connector/oauth/{callback_id}` si ChatGPT l'affiche dans la configuration du connecteur |
| Scopes | `watch:read` et `opportunities:write` |
| Ressource (`resource`) | `https://jobtracker.maadec.com/api/mcp` |

**Commande** (👤 depuis `backend`, avec le venv ; `backend/.env` pointe sur la base réelle) :
```powershell
.\venv\Scripts\python scripts\manage_oauth_client.py create --name ChatGPT `
  --redirect-uri https://chatgpt.com/connector_platform_oauth_redirect `
  --redirect-uri https://chatgpt.com/connector/oauth/<callback_id>   # si connu
```
Le secret s'affiche **une seule fois** : le coller directement dans ChatGPT, jamais ailleurs.

**Limite** : le script ne sait pas ajouter une URI à un client existant. Si ChatGPT révèle son
`callback_id` après la création, il faut désactiver le client (`deactivate`) puis le recréer
avec les deux URI. L'option inverse : un petit ajout `add-redirect-uri` au script, à placer
dans le commit C1 (🤖, recommandé).

## 3. Séquence d'activation

| Palier | Action | Qui | Contrôle de sortie |
|---|---|---|---|
| **A0** | Commit C1 (deux clés et format 404), tests, push, déploiement | 🤖 puis 👤 GO | Contrôles D1 identiques : tout reste en 404 |
| **A1** | **Interrupteur d'urgence ON** : `PUT /api/admin/settings/mcp-kill-switch {"active": true}` | 👤 admin | `GET` → `{"active": true}` |
| **A2** | `watch_enabled=true` sur ton compte : `PUT /api/admin/users/{ton_id}/watch {"enabled": true}` | 👤 admin | `/api/watch/preferences` → 08:00 / 18:00 Europe/Paris |
| **A3** | Vercel : `MCP_ENABLED=true` et `MCP_PRODUCTION_ALLOWED=true` (Production), puis **Redeploy** | 👤 Vercel | MCP et OAuth → **503** (interrupteur actif), découverte → 404 |
| **A4** | Créer le client (§2) | 👤 | `list` affiche le client actif |
| **A5** | **Interrupteur d'urgence OFF** | 👤 admin | V1 et V2 ci-dessous |
| **A6** | Essai manuel sans ChatGPT (V3 à V6) | 👤, guidé par 🤖 | Jetons émis, appel MCP réussi, puis révocation |
| **A7** | Connexion depuis ChatGPT : [protocole E0](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md) | 👤 ChatGPT | E0 PASS |

Les appels admin de A1, A2 et A5 se font connecté à JobTracker (console du navigateur ou
outil HTTP), avec ta session admin. 🤖 peut fournir les commandes prêtes à coller.

## 4. Vérifications minimales (avant ChatGPT)

| # | Vérification | Attendu |
|---|---|---|
| V1 | `GET /.well-known/oauth-protected-resource/api/mcp` et `/.well-known/oauth-authorization-server` | 200 JSON : `resource` = `https://jobtracker.maadec.com/api/mcp`, `issuer` = `https://jobtracker.maadec.com`, `S256` seul |
| V2 | `POST /api/mcp` sans jeton | **401** + `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp"` |
| V3 | `GET /api/oauth/authorize` avec un `client_id` inconnu | 400, **sans redirection** |
| V4 | `/authorize` avec le vrai client et un challenge PKCE S256 (généré localement), dans le navigateur connecté | Page de consentement : « ChatGPT demande l'autorisation… », ton compte, 2 permissions |
| V5 | **Autoriser** | Redirection vers `chatgpt.com/…?code=…&state=…&iss=…` (ChatGPT affichera une erreur : normal, aucun connecteur en attente). Le `code` est lisible dans la barre d'adresse (60 s) |
| V6 | Échange du code (`POST /api/oauth/token` avec `code_verifier` et le secret), puis `tools/list` et `jobtracker_ping` avec le jeton ; enfin `DELETE /api/oauth/grants/{id}` | Jetons `jt_oat_` / `jt_ort_` ; ping `authenticated: true` ; après révocation → 401 |

🤖 peut préparer un script local qui génère le couple PKCE, construit l'URL `/authorize` et
réalise l'échange en V6. Le secret y serait saisi de façon masquée, sans jamais être stocké.

## 5. Désactivation

| Niveau | Action | Effet | Redéploiement |
|---|---|---|---|
| **1** | **Interrupteur d'urgence ON** (route admin) | MCP et OAuth → 503, découverte → 404 | **Non, immédiat** |
| **2** | Révoquer la connexion (`DELETE /api/oauth/grants/{id}`) | Jetons ChatGPT invalides | Non, immédiat |
| **3** | `watch_enabled=false` sur ton compte | Tout jeton refusé (éligibilité revérifiée à chaque appel) | Non, immédiat |
| **4** | Désactiver le client (`manage_oauth_client.py deactivate`) | Client inutilisable, connexions révoquées | Non, immédiat |
| **5** | Vercel : retirer `MCP_PRODUCTION_ALLOWED` ou `MCP_ENABLED`, puis Redeploy | Tout revient en 404 | Oui |
| **6** | Instant Rollback vers `e9989a3` ou `ef07ab6` | Code précédent | Non (bascule de déploiement) |

Les niveaux 1 à 4 ne nécessitent **aucun redéploiement**.

## 6. Répartition des rôles

| Opération | 🤖 Agent | 👤 Toi |
|---|---|---|
| Changement de code C1, tests, commit | ✔ (sur GO) | GO |
| Push et déploiement | ✔ (sur GO explicite) | GO |
| Variables Vercel, Redeploy | — | ✔ |
| Appels admin (interrupteur, `watch_enabled`) | Commandes prêtes | ✔ (ta session) |
| Création du client OAuth (base réelle) | Seulement sur autorisation explicite d'accès à la base | ✔ (recommandé) |
| Essai manuel V3 à V6 | Script et guidage | ✔ (navigateur connecté, secret) |
| Connexion ChatGPT (E0) | Observation des journaux si fournis | ✔ |
| Contrôles anonymes (V1, V2, V3) | ✔ | — |

## 7. Décisions demandées

1. **GO pour C1** : deux clés en production, format 404 compact, ajout `add-redirect-uri` au
   script, avec tests, sans activation.
2. Création du client : **par toi** (recommandé) ou par l'agent avec un accès explicite à la
   base.
3. Faut-il préparer le script de l'essai manuel (V4 à V6) ?
