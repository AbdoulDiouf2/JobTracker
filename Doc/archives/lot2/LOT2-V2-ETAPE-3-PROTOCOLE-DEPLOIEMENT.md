# JobTracker — Lot 2 V2 · Étape 3 : protocole de déploiement contrôlé (remplace la Preview)

> **Décision du 8 octobre 2026** : **pas de Vercel Preview**. La validation se fait sur
> l'infrastructure JobTracker existante (production), avec le **MCP désactivé par défaut** et
> une **activation progressive après autorisation**.
> **Référence** : [rapport complémentaire](./LOT2-V2-ETAPE-3-SOUS-LOT-E0-COMPLEMENT.md) ·
> [rapport du sous-lot E0](./LOT2-V2-ETAPE-3-SOUS-LOT-E0-RAPPORT.md) ·
> [protocole E0 (OAuth)](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md).
> **Statut** : **protocole à valider. Rien n'est exécuté.** Chaque étape 🔒 exige ton
> autorisation explicite et distincte.

## 1. Principe

Le déploiement se fait en **deux temps séparés** :

1. **D1, déploiement dormant** : le code de l'étape 2 et du sous-lot E0 arrive en production
   **sans rien activer**. Le MCP reste fermé : absent par défaut, et **bloqué par le code en
   production** tant qu'OAuth n'existe pas. La veille reste désactivée pour tous les comptes.
2. **Activation progressive (A1 à A4)**, plus tard, palier par palier, chacun sur autorisation.
   **Aucun MCP n'est exposé en production avant OAuth.**

| Protection | État en production après D1 |
|---|---|
| `MCP_ENABLED` | Absent, donc `false` |
| Blocage du code en production | Actif : `VERCEL_ENV=production` → `/api/mcp` répond 404, même si la variable était posée par erreur |
| Chargement du SDK `mcp` | Jamais (aucun appel MCP possible) |
| Contrôle des hôtes et origines | En place, inactif tant que le MCP est fermé |
| `watch_enabled` | Absent pour tous les comptes → `/api/watch/*` répond 403 |
| Ingestion de veille | Aucune route HTTP |

## 2. Prérequis de D1 (tous avant le déploiement)

