# JobTracker — Lot 2 V2 · Étape 3 : protocole E0 (connexion OAuth depuis ChatGPT)

> **Référence** : spécification §3 (OAuth 2.1), §3.2 (D1), §8 bis (activation), §10 (E0) ·
> contrôles [LOT2-V2-ETAPE-3-E0-CONTROLES.md](./LOT2-V2-ETAPE-3-E0-CONTROLES.md).
> **Date** : 8 octobre 2026 · **Statut** : **protocole à valider. Rien n'est exécuté.**
> Aucun client OAuth, jeton, déploiement ni modification de production n'est créé par ce
> document. Chaque étape marquée 🔒 exigera **ton autorisation explicite** au moment voulu.

## 1. Objectif

Prouver, **avant tout outil métier**, que ChatGPT réalise **réellement** le flux OAuth prévu
contre JobTracker. La porte E0 tranche **D1** (client pré-enregistré ou repli CIMD).

Critère de réussite global : ChatGPT se connecte au MCP minimal avec un **client statique**,
en utilisant **PKCE S256** et le paramètre **`resource`**, passe par la **page de consentement**,
échange le code, puis appelle **un outil de lecture** avec un jeton valide. Le tout est observé
**dans les journaux du serveur**, et non déduit des messages de ChatGPT.

## 2. Périmètre minimal déployé pour E0

