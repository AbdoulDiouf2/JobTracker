# Correctif séparé (hors Lot 2) : modèles Gemini arrêtés et réponses IA vides

> **Décisions du 8 octobre 2026** : O4 validée (`gemini-3.8-flash` et `gemini-3.5-flash-lite`) ;
> correction du défaut « lettre de motivation vide » **dans ce même correctif** ; correctif
> **indépendant du Lot 2**.
> **Statut** : **préparé et testé, non appliqué**. Patch
> `CORRECTIF-GEMINI-MODELES.patch`, construit sur `ef07ab6`, SHA-256 `fe6c8e1b8230073e…`. Ce patch a
> été **supprimé en P4.0** : il modifiait du code backend retiré depuis et ne s'appliquait plus.
> Le correctif est à reconstruire sur le code actuel à partir de ce document.

## 1. Problèmes corrigés

| # | Problème | Effet en production (probable) |
|---|---|---|
| 1 | Modèles **arrêtés** codés en dur : `gemini-1.5-flash` (15 occurrences), `gemini-1.5-pro`, `gemini-2.0-flash` (arrêté le 1er juin 2026) | Toutes les fonctions IA passant par Google échouent |
| 2 | **Réponse IA vide** (par exemple un blocage de sécurité de Gemini) enregistrée comme un succès : lettre au contenu `null` en base avec un statut 200 ; échange vide dans l'historique du conseiller et du chatbot | Données vides présentées comme réussies |

## 2. Choix des modèles (sources officielles Gemini, 8 octobre 2026)

| Rôle | Modèle | Raison |
|---|---|---|
| Par défaut | **`gemini-3.8-flash`** | Flash **stable** le plus récent, recommandé pour l'usage général, sans date d'arrêt |
| Économique | **`gemini-3.5-flash-lite`** | *Lite* stable recommandé |
| Écartés | `gemini-3.1-pro-preview` (préversion), Gemini 2.5 (accès restreint aux utilisateurs existants) | Instabilité ou indisponibilité |

**Surcharge sans modifier le code** : variables `GEMINI_DEFAULT_MODEL` et
`GEMINI_LITE_MODEL`, par exemple `gemini-3.6-flash` si la clé n'a pas accès à 3.8.

## 3. Conception

- **`utils/ai_models.py`** (nouveau) :
  - constantes des modèles ;
  - `resolve_gemini_model()` : tout identifiant retiré, même envoyé par un client ou mémorisé
    par un navigateur, est redirigé vers un modèle actuel (*lite* vers *lite*) ;
  - `require_ai_text()` et `EmptyAIResponseError` : une réponse vide, blanche ou qui n'est pas
    du texte est **refusée**.
