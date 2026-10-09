# JobTracker — Lot 2 V2 · Étape 3 : sous-lot OAuth minimal — rapport de validation

> **Référence** : spécification [§3 OAuth 2.1, §6 sécurité, §8 bis activation](./LOT2-V2-ETAPE-1-SPECIFICATION.md) ·
> [protocole E0](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md) ·
> [protocole de déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md).
> **Date** : 9 octobre 2026 · **Statut** : implémentation **locale** terminée, **à valider**.
> Aucun commit, push ni déploiement. Aucune tâche ChatGPT modifiée. Pas d'outil métier MCP.
> Correctif Gemini toujours séparé et non appliqué.

## 1. Résultat

| Suite | Windows, Python 3.11 (`.venv`) | Linux, Python 3.12 (conteneur) |
|---|---|---|
| **Lot 2 complet** (18 fichiers, MongoDB 7 éphémère) | **785 réussis, 1 xfail**, 0 échec | **783 réussis, 2 ignorés, 1 xfail**, 0 échec |
| dont `test_oauth.py` (nouveau) | **89 réussis** | 89 réussis |
| dont `test_mcp_transport.py` (appels désormais authentifiés) | 24 réussis | 24 réussis |

- **Décompte** : 697 avant ce sous-lot + 89 nouveaux = **786** sur chaque plateforme.
- Le **xfail** est le défaut de la lettre vide, corrigé par le correctif Gemini séparé (non appliqué).
- Les **2 ignorés** lisent l'historique git, absent du conteneur.
- Frontend : non modifié.

## 2. Ce qui a été implémenté

### 2.1 Points d'entrée

