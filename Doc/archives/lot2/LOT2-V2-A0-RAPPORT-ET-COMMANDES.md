# JobTracker — Lot 2 V2 · Sous-lot A0 : rapport et commandes d'activation

> **Date** : 9 octobre 2026 · **Statut** : développement **local** terminé, **à valider**.
> Rien n'est activé. Aucun client OAuth créé, aucune variable Vercel modifiée, base réelle,
> serveur Uvicorn et tâches ChatGPT non touchés. Aucun commit, push ni déploiement.

## 1. Changements

| # | Décision | Réalisation |
|---|---|---|
| 1 | Deux conditions cumulatives en production | `mcp_enabled()` : hors production, `MCP_ENABLED` suffit ; en production Vercel, il faut **`MCP_ENABLED=true` ET `MCP_PRODUCTION_ALLOWED=true`**. Nouveau réglage `MCP_PRODUCTION_ALLOWED` (faux par défaut) |
| 2 | Interrupteur d'urgence fermé par défaut | `kill_switch_active()` : **coupé** si le réglage est absent, d'une valeur autre que `false` exact, ou si la base est illisible. Seul `{"value": false}`, posé explicitement par l'admin, ouvre le service |
| 3 | 404 harmonisé | Corps `{"detail":"Not Found"}` compact, **identique à l'octet près** à une route absente (même type de contenu, même longueur) |
| 4 | Ajout d'une adresse de retour | Service `add_redirect_uri` et commande `add-redirect-uri` du script. Validation **stricte** (`validate_redirect_uri`) : HTTPS, nom de domaine en minuscules (pas d'IP), sans identifiants, port, requête, fragment, joker ni espace, 512 caractères au plus. Même validation à la création. Ajout idempotent |
| 5 | Script d'essai manuel | `backend/scripts/oauth_manual_check.py` : V1 à V3 anonymes, V4 à V6 interactifs. Aucun accès à la base ; n'affiche jamais le secret, le code ni les jetons (préfixe et longueur seulement). **Non exécuté sur la production** |
| 6 | Commandes de création du client | §3 (à exécuter par toi) |
| 7 | Outils exposés | Vérifié par tests : seul `jobtracker_ping` est déclaré et listé ; les 5 noms d'outils métier ne figurent pas dans le code du transport ; un appel à l'un d'eux renvoie une erreur sans aucune écriture |

**Interprétation de la décision 2, à confirmer** : « fermé par défaut » est compris comme
« **service coupé** tant qu'il n'est pas explicitement ouvert ». Conséquence : après la pose des
deux variables Vercel, il faudra encore **ouvrir** l'interrupteur (appel admin) pour que le
service réponde. C'est la lecture la plus sûre ; elle est réversible.

## 2. Tests

| Suite | Windows, Python 3.11 | Linux, Python 3.12 |
|---|---|---|
| **Backend complet** (18 fichiers) | **882 réussis, 1 xfail**, 0 échec | **880 réussis, 2 ignorés, 1 xfail**, 0 échec |
| dont `test_a0_activation.py` (nouveau) | 64 réussis | 64 réussis |

Décompte : 819 + 64 = **883** sur chaque plateforme. Le xfail (lettre vide, correctif Gemini
séparé) et les 2 ignorés (historique git absent du conteneur) sont inchangés. Frontend non
modifié.

Scénarios couverts (`test_a0_activation.py`, 64 tests) :
- **activation partielle** en production : `MCP_ENABLED` seul, seconde clé seule, aucune →
  tout en 404, même interrupteur ouvert ;
- **deux clés sans ouverture de l'interrupteur** → MCP et OAuth en 503, découverte en 404 ;
- **activation complète** → découverte en 200, `/api/mcp` en 401 avec le défi ; puis **coupure
  d'urgence** → 503 immédiat ;
- interrupteur : 7 états en base, plus une base illisible → coupé sauf `false` exact ; vue
  admin « active » par défaut ;
- 404 identique à l'octet près (3 méthodes × 2 configurations) ;
- 20 adresses de retour refusées, 2 acceptées ; ajout, idempotence, refus ; utilisation exacte
  à `/authorize` ;
- script d'administration exécuté sur la base de **test** : création, ajout, refus, liste,
  **sans jamais réafficher le secret** ;
- script d'essai manuel de bout en bout (navigateur simulé) : V1 à V6 conformes, aucun secret
  ni jeton dans la sortie ; mode `--checks-only` ; détection d'un service fermé ;
