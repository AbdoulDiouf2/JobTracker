# JobTracker — Lot 2 V2 · Checklist avant D1 (déploiement dormant)

> À remplir **avant** toute autorisation de commit, de push ou de déploiement ·
> [Protocole de déploiement contrôlé](./LOT2-V2-ETAPE-3-PROTOCOLE-DEPLOIEMENT.md).
> Toutes les vérifications sont **en lecture seule**. Ne jamais recopier une valeur de
> variable ou de clé.

## A. Dernier build de production (Vercel, lecture seule) — **toi**

Vercel → projet JobTracker → Deployments → déploiement **Production** actuel (`ef07ab6`) →
**Build Logs**.

| # | Relever | Valeur constatée | Attendu ou conséquence |
|---|---|---|---|
| A1 | Version de Python utilisée par le build | | **3.12** attendu (aucun fichier ne la fixait). Si différente : le signaler avant D1, car `.python-version` (3.12) la changera |
| A2 | Version installée d'`openai` | | Si **< 3.0** : D1 fait passer les SDK d'IA en version majeure → le contrôle **C7 devient bloquant** |
| A3 | Version installée de `google-genai` | | Idem si **< 2.0** |
| A4 | Versions de `fastapi` et de `starlette` | | Si **< 0.143.0 / 1.7.0** : D1 est aussi une montée de version de ce socle, couverte par les tests |
| A5 | Outil d'installation (`pip` ou `uv`) et éventuels avertissements | | Pour information |
| A6 | Le build mentionne-t-il la lecture de `.python-version` ? (au prochain build) | | À vérifier au contrôle C1 de D1 |

## B. Données et usages (lecture seule) — **toi**

| # | Vérification | Résultat |
|---|---|---|
| B1 | Jetons agent actifs, et date de dernière utilisation (Paramètres JobTracker ou `db.agent_tokens.find({revoked_at: null}, {name: 1, last_used_at: 1})`) | |
| B2 | Opportunités de source « Veille ChatGPT » (`db.opportunities.countDocuments({source: "chatgpt_watch"})`) | |
| B3 | **Si B1 ou B2 montre un client externe qui envoie `chatgpt_watch`** : décider avant D1 (changer la source de ce client, ou accepter le refus `422 source_reserved`) | |
| B4 | Variables Vercel en portée **Production** : `JWT_SECRET` et `SECRET_KEY` présentes (existence seulement) ; `MCP_ENABLED` **absente** | |

## C. Code et tests — **moi**, déjà fait sauf indication

| # | Vérification | État |
|---|---|---|
| C1 | Suite complète, Windows / Python 3.11 (`.venv` neuf) | ✔ 691 réussis + 1 xfail documenté |
| C2 | Suite complète, Linux / Python 3.12 (conteneur) | ✔ 689 réussis + 2 ignorés (historique git absent) + 1 xfail |
| C3 | Tests IA hors ligne (T-IA-1 à T-IA-4) | ✔ 32 réussis + 1 xfail |
| C4 | Dépendances figées installables sous Python 3.12 et 3.13 | ✔ |
| C5 | MCP : désactivé par défaut, bloqué en production, chargement différé, hôtes et origines | ✔ (tests) |
| C6 | Plus aucun code spécifique aux Preview | ✔ |
| C7 | Correctif Gemini **séparé**, non inclus dans D1 | ✔ (patch à part) |

## D. Décisions à prendre avant D1 — **toi**

| # | Décision | Choix |
|---|---|---|
| D-1 | Ordre : correctif Gemini **avant** D1, **après** D1, ou indépendamment | |
| D-2 | Défaut existant (lettre de motivation enregistrée vide quand Gemini ne répond rien, test xfail) : à corriger avec le correctif Gemini, ou plus tard | |
| D-3 | Recréation de `backend/venv` (procédure du rapport complémentaire §2) : avant ou après D1 | |
| D-4 | Revue humaine du diff complet du Lot 2 (étape 2 + sous-lot E0) faite | |
| D-5 | 🔒 Autorisation explicite de commit, puis de push sur `main` (déploiement D1) | |

**D1 ne peut être autorisé que si** A1 à A4 sont relevés, B3 est tranché, C1 à C7 sont
verts et D-4 est fait.