| Point d'entrée | Rôle | Protection |
|---|---|---|
| `GET /.well-known/oauth-protected-resource` et `…/api/mcp` | Métadonnées RFC 9728 (`resource`, `authorization_servers`, scopes) | 404 si MCP inactif ou coupé |
| `GET /.well-known/oauth-authorization-server` | Métadonnées RFC 8414 (S256 seul, `iss` en réponse, méthodes d'authentification du client) | Idem |
| `GET /api/oauth/authorize` | Valide la demande, l'enregistre (10 min, usage unique), redirige vers la page de consentement `/oauth/consent?request=…` | Limite de débit 10 par minute et par IP |
| `GET /api/oauth/requests/{id}` | Détails pour la page de consentement (client, permissions en clair, compte, éligibilité) | Session **webapp** (l'extension est refusée) |
| `POST /api/oauth/consent` | Décision Autoriser / Refuser → URL de retour (code ou `access_denied`) | Session webapp ; demande à usage unique (atomique) |
| `POST /api/oauth/token` | `authorization_code` (PKCE) et `refresh_token` (rotation) | Client authentifié (`client_secret_basic` ou `_post`) ; limite de débit ; `Cache-Control: no-store` |
| `POST /api/oauth/revoke` | RFC 7009 : révoque le grant du jeton | Client authentifié ; 200 même si jeton inconnu |
| `GET /api/oauth/grants`, `DELETE /api/oauth/grants/{id}` | « Connexions ChatGPT » de l'utilisateur, révocation immédiate | Session webapp ; strictement limité au compte |
| `PUT /api/admin/settings/mcp-kill-switch` | Interrupteur d'urgence MCP et OAuth, sans redéploiement | Admin |
| `/api/mcp` | Désormais **protégé par jeton OAuth** (§2.3) | 5 couches |

### 2.2 Conformité à la spécification §3

| Exigence | Implémentation | Tests |
|---|---|---|
| Client pré-enregistré (D1, option A) | `client_id` `jt_oc_…`, secret `jt_ocs_…` **haché** (SHA-256), comparaison à temps constant ; script `scripts/manage_oauth_client.py` (création, liste, rotation du secret, désactivation) | Création, rotation, désactivation |
| `redirect_uri` en liste blanche **exacte** | Égalité stricte ; aucune redirection si client ou URI invalides (protection *open redirect*) | 6 variantes refusées sans `Location` |
| PKCE **S256 obligatoire** | `plain` et absence refusés ; vérificateur contrôlé (43 à 128 caractères) ; comparaison à temps constant | 4 cas à `/authorize`, 2 à `/token` |
| `resource` (RFC 8707) | Exigé et égal à la ressource canonique à `/authorize` ; contrôlé s'il est présent à `/token` ; l'audience du jeton est vérifiée à chaque appel | 4 cas + test d'audience |
| `iss` (RFC 9207) | Présent dans toute redirection, succès comme erreur | Vérifié |
| Code d'autorisation | Aléatoire 256 bits, **haché**, 60 s, usage unique, lié au client, à la `redirect_uri`, au challenge, à la ressource, aux scopes et à l'utilisateur | Expiré, réutilisé, autre client |
| Réutilisation d'un code | Les jetons déjà émis sont **révoqués** (grant `compromised`) | Testé |
| Jetons opaques `jt_oat_` / `jt_ort_` | Hachés seulement ; accès 1 h, refresh glissant 30 j, grant absolu 90 j (D2, réglables pour E5) | Aucune valeur brute en base ni dans les journaux |
| Rotation du refresh token | À chaque usage ; réutilisation après le délai de grâce → **famille révoquée** (`compromised`) | Testé |
| Machine d'états du grant (§3.7) | `active`, `access_expired_observed` (jeton expiré présenté), `reconnection_required` (refresh expiré ou fin absolue), `revoked`, `compromised`, `superseded` (nouveau consentement) | Chaque transition |
| Propriétaire uniquement (D7) | Compte actif **et** `watch_enabled`, vérifié au consentement, à l'échange du code, au refresh et à **chaque** appel MCP | 4 tests |
| Scopes | `watch:read`, `opportunities:write` ; sous-ensemble possible ; aucune extension au refresh | Testé |
| Jeton agent ↔ jeton OAuth | `jt_agent_` refusé sur `/api/mcp` ; jeton OAuth refusé sur `/api/agent/*` | Testé |
| Journalisation sans secret | Seuls des préfixes de grant et des identifiants | Test sur les journaux capturés |

### 2.3 `/api/mcp` : contrôles dans l'ordre (§8 bis.2)

1. **MCP actif** (`MCP_ENABLED`), sinon 404 identique à une route absente. **Toujours bloqué en
   production Vercel** : la levée de ce blocage reste une décision distincte (palier A3).
2. **Interrupteur d'urgence** en base → 503, effet immédiat.
3. **Jeton OAuth valide** → sinon **401** avec `WWW-Authenticate: Bearer
   resource_metadata="https://jobtracker.maadec.com/.well-known/oauth-protected-resource/api/mcp",
   scope="watch:read opportunities:write"` (avec `error="invalid_token"` si un jeton est fourni).
4. **Scope de l'outil** → sinon **403** `insufficient_scope`, avec l'en-tête de défi
   correspondant.
5. **Hôtes et origines** (SDK).

L'identité est transmise aux outils par une variable de contexte issue du **grant**, jamais
d'un argument. Le SDK `mcp` n'est chargé qu'**après** une authentification réussie (testé dans
un processus neuf, sur la base de test).

## 3. Écarts et précisions par rapport à la spécification

| # | Spécification | Implémentation | Raison |
|---|---|---|---|
| 1 | §3.4 : double requête de refresh dans les 30 s → « on renvoie la même paire » | **Nouvelle paire**, et la paire émise juste avant est **annulée** | Renvoyer la même paire exigerait de stocker les jetons bruts ; seuls les hachés sont conservés. Effet identique pour un retry légitime |
| 2 | §3.7 : `access_expired_observed` → `reconnection_required` si aucun refresh en 15 min, « constaté à la consultation » | État conservé ; la liste des connexions affiche l'alerte `refresh_not_observed` après 15 min. Le refresh reste accepté tant que le refresh token est valide | Ne pas forcer une reconnexion inutile si ChatGPT rafraîchit tardivement. Le vrai `reconnection_required` survient à l'expiration du refresh token ou à la fin absolue |
| 3 | §3.1 : `token_endpoint_auth_methods_supported` inclut `none` | **Non proposé** : clients confidentiels uniquement (`client_secret_basic`, `client_secret_post`) | Le client prévu est confidentiel (D1) ; `none` élargirait la surface sans besoin |
| 4 | §8 bis.2 : métadonnées → 404 si coupé | Appliqué ; `/.well-known/openid-configuration` reste toujours 404 (non supporté) | — |

## 4. Ce qui manque avant le test E0 (connexion réelle depuis ChatGPT)

| # | Élément | Où |
|---|---|---|
| M1 | **Page de consentement frontend** `/oauth/consent` : affichage client, permissions, compte ; boutons Autoriser et Refuser ; en-têtes anti-*clickjacking* (`X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`) via `vercel.json` | Prochain sous-lot (frontend) |
| M2 | Écran « Connexions ChatGPT » (liste et révocation) | Étape 4 (l'API est prête) |
| M3 | **Levée du blocage de production**, conditionnée à OAuth (palier A3) | Décision et changement de code revus |
| M4 | Déploiement D1 (dormant), puis création du client réel avec le script (🔒) | Protocole de déploiement |
| M5 | Prérequis déjà listés : checklist avant D1, vérification `chatgpt_watch`, journal de build | Toi |

## 5. Fichiers

| Fichier | Nature |
|---|---|
| `backend/services/oauth_service.py` | **Nouveau** : serveur d'autorisation complet (≈ 580 lignes) |
| `backend/routes/oauth.py` | **Nouveau** : routes OAuth et découverte |
| `backend/scripts/manage_oauth_client.py` | **Nouveau** : gestion du client pré-enregistré |
| `backend/utils/mcp_transport.py` | Interrupteur d'urgence, authentification Bearer, scopes, principal |
| `backend/routes/admin.py` | Interrupteur d'urgence (lecture, modification) |
| `backend/server.py` | Branchement des routes OAuth, de la découverte et de la base pour le transport |
| `backend/config.py`, `backend/.env.example` | Réglages `OAUTH_*` bornés et documentés |
| `backend/tests/test_oauth.py` | **Nouveau** : 89 tests |
| `backend/tests/test_mcp_transport.py` | Appels authentifiés ; sous-processus pointé sur la base de test |
| `backend/tests/run_mongo_tests.sh` | `test_oauth.py` ajouté |

**STOP** : en attente de ta validation.