| Élément | Contenu pour E0 | Hors E0 (plus tard) |
|---|---|---|
| Découverte | `/.well-known/oauth-protected-resource[/api/mcp]`, `/.well-known/oauth-authorization-server` (porte E0a-2) | — |
| Autorisation | `GET /api/oauth/authorize` (validation stricte), `POST /api/oauth/consent` (ticket), `GET /api/oauth/continue` (code et redirection), `POST /api/oauth/token` (code d'autorisation **et** refresh), `POST /api/oauth/revoke` | Machine d'états complète du grant, pré-alertes |
| Consentement | Page frontend minimale `/oauth/consent` (session JobTracker existante, boutons Autoriser et Refuser) | Finitions de l'interface (étape 4) |
| MCP | `/api/mcp`, variante par requête (E0b), **un seul outil** `get_watch_status` (lecture), scope `watch:read` | Les 4 autres outils |
| Protections | `MCP_ENABLED`, `platform_settings.mcp_kill_switch`, `watch_enabled` (ton compte seulement), hôte autorisé `jobtracker.maadec.com`, limite de débit | — |
| Journalisation | Événements OAuth et MCP **sans secret** (§5) | — |

Ce périmètre fera l'objet d'une revue locale (tests négatifs) **avant** tout déploiement.

## 3. Prérequis (aucun n'est réalisé à ce stade)

| # | Prérequis | Qui | Autorisation |
|---|---|---|---|
| R1 | Périmètre du §2 implémenté et testé en local (PKCE, `redirect_uri`, `resource`, scopes, usage unique du code, réutilisation de refresh, révocation, aucun secret dans les journaux) | Moi | Démarrage de l'implémentation de l'étape 3 |
| R2 | Correctif `vercel.json` et routes de métadonnées : E0a-1 puis E0a-2 réussis | Moi, puis toi | 🔒 Push et déploiement |
| R3 | Déploiement en production **derrière `MCP_ENABLED=false`**, puis `true` (plan A1 à A5, spécification §8 bis.3) | Toi (Vercel) | 🔒 Chaque bascule |
| R4 | `watch_enabled=true` sur **ton** compte uniquement | Toi (admin) | 🔒 |
| R5 | **Création du client OAuth statique** : un script d'administration génère `client_id` et `client_secret`. Le secret est affiché **une seule fois** ; seul son hash est stocké | Moi (script), toi (exécution) | 🔒 Création d'un identifiant réel |
| R6 | URI de redirection autorisées : `https://chatgpt.com/connector_platform_oauth_redirect`, plus l'URI **exacte** `https://chatgpt.com/connector/oauth/{callback_id}` si ChatGPT l'affiche | Toi (copie depuis ChatGPT) | Incluse dans R5 |
| R7 | Tâches et plugin du prototype du Gate 0 **supprimés** dans ChatGPT (toujours en attente de ton côté) | Toi | — |

## 4. Déroulé (environ 30 minutes, toi présent)

| Étape | Action (toi, dans ChatGPT ou JobTracker) | Observation attendue côté serveur | Résultat attendu |
|---|---|---|---|
| **1** | Vérifier dans un navigateur : `https://jobtracker.maadec.com/.well-known/oauth-protected-resource/api/mcp` | — | JSON avec `resource = https://jobtracker.maadec.com/api/mcp` |
| **2** | ChatGPT → Paramètres → mode développeur → créer un plugin MCP : URL `https://jobtracker.maadec.com/api/mcp`, authentification **OAuth**, **identifiants statiques** (`client_id`, `client_secret` de R5) | `POST /api/mcp` sans jeton → **401** avec `WWW-Authenticate: Bearer resource_metadata=…` ; puis `GET` des deux métadonnées | ChatGPT affiche « Se connecter » |
| **3** | Noter l'**URI de redirection** affichée par ChatGPT. Si elle n'est pas dans la liste (R6) : la transmettre, puis reprendre à l'étape 2 | `GET /api/oauth/authorize` ; refus `invalid_redirect_uri` **sans redirection** si l'URI est inconnue | — |
| **4** | Cliquer « Se connecter » | `GET /api/oauth/authorize` avec `response_type=code`, `client_id`, `redirect_uri` exacte, **`code_challenge_method=S256`**, **`resource`** canonique, `scope`, `state` | Redirection vers `/oauth/consent` |
| **5** | Sur la page JobTracker : vérifier le client (« ChatGPT »), les permissions et ton compte, puis **Autoriser** | `POST /api/oauth/consent` → ticket de continuation (le code ne passe jamais par le frontend) ; `GET /api/oauth/continue` → code émis (60 s, usage unique) et redirection avec `code`, `state`, **`iss`** | Retour automatique vers ChatGPT |
| **6** | — | `POST /api/oauth/token` : `grant_type=authorization_code`, `code_verifier` **présent et valide**, `resource`, méthode d'authentification du client **notée** (`client_secret_post` ou `client_secret_basic`) | Jetons émis ; grant `active` |
| **7** | Dans une conversation : « Utilise JobTracker pour afficher l'état de la veille » | `POST /api/mcp` avec Bearer valide : `initialize`, `tools/list`, `tools/call get_watch_status` → 200 | ChatGPT affiche l'état réel |
| **8** | Contrôle négatif : JobTracker → Paramètres → **Révoquer** la connexion, puis refaire l'étape 7 | `POST /api/mcp` → **401** (grant `revoked`) | ChatGPT signale une reconnexion nécessaire |
| **9** | *(Optionnel)* Reconnexion | Nouveau consentement ; ancien grant `superseded` | Fonctionne de nouveau |

Le comportement à l'expiration (refresh pendant une tâche programmée) n'est **pas** testé ici :
c'est l'objet de **E5** (spécification §10.1).

## 5. Grille d'observation (journaux serveur, sans secret)

| Champ | Valeur notée | Attendu |
|---|---|---|
| Découverte PRM, puis métadonnées AS | chemins demandés, ordre | Les deux demandés |
| `code_challenge_method` | | `S256` |
| `resource` à `authorize` et à `token` | présent ? égal ? | Présent et égal à la ressource canonique |
| `redirect_uri` | URI exacte | Dans la liste blanche |
| Scopes demandés | | `watch:read` (et `opportunities:write` si demandé) |
| Méthode d'authentification du client au `token` | | `client_secret_post` ou `client_secret_basic` |
| `iss` dans la redirection | présent ? | Présent (RFC 9207) |
| Premier appel MCP authentifié | statut, outil | 200, `get_watch_status` |
| Après révocation | statut | 401 |
| Confirmation demandée par ChatGPT | oui ou non | Noté (outil en lecture) |

**Jamais journalisés** : `client_secret`, codes, jetons, `code_verifier`, en-tête
`Authorization`. Seuls des **préfixes** et des identifiants internes (`grant_id`) le sont.

## 5 bis. Points spécifiques à documenter pendant le test réel (ajoutés le 9 octobre 2026)

### A. Compatibilité du client OAuth confidentiel avec ChatGPT

| Question | Comment l'observer | Si la réponse est défavorable |
|---|---|---|
| ChatGPT utilise-t-il bien les **identifiants statiques** saisis (et non CIMD ou DCR) ? | Journal `oauth_token` : `client_id` = celui créé par le script ; aucun appel à un point d'enregistrement | Repli CIMD (D1, option B) |
| Quelle **méthode d'authentification** au point `token` : `client_secret_basic` ou `client_secret_post` ? | En-tête `Authorization: Basic` présent ou non (le serveur accepte les deux) | Aucune action |
| ChatGPT exige-t-il un client **public** (`none`, sans secret) ? | Erreur `invalid_client` sans aucun secret transmis | Décision de sécurité : autoriser `none` pour ce seul client, PKCE restant obligatoire, ou repli CIMD |
| L'**URI de redirection** est-elle `connector_platform_oauth_redirect` ou `connector/oauth/{callback_id}` ? | Refus `invalid_request` à `/authorize` si absente de la liste blanche | Ajout de l'URI **exacte** (`manage_oauth_client.py`), jamais de motif |
| ChatGPT envoie-t-il `resource` aux deux étapes ? | Paramètres de `/authorize` et `/token` | Voir §6 |

### B. Deux renouvellements de jeton quasi simultanés

**Comportement actuel du serveur** : le premier renouvellement consomme le refresh token R0
et émet la paire A. Un second envoi de R0 **dans les 30 s** émet la paire B et **annule la
paire A**. Au-delà de 30 s, la réutilisation de R0 révoque toute la connexion (`compromised`).

| Cas | Effet |
|---|---|
| Réponse A perdue (coupure réseau), ChatGPT renvoie R0 | ChatGPT obtient B : **fonctionne** |
| Deux requêtes **réellement parallèles**, ChatGPT garde finalement **B** | Fonctionne |
| Deux requêtes parallèles, ChatGPT garde finalement **A** | A est annulée : 401 au prochain appel, puis `invalid_grant` au renouvellement → **reconnexion nécessaire** |

**À observer** pendant E0 et E5 : deux appels `oauth_token grant_type=refresh_token` sur la
même connexion à moins de 30 s d'intervalle, puis le statut de la connexion. Si le troisième
cas se produit, une option est prête à décider : dans la fenêtre de 30 s, **garder les deux
paires valides** au lieu d'annuler la première. Cela élargit légèrement la fenêtre d'usage d'un
jeton volé. Ce choix n'est pas fait aujourd'hui.

## 6. Décision selon les résultats

| Observation | Décision |
|---|---|
| Toutes les lignes du §5 conformes | **E0 PASS** → D1 = client pré-enregistré confirmé ; suite de l'étape 3 |
| `resource` absent | Ne pas assouplir silencieusement : rapport, puis arbitrage (le rendre facultatif avec une ressource implicite unique, ou NO-GO de l'option A) |
| PKCE absent ou `plain` | **FAIL**. Aucune tolérance (OAuth 2.1) |
| ChatGPT ignore les identifiants statiques (tente CIMD ou DCR) | **Repli CIMD** (D1, option B), puis nouvelle revue |
| `client_secret_basic` utilisé alors que seul `post` est accepté | Ajustement mineur : accepter les deux méthodes (prévu dans l'implémentation pour éviter ce cas) |
| URI de redirection imprévue | Ajout de l'URI **exacte**, après ta validation ; jamais de motif générique |
| Échec non expliqué | **STOP**, interrupteur d'urgence, rapport |

## 7. Sécurité pendant le test

- **Données** : l'outil `get_watch_status` ne renvoie que l'état de la veille (aucune offre,
  aucune candidature). Aucun outil d'écriture n'est exposé pendant E0.
- **Exposition** : MCP limité à ton compte (`watch_enabled`), hôte unique, limite de débit,
  interrupteur d'urgence.
- **Identifiants** : `client_secret` saisi directement par toi dans ChatGPT, jamais copié
  dans un fichier, un ticket ou une conversation. En cas de fuite : rotation du client et
  révocation des grants.
- **Pas de tâche programmée** pendant E0.

## 8. Retour arrière (du plus léger au plus fort)

1. Révoquer la connexion (Paramètres JobTracker) : effet immédiat.
2. `platform_settings.mcp_kill_switch = true` : `/api/mcp` et `/api/oauth/*` répondent 503,
   sans redéploiement.
3. `MCP_ENABLED=false` et redéploiement.
4. Suppression du client OAuth (script d'administration).
5. Suppression du plugin dans ChatGPT.

## 9. Preuves à conserver

Horodatages UTC de chaque étape ; extraits des journaux du §5 (sans secret) ; captures ChatGPT
de la configuration (sans le secret) et du résultat de l'étape 7 ; verdict E0 et décision D1.
Le tout sera consigné dans un rapport daté, comme les preuves du Gate 0.
