# Guides de connexion des agents MCP

URL du serveur MCP, identique pour tous : **`https://jobtracker.maadec.com/api/mcp`**
(sans barre oblique finale : elle doit correspondre exactement à la ressource OAuth).

Prérequis communs :

- MCP actif en production et interrupteur d'urgence **ouvert** (Paramètres → API / Agents →
  Connexions OAuth / MCP) ;
- compte propriétaire avec la **veille activée** par un admin (`watch_enabled`) ;
- connexion à JobTracker dans le navigateur au moment du consentement.

| Client | Mécanisme | État |
|---|---|---|
| ChatGPT | Client confidentiel pré-enregistré | **Validé en production** (veille quotidienne en service) |
| Claude (web, Desktop, mobile) | Client confidentiel pré-enregistré | **Validé en production** (veille quotidienne en service) |
| Claude Code | CIMD | **Validé en production le 9 octobre 2026** (connexion et appels en lecture) |
| Codex | CIMD | Procédure proposée, **non validée** en connexion réelle |
| VS Code | CIMD | Procédure proposée, **non validée** en connexion réelle |
| Application native (client public fixe) | P2, client public | Testé automatiquement ; aucune application réelle connectée |

Ne jamais coller un code d'autorisation, un jeton ou un secret dans un ticket, un journal ou une
conversation.

## ChatGPT (client confidentiel existant)

1. JobTracker → Paramètres → API / Agents → Connexions OAuth / MCP : carte **ChatGPT** (type
   Confidentiel, statut Actif). Ne pas la recréer.
2. Dans ChatGPT, le connecteur JobTracker utilise l'URL MCP ci-dessus, en OAuth avec le
   `client_id` affiché sur la carte et le secret conservé lors de sa création.
3. Adresse de retour enregistrée : `https://chatgpt.com/connector_platform_oauth_redirect`. Si
   ChatGPT affiche une adresse propre au connecteur (`https://chatgpt.com/connector/oauth/<id>`),
   l'ajouter sur la carte ChatGPT.
4. Secret perdu : « Régénérer le secret » (l'ancien est refusé immédiatement), puis le saisir dans
   ChatGPT.
5. Contrôle en lecture : demander à ChatGPT d'appeler `jobtracker_ping` puis `get_watch_status`.

## Claude web, Desktop, mobile (client confidentiel existant)

1. Carte **Claude** dans le panneau (Confidentiel, Actif) ; adresse de retour
   `https://claude.ai/api/mcp/auth_callback`.
2. Dans Claude : connecteur personnalisé, URL MCP ci-dessus, option **« Use your own OAuth
   client »** avec le `client_id` et le secret de la carte Claude.
3. Les réglages d'authentification d'un connecteur Claude ne se modifient pas après ajout :
   supprimer puis rajouter le connecteur pour les changer.
4. Ne jamais réutiliser le client ChatGPT pour Claude : un nouveau consentement du même compte
   pour un même client remplace l'autorisation précédente et déconnecterait ChatGPT.
5. Contrôle : `jobtracker_ping`, puis `get_watch_status`.

## Claude Code (CIMD) — validé le 9 octobre 2026

Prérequis côté JobTracker : politique CIMD **activée** avec le domaine **`claude.ai`** (carte
« Applications à identité publiée (CIMD) »). Aucun client à créer : il l'est automatiquement
après le premier consentement approuvé.

```bash
claude mcp add --transport http jobtracker https://jobtracker.maadec.com/api/mcp
claude mcp list
claude
```

Puis, dans Claude Code :

1. `/mcp` → sélectionner `jobtracker` → **Authenticate**. Le navigateur s'ouvre sur la page de
   consentement JobTracker.
2. Vérifier : « Autoriser **Claude Code** », **« Identité publiée par claude.ai »**, retour vers
   **`localhost`** avec l'avertissement « application installée sur cet appareil ». Autoriser.
3. Le navigateur revient vers `http://localhost:<port>/callback` (port choisi par Claude Code) ;
   Claude Code récupère les jetons.
4. Contrôle en lecture seule : demander d'appeler `jobtracker_ping` puis `get_watch_status`.

Particularités :

- `claude mcp add` enregistre le serveur dans la **configuration locale du projet courant** (portée
  par défaut) : il n'est visible que depuis ce dossier. Pour d'autres portées, voir
  `claude mcp add --help` (option `--scope`).
- Identité publiée : `https://claude.ai/oauth/claude-code-client-metadata` (retours
  `http://localhost/callback` et `http://127.0.0.1/callback`, méthode `none`).
- Le client CIMD reçoit les **scopes par défaut** de la politique (lecture seule recommandée) :
  `create_opportunities` et `report_watch_run` répondent alors 403. Pour autoriser l'écriture :
  élargir les permissions de la carte « Claude Code » puis **se reconnecter** (`/mcp` →
  ré-authentifier), car une autorisation existante n'est jamais étendue.

## Codex (CIMD) — non validé en connexion réelle

Constaté dans la documentation de Codex (octobre 2026) : Codex choisit CIMD si la découverte
annonce `client_id_metadata_document_supported: true`, la méthode `none`, et que le rappel est une
adresse locale `http://127.0.0.1` ; identité publiée `https://chatgpt.com/oauth/codex/client.json`
(ou un document par `callback_id`).

Procédure proposée :

1. Politique CIMD : ajouter **`chatgpt.com`**.
2. Ajouter le serveur dans Codex avec l'URL MCP ci-dessus et lancer la connexion OAuth (au besoin
   en forçant `--oauth-client-registration cimd`) ; vérifier la syntaxe exacte dans la
   documentation de Codex.
