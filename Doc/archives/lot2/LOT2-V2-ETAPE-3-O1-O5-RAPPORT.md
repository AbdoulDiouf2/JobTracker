# JobTracker — Lot 2 V2 · Étape 3 : rapport de validation des décisions O1 à O4

> **Décisions du 8 octobre 2026** : O1 à O4 validées ; O5 validée dans son principe, **non
> exécutée**.
> **Statut** : travaux locaux terminés, **en attente de validation**.
> Aucun commit, push, déploiement ni changement de production. Serveur Uvicorn non touché.
> Aucune implémentation OAuth.

## 1. Résultat

| Suite | Pile | Résultat |
|---|---|---|
| Backend complète (16 fichiers) | Windows, Python 3.11.9, `backend/.venv` neuf | **691 réussis, 1 xfail**, 0 échec |
| Backend complète (16 fichiers) | **Linux, Python 3.12.15** (`python:3.12-slim`) | **689 réussis, 2 ignorés, 1 xfail**, 0 échec |
| Correctif Gemini (séparé) | Worktree isolé à `ef07ab6` | **281 réussis** (260 existants + 21 nouveaux) |

**Décompte** : 658 (sous-lot E0) + 1 (test Preview remplacé par un test paramétré à 3 cas) +
33 (tests IA : 32 réussis + 1 xfail) = **692** tests, sur les deux piles.
- Les **2 ignorés** sous Linux lisent l'historique git, absent de la copie du conteneur. Ils
  passent sous Windows.
- Le **xfail** est **volontaire et strict** : il documente un défaut existant (§4). Il fera
  échouer la suite dès que le défaut sera corrigé, pour qu'on mette le test à jour.

## 2. Travaux

| # | Demande | Réalisation |
|---|---|---|
| 1 | Retirer les éléments spécifiques aux Preview (O1) | `allowed_hosts()` ne lit plus `VERCEL_ENV`, `VERCEL_URL` ni `VERCEL_BRANCH_URL` : uniquement la liste configurée. Le test « hôte de Preview accepté » est remplacé par un test qui vérifie qu'**aucun** hôte de déploiement Vercel n'est jamais accepté (3 cas, 421). Le protocole Preview a été supprimé à l'étape précédente. La règle S3 de `config.py`, qui traite une Preview comme la production pour les secrets, est **conservée** : c'est une protection |
| 2 | `.python-version` = 3.12 à la racine (O2) | Fichier créé (`3.12`). L'emplacement lu par Vercel avec l'ancien format `builds` sera **confirmé dans le journal du build D1** (checklist A6) |
| 3 | Tests IA hors ligne (O3) | `tests/test_ai_sdk_offline.py` : 33 tests (§3) ; ajouté aux deux scripts de tests |
| 4 | Correctif Gemini 1.5 séparé (O4) | Patch + documentation, **non appliqués** : [CORRECTIF-GEMINI-MODELES.md](../gemini/CORRECTIF-GEMINI-MODELES.md) |
| 5 | Checklist avant D1 | [LOT2-V2-CHECKLIST-AVANT-D1.md](./LOT2-V2-CHECKLIST-AVANT-D1.md) |

## 3. Tests IA hors ligne (O3)

**Principe** : aucun réseau, aucune clé. Chaque client du SDK est remplacé par un faux qui :
- **vérifie les arguments contre la signature réelle** de la méthode du SDK figé (un argument
  supprimé ou renommé ferait échouer le test) ;
- renvoie une **vraie réponse typée** du SDK figé (`ChatCompletion` d'OpenAI et de Groq,
  `GenerateContentResponse` de Google).

Toutes les variables de clé IA sont effacées pendant les tests : `config.py` charge
`backend/.env`, et aucune vraie clé ne peut donc être utilisée par erreur.

