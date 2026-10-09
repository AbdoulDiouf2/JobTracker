# JobTracker — Lot 2 V2 · Étape 3, sous-lot E0 : rapport complémentaire

> **Suite de la revue du 8 octobre 2026** (5 décisions) ·
> [rapport du sous-lot E0](./LOT2-V2-ETAPE-3-SOUS-LOT-E0-RAPPORT.md) · nouveau
> [protocole de déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md).
> **Statut** : à valider. Aucune modification de code dans ce complément. Aucun commit, push,
> déploiement ni changement de production. Le serveur Uvicorn en cours d'exécution **n'a pas
> été touché**. Aucune implémentation OAuth.

## 1. Décision 1 : Preview retirée

- Le protocole Preview est **supprimé** (fichier non suivi par git).
- Il est remplacé par le [protocole de déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md) :
  - un déploiement **dormant** (D1) avec contrôles et retour arrière instantané ;
  - puis une activation par paliers A1 à A4, chacun sur autorisation ;
  - aucun MCP exposé en production avant OAuth.
- **Conséquence assumée** : le fonctionnement du transport MCP sur l'infrastructure Vercel et
  la mesure du démarrage à froid (porte D13) sont reportés au palier **A3**, derrière OAuth.
  Ils restent validés en local sur Linux / Python 3.12 sans `lifespan`.
- **Code** : le transport ajoute les hôtes du déploiement quand `VERCEL_ENV=preview`. Ce chemin
  ne sert plus, mais reste inoffensif : sans `MCP_ENABLED`, `/api/mcp` répond 404. Je propose
  de le **retirer** dans le prochain sous-lot de code, pour réduire la surface (décision O1).

## 2. Décision 2 : procédure sûre pour `backend/venv` (non exécutée)

**État actuel** :
- `backend/venv` sert à ton serveur `uvicorn server:app --reload --port 8001` (PID 21756 au
  moment de l'incident). Il contient les versions figées, plus 60 paquets hérités.
- `backend/.venv` est un venv neuf, propre, et vérifié (658 tests).

**Procédure, à lancer quand tu le décides** (PowerShell, depuis `backend`) :

1. **Arrêter le serveur de développement** : dans son terminal, `Ctrl+C`. Vérifier qu'aucun
   processus ne l'utilise encore :
   ```powershell
   Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*backend\venv*" } | Select-Object ProcessId, CommandLine
   ```
   Le résultat doit être vide. Sinon, fermer les terminaux ou l'éditeur concernés ; ne pas
   forcer l'arrêt sans savoir ce que c'est.
2. **Mettre l'ancien venv de côté** (retour arrière possible) :
   ```powershell
   Rename-Item venv venv-old-20261008
   ```
   Si Windows refuse (fichier verrouillé), revenir à l'étape 1.
3. **Recréer le venv** à partir des versions figées :
   ```powershell
   python -m venv venv
   .\venv\Scripts\python -m pip install --upgrade pip
   .\venv\Scripts\python -m pip install -r requirements-dev.txt
   .\venv\Scripts\python -m pip check
   ```
   Variante plus rapide : renommer `.venv` en `venv`. Un venv Windows supporte mal le
   déplacement, donc la recréation est préférable.
4. **Vérifier** : `bash tests/run_mongo_tests.sh` (Docker Desktop démarré) → **658 réussis**.
5. **Relancer le serveur** :
   ```powershell
   .\venv\Scripts\activate
   uvicorn server:app --reload --port 8001
   ```
   Puis `http://localhost:8001/api/health` → `healthy`.
6. **Nettoyage**, après quelques jours sans problème : supprimer `venv-old-20261008`, et
   éventuellement `.venv`.

**Retour arrière** : arrêter le serveur, supprimer `venv`, renommer `venv-old-20261008` en
`venv`. Ce venv contient déjà les versions figées (mise à jour sur place). Pour revenir aux
**versions d'origine**, réinstaller depuis la liste sauvegardée (`freeze-old-venv.txt`, 161
paquets, dans le scratchpad de la session). Je peux la copier dans le dépôt si tu le souhaites.

**Remarque** : ton serveur actuel tourne avec un mélange de modules déjà chargés (anciennes
versions) et de fichiers mis à jour sur le disque. Le mode `--reload` recharge le code de
l'application, mais l'état de ce processus n'est pas fiable. Un redémarrage, même sans recréer
le venv, est conseillé avant tout test manuel.

## 3. Décision 3 : audit des SDK `openai` et `google-genai`

### 3.1 Usages réels dans le code