| # | Prérequis | Qui | Statut |
|---|---|---|---|
| P1 | Suite backend verte sur les dépendances figées : Windows 3.11 et Linux 3.12 | Moi | ✔ (658 / 656 + 2 ignorés) |
| P2 | **Tests ciblés des SDK d'IA** (complément §3.4) implémentés et verts | Moi | À faire, après ton accord |
| P3 | **Vérification en lecture seule des clients `source="chatgpt_watch"`** (décision conservée, rapport de l'étape 2 §2.2) | Toi | À faire |
| P4 | Relevé, dans le **journal de build du déploiement de production actuel** (`ef07ab6`), des versions installées de `openai`, `google-genai`, `fastapi` et `starlette`, et de la version de Python (lecture seule) | Toi | À faire |
| P5 | Revue humaine du diff complet (étape 2 + sous-lot E0) | Toi | À faire |
| P6 | 🔒 Autorisation de **commit** puis de **push sur `main`** (le déploiement de production suit automatiquement) | Toi | — |
| P7 | Créneau sans urgence, avec le temps de faire les contrôles du §3 (environ 30 min) | Toi | — |

**P4 compte** : si la production tourne déjà sur `openai` 3.x et `google-genai` 2.x, D1 ne
change rien pour l'IA. Sinon, D1 est **aussi** une montée de version des SDK d'IA, et les
contrôles C7 deviennent bloquants.

## 3. D1 : déploiement dormant 🔒

### 3.1 Contenu

- Étape 2 : préférences de veille, ingestion interne, quotas, routes `/api/watch/*`, route
  admin `watch_enabled`, source `chatgpt_watch` réservée.
- Sous-lot E0 : 3 règles `vercel.json`, dépendances figées, transport MCP dormant.

**Aucune migration de données** : les nouvelles collections ne sont créées qu'au premier
usage, et l'absence de `watch_enabled` vaut `false`.

### 3.2 Contrôles après déploiement

Requêtes anonymes en lecture, puis navigation connectée avec ton compte :

| # | Contrôle | Attendu | NO-GO si |
|---|---|---|---|
| C1 | Journal de build Vercel | Ready ; Python **3.12** ; installation des versions figées sans erreur ; taille sous 500 Mo | Échec de build (la production reste sur l'ancien déploiement) |
| C2 | `GET /api/health` | 200 `healthy` | 5xx |
| C3 | `GET` des 4 chemins `/.well-known/oauth-*` et `openid-configuration` | **404 `application/json`** `{"detail":"Not Found"}` | HTML |
| C4 | `GET` et `POST /api/mcp` | **404 JSON**, identique à une route absente | Toute autre réponse |
| C5 | `/`, `/dashboard`, `/manifest.json`, `/.well-known/security.txt` | Frontend inchangé | Page blanche, erreur, JSON |
| C6 | Connexion, candidatures, Opportunités (liste, conversion d'une offre de test existante), jetons agent | Fonctionnement identique | Régression |
| C7 | **IA**, avec ta propre clé et pour chaque fournisseur que tu utilises : conseiller carrière, chatbot, extraction d'offre, analyse de CV, relance, score de correspondance (JSON), statistiques IA | Réponses normales | Erreur liée au SDK (le complément §3 liste les erreurs attendues **indépendantes** du déploiement) |
| C8 | Ton compte → `GET /api/watch/status` | **403 `watch_not_enabled`** (veille fermée) | 200 |
| C9 | Extension Chrome : connexion et ajout d'une candidature | Fonctionne | Régression |
| C10 | Journaux Vercel pendant 24 h | Pas de hausse des 5xx | Hausse durable |

### 3.3 Décision et retour arrière

| Résultat | Décision |
|---|---|
| C1 à C10 conformes | **GO D1** : production stable, MCP dormant |
| C7 en échec à cause des SDK | **Retour arrière**, puis correctif ciblé (version des SDK ou code) et nouveau D1 |
| Toute autre ligne NO-GO | **Retour arrière immédiat** |

**Retour arrière** : Vercel → Deployments → déploiement de production précédent (`ef07ab6`) →
**Instant Rollback**. Aucun redéploiement ni modification de données n'est nécessaire.
Les éventuels documents des nouvelles collections sont inoffensifs pour l'ancienne version.

## 4. Activation progressive (après GO D1, chaque palier sur autorisation) 🔒

| Palier | Action | Prérequis | Contrôle | Retour arrière |
|---|---|---|---|---|
| **A1** | `watch_enabled=true` sur **ton** compte (route admin) | GO D1 | `/api/watch/preferences` → valeurs D12 (08:00 et 18:00, Europe/Paris) | `watch_enabled=false` |
| **A2** | Déploiement d'OAuth (étape 3, à implémenter), **MCP toujours fermé** | Implémentation et tests OAuth validés | Métadonnées `/.well-known/*` exactes (E0a-2) ; `/api/mcp` toujours 404 | Instant Rollback |
| **A3** | Levée du blocage de production **uniquement si OAuth est actif** (changement de code revu), puis `MCP_ENABLED=true`, avec l'interrupteur d'urgence en place | A2 validé | `/api/mcp` sans jeton → **401** avec `WWW-Authenticate` (jamais 200) ; **mesure du démarrage à froid** (porte D13) | Interrupteur d'urgence, puis `MCP_ENABLED=false` |
| **A4** | Protocole **E0** : connexion depuis ChatGPT | A3 validé | [Protocole E0](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md) | Révocation, interrupteur |

**Ce qui change par rapport au plan Preview** : le fonctionnement réel du transport MCP sur
Vercel (sans `lifespan`) et la mesure du démarrage à froid **ne sont plus vérifiés avant
OAuth**. Ils le seront au palier **A3**, derrière OAuth. Localement, ils sont déjà validés sur
Linux 3.12 sans `lifespan`.

## 5. Preuves à conserver

Horodatages UTC, extrait du journal de build (versions, Python, taille), réponses C3, C4 et
C8, résultats C7 par fournisseur, décision. **Jamais** de valeur de variable d'environnement
ni de clé.
