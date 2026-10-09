# JobTracker — Lot 2 V2 · A1 : parcours opérationnel d'activation

> **Date** : 9 octobre 2026 · Production : `7f2934a` (A0), tout fermé.
> Décision : interrupteur d'urgence **fermé par défaut**, ouvert explicitement à l'étape 5,
> laissé ouvert ensuite jusqu'à une éventuelle coupure.
> 👤 = toi · 🤖 = l'agent (contrôles anonymes, sur ta demande). Chaque étape s'arrête sur son
> contrôle ; en cas d'écart → coupure (§7).

## Étape 1 — Veille sur ton compte uniquement 👤 (écriture en base via l'API admin)

Connecté à `https://jobtracker.maadec.com` avec **ton compte admin**, console du navigateur
(F12) :

```js
const api = (m, p, b) => fetch(p, { method: m, headers: { 'Content-Type': 'application/json',
  Authorization: 'Bearer ' + localStorage.getItem('token') }, body: b && JSON.stringify(b) })
  .then(async r => ({ status: r.status, body: await r.json() }));
const me = (await api('GET', '/api/auth/me')).body;
console.log(me.email, me.role);                                    // doit être ton compte, role "admin"
await api('PUT', `/api/admin/users/${me.id}/watch`, { enabled: true }); // → {watch_enabled: true}
await api('GET', '/api/watch/preferences');                         // → 200, 08:00 / 18:00 Europe/Paris
```

**Contrôle** : `preferences` répond 200 avec les valeurs D12. Aucun autre compte n'est modifié
(l'appel cible ton seul `id`).

## Étape 2 — Variables Vercel 👤

Vercel → projet JobTracker → **Settings → Environment Variables** → portée **Production
uniquement** :

| Nom | Valeur |
|---|---|
| `MCP_ENABLED` | `true` |
| `MCP_PRODUCTION_ALLOWED` | `true` |

Aucune autre variable.

## Étape 3 — Redéploiement 👤

Vercel → **Deployments** → déploiement de production `7f2934a` → **⋯ → Redeploy**
(Production). Une variable ne s'applique qu'à un nouveau déploiement.

**Contrôle** 🤖 (interrupteur encore fermé) : `/api/mcp` et `/api/oauth/*` → **503** ;
`/.well-known/*` → **404**.

## Étape 4 — Client OAuth ChatGPT 👤 (écriture en base)

PowerShell, depuis `backend` :

```powershell
$env:APP_ENV = "development"   # requis : JWT_SECRET local = valeur d'exemple (poste local uniquement)
.\.venv\Scripts\python scripts\manage_oauth_client.py create --name ChatGPT `
  --redirect-uri https://chatgpt.com/connector_platform_oauth_redirect
```

- Noter le `client_id`. Le `client_secret` s'affiche **une seule fois** : le placer directement
  dans ton gestionnaire de mots de passe, puis `Clear-Host`. Ne jamais le copier ailleurs.
- **Méthodes d'authentification acceptées** : `client_secret_basic` et `client_secret_post`.
- Adresse de retour propre au connecteur (si ChatGPT en affiche une à l'étape 7) :

```powershell
.\.venv\Scripts\python scripts\manage_oauth_client.py add-redirect-uri --client-id <client_id> `
  --redirect-uri https://chatgpt.com/connector/oauth/<callback_id>
.\.venv\Scripts\python scripts\manage_oauth_client.py list      # contrôle, sans secret
```

## Étape 5 — Ouverture de l'interrupteur 👤

Console du navigateur (même session admin) :

```js
await api('PUT', '/api/admin/settings/mcp-kill-switch', { active: false });
await api('GET', '/api/admin/settings/mcp-kill-switch');   // → {active: false}
```

**Contrôle** 🤖 : découverte → **200 JSON** (`resource` = `https://jobtracker.maadec.com/api/mcp`) ;
`POST /api/mcp` sans jeton → **401** avec `WWW-Authenticate … resource_metadata=…`.

## Étape 6 — Tests OAuth et MCP ping, sans ChatGPT 👤

```powershell
.\.venv\Scripts\python scripts\oauth_manual_check.py --checks-only
.\.venv\Scripts\python scripts\oauth_manual_check.py --client-id <client_id>
```

1. Ouvrir l'URL affichée dans le navigateur **connecté** → page de consentement → **Autoriser**.
2. Le navigateur arrive sur `chatgpt.com` (erreur normale) : copier l'URL complète et la coller
   dans le script **dans les 60 s**.
3. Saisir le secret (masqué).

**Attendu** : 8 lignes `[OK]`. V1 à V3 (découverte, 401, client inconnu) ; V5 (code, `state`,
`iss`) ; V6 (jetons émis, `tools/list` = `jobtracker_ping` seul, ping `authenticated: true`,
révocation puis 401). Le script révoque lui-même l'autorisation de test.

## Étape 7 — Connexion depuis ChatGPT 👤

[Protocole E0](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md) : connecteur MCP
`https://jobtracker.maadec.com/api/mcp`, OAuth avec identifiants statiques (`client_id` et
secret de l'étape 4). Aucune tâche ChatGPT n'est créée ni modifiée.

## 7 bis. Coupure, du plus immédiat au plus complet

| Action | Commande | Redéploiement |
|---|---|---|
| Interrupteur | `await api('PUT', '/api/admin/settings/mcp-kill-switch', { active: true })` | Non |
| Révoquer la connexion | `await api('DELETE', '/api/oauth/grants/<id>')` (liste : `GET /api/oauth/grants`) | Non |
| Veille | `await api('PUT', \`/api/admin/users/${me.id}/watch\`, { enabled: false })` | Non |
| Client | `manage_oauth_client.py deactivate --client-id <client_id>` | Non |
| Variables | Retirer `MCP_PRODUCTION_ALLOWED`, puis Redeploy | Oui |