| Groupe | Tests | Couverture |
|---|---|---|
| T-IA-1, fonctions | 11 | `call_openai`, `call_google`, `call_groq`, `call_ai` (aiguillage et fournisseur inconnu), analyses de CV des 3 fournisseurs, modèle Groq demandé |
| T-IA-1, routes complètes (MongoDB) | 8 | **Score de correspondance** × 3 fournisseurs (dont `response_format` JSON), JSON entouré de balises Markdown ; **relance** (Gemini) ; **lettre de motivation** × 3 fournisseurs (Cloudinary simulé) |
| T-IA-2, réponses anormales | 6 (dont 1 xfail) | Réponse Gemini vide (`text = None`) ; JSON invalide ou vide pour le score → **500 contrôlé, rien d'enregistré** ; relance → **modèle de secours (200)** ; lettre vide → xfail (§4) |
| T-IA-3, clients Google non référencés | 6 | Analyse du code des 5 fichiers d'IA : chaque `genai.Client(...)` est assigné (le SDK 2.x ferme un client non référencé) ; test du détecteur lui-même |
| T-IA-4, SDK figés | 2 | Instanciation hors ligne, interfaces utilisées présentes, versions installées identiques à `requirements.txt` |

## 4. Défaut existant mis en évidence (hors Lot 2)

**Lettre de motivation et réponse Gemini vide** : si Gemini ne renvoie aucun texte (blocage de
sécurité, par exemple), la route enregistre une lettre au contenu **`null`** et répond **200**.
Le comportement attendu, ne rien enregistrer et renvoyer une erreur explicite, est décrit par le
test `xfail` strict. **Aucune correction n'est faite ici** : la décision D-2 de la checklist
propose de la joindre au correctif Gemini.

## 5. Correctif Gemini (O4), en bref

- **Constat aggravé** : en plus de Gemini 1.5, `statistics.py` utilise `gemini-2.0-flash`,
  **arrêté le 1er juin 2026**. Gemini 2.5 est réservé par Google aux utilisateurs existants.
- **Remplacements** : `gemini-3.8-flash` par défaut (Flash stable actuel) et
  `gemini-3.5-flash-lite` (économique). Pas de modèle Pro : le seul disponible est en
  préversion.
- **Module central** `utils/ai_models.py` : modèles surchargeables par variables
  d'environnement ; tout identifiant retiré, même envoyé par un client, est redirigé vers un
  modèle actuel.
- **Patch** de 7 fichiers ; **21 tests** ; il s'applique à `ef07ab6` **et** à l'arbre du Lot 2
  sans conflit.
- Il a été préparé dans un worktree git isolé, **supprimé ensuite** : l'arbre de travail du
  Lot 2 n'est pas touché par le correctif.

## 6. Limites

1. Le comportement réel des appels d'IA (clés, quotas, disponibilité des modèles) **n'est pas
   testable hors ligne**. Il sera contrôlé avec ta clé, après déploiement (C7 du protocole).
2. Il faudra confirmer que Vercel lit bien `.python-version` à la racine avec l'ancien format
   `builds` (journal du build D1).
3. `backend/venv` contient toujours les versions figées plus 60 paquets hérités ; ton serveur
   tourne dessus. Procédure de recréation prête, non exécutée.

## 7. Fichiers modifiés ou ajoutés dans cette passe

| Fichier | Nature |
|---|---|
| `backend/utils/mcp_transport.py` | Retrait de l'ajout automatique d'hôtes Vercel |
| `backend/tests/test_mcp_transport.py` | Test Preview remplacé |
| `.python-version` | **Nouveau** (`3.12`) |
| `backend/tests/test_ai_sdk_offline.py` | **Nouveau** (33 tests) |
| `backend/tests/run_mongo_tests.sh` | Nouveau fichier de tests dans la liste |
| `Doc/CORRECTIF-GEMINI-MODELES.md` et `.patch` | **Nouveaux** (correctif séparé, non appliqué) |
| `Doc/LOT2-V2-CHECKLIST-AVANT-D1.md` | **Nouveau** |

**STOP** : en attente de ta validation.