- 5 outils métier non exposés.

## 3. Commandes pour toi (rien n'est exécuté)

> **Prérequis local** : ton `backend/.env` contient encore une **valeur d'exemple** de
> `JWT_SECRET`. Sans `APP_ENV`, la garde S3 refuse donc de charger la configuration. Les
> scripts doivent être lancés avec **`$env:APP_ENV = "development"`** (cela ne concerne que ton
> poste, pas la production). Ils utilisent `MONGO_URL` de `backend/.env`, c'est-à-dire la
> **base réelle**.

### 3.1 Création du client OAuth ChatGPT (palier A4)

```powershell
cd backend
$env:APP_ENV = "development"
.\.venv\Scripts\python scripts\manage_oauth_client.py create --name ChatGPT `
  --redirect-uri https://chatgpt.com/connector_platform_oauth_redirect
```

- Le `client_secret` s'affiche **une seule fois** : le coller directement dans ChatGPT (ou ton
  gestionnaire de mots de passe), puis **effacer l'écran** (`Clear-Host`). Ne jamais le copier
  dans un fichier, un message ou un rapport.
- Si ChatGPT affiche une adresse de retour propre au connecteur :

```powershell
.\.venv\Scripts\python scripts\manage_oauth_client.py add-redirect-uri --client-id <client_id> `
  --redirect-uri https://chatgpt.com/connector/oauth/<callback_id>
```

- Contrôle (n'affiche aucun secret) :
  `.\.venv\Scripts\python scripts\manage_oauth_client.py list`
- Coupure : `... deactivate --client-id <client_id>` (révoque aussi les connexions).

### 3.2 Appels admin (connecté à JobTracker, console du navigateur)

```js
const api = (m, p, b) => fetch(p, { method: m, headers: { 'Content-Type': 'application/json',
  Authorization: 'Bearer ' + localStorage.getItem('token') }, body: b && JSON.stringify(b) }).then(r => r.json());
await api('GET', '/api/admin/settings/mcp-kill-switch');                 // {active: true} par défaut
await api('PUT', '/api/admin/users/<ton_id>/watch', { enabled: true });   // A2 : veille sur ton compte
await api('PUT', '/api/admin/settings/mcp-kill-switch', { active: false }); // A5 : ouverture
await api('PUT', '/api/admin/settings/mcp-kill-switch', { active: true });  // coupure d'urgence
```

### 3.3 Essai manuel (paliers A5 et A6)

```powershell
.\.venv\Scripts\python scripts\oauth_manual_check.py --checks-only
.\.venv\Scripts\python scripts\oauth_manual_check.py --client-id <client_id>
```

## 4. Séquence d'activation mise à jour

A0 déployé (sur ton autorisation), puis :
1. A2 : `watch_enabled` sur ton compte.
2. A3 : Vercel `MCP_ENABLED=true` **et** `MCP_PRODUCTION_ALLOWED=true`, puis Redeploy → le
   service reste **coupé** (interrupteur fermé par défaut) : MCP et OAuth en 503.
3. A4 : création du client (§3.1).
4. A5 : ouverture de l'interrupteur, puis `--checks-only`.
5. A6 : essai manuel complet.
6. A7 : protocole E0 avec ChatGPT.

**Coupure immédiate, sans redéploiement** : interrupteur `active: true` ; révocation de la
connexion ; `watch_enabled=false` ; `deactivate` du client.

## 5. Fichiers

| Fichier | Nature |
|---|---|
| `backend/utils/mcp_transport.py` | Deux clés ; 404 compact |
| `backend/services/oauth_service.py` | Interrupteur fermé par défaut ; validation stricte des adresses de retour ; `add_redirect_uri` |
| `backend/config.py`, `backend/.env.example` | `MCP_PRODUCTION_ALLOWED` |
| `backend/scripts/manage_oauth_client.py` | Commande `add-redirect-uri` |
| `backend/scripts/oauth_manual_check.py` | **Nouveau** : essai manuel V1 à V6 |
| `backend/tests/test_a0_activation.py` | **Nouveau** : 64 tests |
| `backend/tests/test_oauth.py`, `test_mcp_transport.py` | Ouverture explicite de l'interrupteur ; 404 à l'octet |
| `backend/tests/run_mongo_tests.sh` | Nouveau fichier de tests |
