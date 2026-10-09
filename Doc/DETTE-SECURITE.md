# Dette sécurité — JobTracker

Points relevés pendant l'audit du module « Opportunités » (Lot 1, octobre 2026).
État au 10 octobre 2026 : **S1 et S2 ouverts** (code inchangé), **S3 corrigé**, **E2 corrigé**
(audit P4.0).
Ils sont **volontairement hors périmètre** de ce chantier, pour ne pas mélanger
les sujets. Chacun mérite un correctif dédié, testé à part.

| # | Sujet | Gravité | Fichier |
|---|-------|---------|---------|
| S1 | Contournement du quota IA par l'en-tête `Origin` | Élevée | `backend/routes/ai.py` |
| S2 | `is_admin` toujours faux dans les routes IA | Moyenne | `backend/routes/ai.py`, `backend/utils/auth.py` |
| E2 | Scripts tiers hérités chargés sur toutes les pages | Élevée — **corrigée** (P4.0) | `frontend/public/index.html` |
| S3 | Secrets JWT / session avec valeur par défaut | **Corrigée** (`ef07ab6`, 8 oct. 2026) : garde au démarrage qui refuse en production un secret absent, faible ou d'exemple. La production démarre avec cette garde, donc ses secrets ne sont plus des valeurs d'exemple. Historique et procédure de rotation : [archives/securite/S3-CORRECTION-ET-ROTATION.md](./archives/securite/S3-CORRECTION-ET-ROTATION.md) | `backend/config.py` |

---

## S1 — Contournement du quota IA par l'en-tête `Origin`

**Où** : `backend/routes/ai.py`, route `POST /api/ai/extract-job` (~l.572-576).

```python
origin = http_request.headers.get("origin", "")
from_extension = origin.startswith("chrome-extension://")
if not has_own_key and not is_admin and not from_extension:
    await check_and_increment_quota(user_id, db)
```

**Problème** : le client contrôle l'en-tête `Origin`. N'importe quel appel
authentifié (curl, script) qui envoie `Origin: chrome-extension://x` échappe au
quota IA journalier et consomme les clés IA de la plateforme sans limite.

**Piste de correction** : ne jamais déduire un privilège d'un en-tête fourni par
le client. On peut s'appuyer sur la claim `source="extension"` du JWT émis par
`/auth/extension/verify-code` (signé côté serveur), ou appliquer un quota propre
à l'extension plutôt qu'une exemption.

---

## S2 — `is_admin` toujours faux dans les routes IA

**Où** : `backend/routes/ai.py` (l.396, 416, 490, 568) :
`is_admin = current_user.get("role") == "admin"`.

**Problème** : `get_current_user` (`backend/utils/auth.py`) ne renvoie que
`{"user_id", "source"}`. La clé `role` est toujours absente, donc `is_admin`
vaut toujours `False`. L'impact est surtout fonctionnel (les administrateurs
sont soumis au quota), mais le code laisse croire à une vérification de rôle
qui n'a pas lieu.

**Piste de correction** : lire le rôle en base (comme `get_admin_user` dans
`routes/admin.py`) ou l'exposer dans `get_current_user`. Ne pas se fier à la
claim `role` du JWT pour une décision d'autorisation sans revérifier en base
(révocation ou rétrogradation).

---

## E2 — Scripts tiers hérités dans `index.html`

> **Statut : corrigé** (P4.0, octobre 2026).

**Où** : `frontend/public/index.html`, hérité de l'ancienne plateforme de génération du projet.

**Problème** : un script tiers était chargé sans condition sur toutes les pages, y compris la
connexion et le consentement OAuth. Le jeton de session étant stocké dans `localStorage`, ce
script pouvait le lire pour chaque utilisateur. Un second bloc, réservé à l'éditeur visuel de
cette plateforme, chargeait un script de supervision et le CDN Tailwind quand l'application était
affichée dans un iframe. Aucune politique CSP ne limitait les scripts.

**Correction** : suppression des deux chargements ; titre de l'onglet `JobTracker`. Aucun code
de `frontend/src` ne dépendait de ces scripts. Dans le même lot, toutes les autres traces de
cette plateforme ont été retirées du dépôt : script d'analyse d'audience PostHog (projet tiers,
enregistrement de session activé), plugins d'édition visuelle et de supervision du serveur de
développement, branches SDK et clé d'API dédiées dans le backend, fichiers, rapports de test et
archives associés.

**Vérifications** :

- tests frontend : 11 suites, 172 tests, tous verts ; `CI=true yarn build` réussi (ESLint au build,
  avertissements bloquants) ; aucune référence à la plateforme dans `frontend/build` ;
- Chrome headless sur le build servi localement : accueil, connexion, inscription, support,
  consentement OAuth, tableau de bord, Opportunités. Aucune requête émise vers le domaine de
  l'ancienne plateforme (journal réseau, événements `URL_REQUEST_START_JOB`). Contre-essai : avec
  le script réinjecté, la même mesure détecte bien la requête.

**Reste ouvert** :

- Pas de politique CSP `script-src`.

---

## S3 — Secrets avec valeur par défaut

> **Statut : corrigé** (`ef07ab6`). L'extrait ci-dessous montre l'**ancien** code, conservé pour
> l'historique ; voir `backend/config.py` pour la garde actuelle.

**Où** : `backend/config.py`

```python
JWT_SECRET: str = os.environ.get('JWT_SECRET', 'super-secret-key-change-in-production')
SECRET_KEY: str = os.environ.get('SECRET_KEY', 'super-secret-session-key')
```

**Problème** : si la variable d'environnement manque (nouvel environnement,
preview Vercel mal configurée), l'application démarre avec un secret public.
N'importe qui peut alors forger un JWT valide pour n'importe quel `user_id`.

**Piste de correction** : refuser de démarrer si `JWT_SECRET` ou `SECRET_KEY`
manque, ou s'il est égal à la valeur par défaut, hors `DEBUG`.

**Point connexe** : `CORS_ORIGINS` vaut `*` par défaut et est combiné à
`allow_credentials=True` (`backend/server.py`). L'authentification passant par
l'en-tête `Authorization` et non par des cookies, l'impact est limité. Il reste
préférable d'imposer une liste explicite d'origines en production.

---

## Suivi

- [ ] S1 corrigé et testé
- [ ] S2 corrigé et testé
- [x] E2 corrigé (scripts tiers hérités retirés de `index.html`)
- [x] S3 corrigé (garde au démarrage, `ef07ab6`) — vérifier les variables de tout nouvel environnement avec `backend/scripts/check_signing_secrets.py`