- **`call_ai`** (conseiller, chatbot, statistiques, extraction d'offre) refuse une réponse vide :
  - **avant** tout enregistrement : rien n'est écrit dans l'historique ;
  - l'extraction d'offre, qui essaie plusieurs fournisseurs, passe alors au suivant.
- **Lettre de motivation** : réponse vide → **502** « Le service IA n'a renvoyé aucun texte :
  aucune lettre n'a été enregistrée. Réessayez. » Aucun PDF, aucun envoi vers Cloudinary,
  aucun document en base.
- **Déjà sûrs** : l'analyse de CV et le score de correspondance échouent proprement sur une
  réponse vide, sans rien enregistrer. La relance renvoie son modèle de secours, sans rien
  enregistrer.

## 4. Fichiers (8)

| Fichier | Changement |
|---|---|
| `backend/utils/ai_models.py` | **Nouveau** : modèles, correspondance, garde-fou anti-réponse vide |
| `backend/routes/ai.py` | Catalogue (2 modèles actuels au lieu de 3 entrées obsolètes, dont un doublon), modèle par défaut, `call_google` résout le modèle, `call_ai` refuse le vide |
| `backend/routes/documents.py` | 2 modèles ; lettre vide → 502, rien d'enregistré |
| `backend/routes/data_import.py` | 8 modèles |
| `backend/routes/tracking.py` | 2 modèles |
| `backend/routes/statistics.py` | `gemini-2.0-flash` remplacé |
| `backend/tests/test_ai_models.py` | **Nouveau** : 21 tests |
| `backend/tests/test_ai_empty_responses.py` | **Nouveau** : 28 tests |

## 5. Tests — résultats définitifs (9 octobre 2026)

Suites complètes, MongoDB 7 éphémère, aucune clé réelle. Patch `fe6c8e1b8230073e…`, inchangé.

| Configuration | Windows, Python 3.11 | Linux, Python 3.12 |
|---|---|---|
| **Lot 2 seul** (dont la correction du test de concurrence, §5.1) | **696 réussis, 1 xfail** | **694 réussis, 2 ignorés, 1 xfail** |
| **`ef07ab6` + correctif** (production actuelle + correctif seul) | **307 réussis, 2 ignorés** | **307 réussis, 2 ignorés** |
| **Lot 2 + correctif** | **744 réussis, 2 ignorés** | **744 réussis, 2 ignorés** |

- **0 échec** dans les 6 exécutions.
- Les tests **ignorés** lisent l'historique git, absent des copies de test.
- Le **xfail** du Lot 2 seul est le défaut de la lettre vide. Il devient un test normal, et
  réussi, une fois le correctif appliqué : d'où 744 au lieu de 696 + 49 − 1.
- **Décompte** : Lot 2 = 692 + 5 (variante `in_progress` forcée) = 697. Correctif = 49 nouveaux
  tests. Avec le correctif : 697 + 49 = 746 = 744 réussis + 2 ignorés.

**Périmètre du patch vérifié ligne à ligne** : chaque ligne modifiée concerne un identifiant
de modèle Gemini, l'import de `utils/ai_models`, le catalogue des modèles ou le garde-fou
anti-réponse vide (`call_ai`, lettre de motivation). Aucune modification d'espaces seuls ni
d'autre fonctionnalité. 3 fichiers nouveaux (module et 2 fichiers de tests).

### 5.1 Test de concurrence intermittent (Lot 2) : corrigé séparément

Cause : sous forte charge, un appel concurrent reçoit `in_progress` (retryable), réponse
**prévue par la spécification** (§7.3), que l'ancien test refusait. Correction dans
`backend/tests/test_watch_ingest.py` (Lot 2, **sans toucher au code applicatif ni au patch
Gemini**) :
- **garanties inchangées** : une seule création réelle par offre, un seul identifiant, quotas
  exacts (`usage`, `reserved`), compteurs observés exacts (aucune erreur comptée) ;
- seule tolérance : `error` avec `reasons == ["in_progress"]`, `retryable` et sans identifiant
  d'opportunité. Toute autre erreur fait échouer le test ;
- **reprise testée** : un nouvel appel renvoie, pour chaque élément, le résultat enregistré
  (`replayed`), avec les mêmes identifiants et **aucune écriture** ;
- **nouvelle variante déterministe** (×5) : attente de 0 s, qui force `in_progress` à chaque
  exécution (vérifié par une assertion), puis contrôle des mêmes garanties et de la reprise ;
- **épreuve de charge** : 4 exécutions parallèles des 85 tests de concurrence (7 min 30) →
  **4 × 85 réussis**.

**Couverture des 49 tests** : correspondance de chaque identifiant retiré ; plus aucun
identifiant codé en dur dans `routes/` ; catalogue ; surcharge par variable d'environnement
(processus isolé) ; `call_ai` × 3 fournisseurs × 3 formes de vide ; lettre vide × 5 cas →
502 et rien d'enregistré ; lettre valide × 3 fournisseurs → enregistrée ; conseiller et chatbot
vides → rien dans l'historique ; conseiller valide → enregistré.

**Interaction avec le Lot 2** : le test `xfail` strict du Lot 2 (lettre vide) est désormais
**conditionnel**. Il reste `xfail` sans le correctif, et devient un test normal avec lui.
L'ordre d'application des deux reste libre.

## 6. Avant la mise en production (🔒 sur autorisation)

| # | Vérification | Qui |
|---|---|---|
| V1 | Revue du patch | Toi |
| V2 | **Accès réel aux deux modèles** avec la clé Google utilisée en production : lancer [verifier-modeles-gemini.py](./verifier-modeles-gemini.py) (clé saisie masquée, consigne « Réponds uniquement : OK », aucune donnée personnelle, 2 appels). **Non fait** : aucune clé Gemini n'est disponible localement (`backend/.env` ne contient que les identifiants OAuth Google). Si un modèle est inaccessible, définir `GEMINI_DEFAULT_MODEL` ou `GEMINI_LITE_MODEL` dans Vercel avant le déploiement | Toi |
| V3 | Variables `GEMINI_DEFAULT_MODEL` et `GEMINI_LITE_MODEL` : **absentes**, sauf choix explicite (V2) | Toi |
| V4 | Application sur une base propre (`git apply`), suite complète, **commit séparé** (par exemple `fix(ai): replace retired Gemini models and refuse empty AI responses`) | Moi, après accord |
| V5 | 🔒 Push et déploiement | Autorisation distincte |
| V6 | Après déploiement, avec ta clé : conseiller, chatbot, analyse de CV, lettre de motivation, relance, score de correspondance, statistiques IA ; **vérifier qu'aucune lettre vide n'apparaît** | Toi |
| V7 | Journaux Vercel 24 h : pas de hausse des 5xx sur `/api/ai/*`, `/api/documents/generate-cover-letter-ai`, `/api/applications/*/matching` | Toi |

**Effet visible pour les utilisateurs** : une réponse vide produit désormais une erreur
explicite (502 pour la lettre, 500 « Réponse vide » pour le conseiller et le chatbot) au lieu
d'un faux succès. **Le quota IA journalier reste consommé** pour cet appel, comme pour toute
autre erreur du fournisseur (comportement existant, non modifié).

**Retour arrière** : revert du commit, ou Instant Rollback Vercel. Aucune donnée n'est migrée.

## Sources

- [Gemini API : modèles](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API : calendrier d'arrêt des modèles](https://ai.google.dev/gemini-api/docs/deprecations)