3. Consentement attendu : « Autoriser Codex », « Identité publiée par chatgpt.com », retour local.
4. Contrôle : `jobtracker_ping`, `get_watch_status`.

À vérifier lors du premier essai : chaque `callback_id` peut produire un client distinct dans le
panneau.

## VS Code (CIMD) — non validé en connexion réelle

Identité publiée constatée : `https://vscode.dev/oauth/client-metadata.json` (retours
`http://127.0.0.1:33418/` et `https://vscode.dev/redirect`, méthode `none`).

Procédure proposée :

1. Politique CIMD : ajouter **`vscode.dev`**.
2. Dans VS Code, ajouter un serveur MCP de type HTTP avec l'URL ci-dessus, puis lancer
   l'authentification proposée par VS Code.
3. Consentement attendu : « Autoriser Visual Studio Code », « Identité publiée par vscode.dev ».
4. Contrôle : `jobtracker_ping`, `get_watch_status`.

## Application native avec client public fixe (P2)

1. Panneau → **Ajouter une application** → type « Application installée (publique) », adresse de
   retour locale `http://127.0.0.1/<chemin>` (sans port), permissions minimales.
2. Le Client ID est affiché à la création ; **il n'y a aucun secret**.
3. L'application doit utiliser PKCE S256 et le paramètre `resource`, et s'authentifier au point
   `/token` avec son seul `client_id`.

## En cas d'échec

| Symptôme | Cause probable |
|---|---|
| `invalid_request — redirect_uri non autorisée` | Le `client_id` est connu mais l'adresse de retour n'est pas enregistrée pour ce client (ex. client ChatGPT utilisé par Claude) : relever `client_id` et `redirect_uri` dans l'URL `/api/oauth/authorize?…` de la barre d'adresse |
| `invalid_client — Client inconnu` | Client inexistant ou désactivé ; pour CIMD : politique désactivée, domaine non approuvé, document indisponible ou invalide |
| Page « Compte non autorisé » | Veille non activée pour ce compte |
| 503 sur `/api/mcp` ou `/api/oauth/*` | Interrupteur d'urgence fermé |
| 403 `insufficient_scope` | Permission absente pour cet outil (client en lecture seule) |
| 401 après un temps d'usage | Autorisation révoquée, client désactivé ou veille désactivée |