| Fichier | Fournisseurs | Appels | Lecture de la réponse |
|---|---|---|---|
| `routes/ai.py` (conseiller, chatbot, extraction d'offre, statistiques IA via `call_ai`) | OpenAI, Google, Groq | `OpenAI(...).chat.completions.create(model, messages)` ; `genai.Client(...).models.generate_content(model, contents=texte)` ; `Groq(...).chat.completions.create(...)` | `.choices[0].message.content` ; `.text` |
| `routes/data_import.py` (analyse de CV) | OpenAI (`gpt-4o`), Google (`gemini-1.5-flash`), Groq | Identiques | Identiques |
| `routes/documents.py` (lettres) | OpenAI (`gpt-4o-mini`), Google (`gemini-1.5-flash`), Groq (`llama-3.1-8b-instant`) | Identiques | Identiques |
| `routes/tracking.py` (relance, score de correspondance) | Google (`gemini-1.5-flash`), OpenAI et Groq avec **`response_format={"type": "json_object"}`** | Identiques | Identiques, puis analyse JSON |

**Points communs** : uniquement les clients **synchrones**, sans client HTTP personnalisé, sans
streaming, sans outils ni fonctions, sans API *Responses* ni *Interactions*. Le chemin
`emergentintegrations` n'est pas installé : ce sont les SDK standard qui servent.

### 3.2 Changements des versions majeures et exposition de JobTracker

| SDK | Changement majeur | Touche JobTracker ? |
|---|---|---|
| `openai` **2.0** | Type de sortie des appels d'outils (API *Responses*) | **Non** : aucun outil, aucune API *Responses* |
| `openai` **3.0** (12 août 2026) | Client HTTP **HTTPX2** au lieu de HTTPX ; **certifi retiré**, certificats lus dans le **magasin du système** | Client HTTP : **non**, aucun client personnalisé. **Certificats : risque réel** sur un environnement sans magasin système → **vérifié** (§3.3) |
| `google-genai` **2.0** | Changements limités à l'API *Interactions* ; `generate_content` inchangé | **Non** |
| `google-genai` 2.x (comportement constaté) | Le client se **ferme** quand il n'est plus référencé ; un appel chaîné `genai.Client(...).models.generate_content(...)` échoue (`client has been closed`) | **Non** : le code garde toujours une référence (`client = genai.Client(...)`) dans les 4 fichiers. **Garde-fou** : un test le vérifiera (§3.4) |
| `groq` 1.0 → 1.7 | Version mineure | Non |

### 3.3 Vérifications effectuées (sans aucune donnée réelle)

| Vérification | Windows 3.11 (`.venv`) | Linux 3.12 (`python:3.12-slim`) |
|---|---|---|
| Méthodes et arguments utilisés (`create(model, messages, response_format)`, `generate_content`, `.text`) | Présents | — |
| Construction et lecture de vraies réponses typées des SDK figés (`ChatCompletion`, `GenerateContentResponse`) | `.choices[0].message.content` et `.text` corrects | — |
| **TLS réel**, clé **factice** (« ping », refusé avant traitement) : OpenAI | 401 → **TLS OK** | 401 → **TLS OK** (magasin système présent) |
| TLS réel, clé factice : Groq | 401 → **TLS OK** | 401 → **TLS OK** |
| TLS réel, clé factice : Google (`gemini-2.5-flash`) | 400 « API key not valid » → **TLS OK** | 400 → **TLS OK** |

Le runtime Vercel (Linux) fournit un magasin de certificats système. Un échec TLS d'`openai`
3.x y est donc **peu probable**, mais il ne sera **confirmé qu'en production** (contrôle C7).
Parade prête si besoin : variable `SSL_CERT_FILE` pointant vers un bundle CA.

### 3.4 Risques indépendants des versions, découverts pendant l'audit

1. **Modèles Gemini 1.5 arrêtés par Google** (`gemini-1.5-flash`, `gemini-1.5-pro`) : arrêt
   annoncé pour le 24 septembre 2025 au plus tard. Ils sont **codés en dur** dans `ai.py`
   (catalogue et choix par défaut), `data_import.py`, `documents.py` et `tracking.py`.
   **Conséquence probable : toutes les fonctions IA passant par Google échouent déjà en
   production**, quelle que soit la version du SDK. Seul `statistics.py` utilise
   `gemini-2.0-flash`. Non vérifiable avec une clé factice (la clé est refusée avant le
   modèle). Correction proposée, **hors Lot 2** et à décider : remplacer par un modèle actuel,
   par exemple `gemini-2.5-flash`.
2. Autres noms de modèles du catalogue (`gpt-4-turbo`, `deepseek-r1-distill-llama-70b` sur Groq)
   : disponibilité **à vérifier** avec ta clé lors de C7.
3. Une réponse Gemini vide (blocage de sécurité, par exemple) donne `text = None` ; le code qui
   analyse ensuite ce texte peut échouer. Comportement existant, à couvrir par un test.
4. Les clients synchrones sont appelés dans des fonctions `async` : ils bloquent la boucle
   pendant l'appel. C'est existant et sans lien avec les versions ; à noter pour plus tard.

### 3.5 Tests ciblés proposés avant la production (prérequis P2 du protocole)

| # | Test (hors ligne, sans clé ni réseau) | Ce qu'il garantit |
|---|---|---|
| T-IA-1 | Pour chaque fonction (`call_openai`, `call_google`, `call_groq`, analyse de CV, lettre, relance, score de correspondance) : remplacer le client du SDK par un faux qui **enregistre les arguments** et renvoie une **vraie réponse typée** du SDK figé | Arguments envoyés corrects (`model`, `messages`, `response_format`) et lecture de la réponse compatible avec les versions figées |
| T-IA-2 | Réponse Gemini vide (`text = None`) et JSON invalide pour le score de correspondance | Erreur propre (4xx ou 5xx contrôlée), pas de plantage |
| T-IA-3 | Inspection du code : aucun `genai.Client(...)` utilisé sans être assigné | Protège contre la fermeture automatique du client en 2.x |
| T-IA-4 | Instanciation des 3 clients dans l'environnement Linux 3.12 (conteneur), comme sur Vercel | Pas d'erreur à l'import ni à la construction |
| T-IA-5 *(manuel, après D1)* | C7 du protocole : un appel réel par fonctionnalité et par fournisseur, avec ta clé | Comportement réel, TLS en production, disponibilité des modèles |

Estimation : environ 25 tests. Aucune clé ni aucun appel réseau dans la suite automatique.

## 4. Décision 4 : dépendances figées, Python 3.12 et Vercel

| Contrôle | Résultat |
|---|---|
| Installation de `requirements.txt` figé, `python:3.12-slim` (Linux) | **OK**, `pip check` sans conflit, imports clés OK |
| Suite complète sous Linux / Python 3.12.15 | **656 réussis, 2 ignorés** (historique git absent du conteneur), 0 échec |
| Installation sous `python:3.13-slim` (si Vercel change de version par défaut) | **OK**, `pip check` sans conflit, imports OK |
| Windows / Python 3.11.9 (`.venv` neuf) | 658 réussis |
| `svglib==1.5.1` (distribué en sources seulement) | Se construit sous 3.12 et 3.13 |
| Version de Python sur Vercel | Pas de `.python-version` ni de `pyproject.toml` → **3.12, la valeur par défaut de Vercel**. Avec `builds` dans `vercel.json`, les réglages de build du tableau de bord ne s'appliquent pas : seuls les fichiers du dépôt comptent |
| Fichier de dépendances lu par Vercel | `backend/requirements.txt` (celui du point d'entrée `backend/api/index.py`). `requirements-dev.txt` **n'est pas installé** en production |
| Taille estimée | Environ 175 Mo pour une limite de 500 Mo |

**Proposition (décision O2)** : ajouter `backend/.python-version` contenant `3.12`, pour
figer explicitement la version et éviter un changement silencieux si Vercel modifie sa valeur
par défaut. **L'emplacement exact que lit Vercel avec l'ancien format `builds` n'est pas
confirmé** : à vérifier dans le journal du build D1 (contrôle C1). Sans ce fichier, rien ne
change par rapport à aujourd'hui.

**Limite** : la version de Python réellement utilisée par le déploiement actuel n'est pas
connue ici. Elle se lit dans le journal de build (prérequis P4).

## 5. Décision 5 : protections conservées (vérifiées dans le code actuel)

| Protection | Où | Test |
|---|---|---|
| MCP désactivé par défaut (`MCP_ENABLED=false`) | `config.py` | `test_disabled_by_default_answers_like_missing_route` |
| Aucun MCP en production avant OAuth (`VERCEL_ENV=production` → 404) | `utils/mcp_transport.mcp_enabled` | `test_blocked_in_vercel_production_even_if_enabled` |
| Chargement différé du SDK | `utils/mcp_transport.py` (imports dans les fonctions) | `test_sdk_is_loaded_only_on_first_mcp_call` |
| Hôtes (421) et origines (403) | `TransportSecuritySettings` du SDK | 4 tests |

**Aucune modification** de ces protections dans ce complément.

## 6. Décisions demandées

| # | Question | Recommandation |
|---|---|---|
| **O1** | Retirer du transport le chemin propre aux Preview | **Oui**, au prochain sous-lot de code |
| **O2** | Ajouter `backend/.python-version` = `3.12` | **Oui**, avec vérification dans le journal du build D1 |
| **O3** | Implémenter les tests ciblés T-IA-1 à T-IA-4 avant D1 | **Oui** |
| **O4** | Corriger les modèles Gemini 1.5 arrêtés (hors Lot 2) | **Oui**, mais par un correctif séparé, après ton arbitrage |
| **O5** | Valider le protocole de déploiement contrôlé (D1, puis A1 à A4) | — |

## Sources consultées (8 octobre 2026)

- [OpenAI Python SDK 3.0 : HTTPX2 et retrait de certifi](https://ecorpit.com/openai-python-3-0-httpx2-certifi-tls-container-breakage-2026/)
- [OpenAI Python 3.0 makes HTTPX2 an upgrade test for custom clients](https://magica.com/news/openai-python-sdk-httpx2-migration)
- [openai-python : guide de migration (v2)](https://www.mintlify.com/openai/openai-python/guides/migration)
- [google-genai sur PyPI](https://pypi.org/project/google-genai/2.13.0/)
- [Arrêt des modèles Gemini 1.5 (9to5Google)](https://9to5google.com/?p=662083)
- [Vercel : runtime Python (version par défaut 3.12)](https://vercel.com/docs/functions/runtimes/python)
- [Vercel : limites des fonctions](https://vercel.com/docs/functions/limitations)
