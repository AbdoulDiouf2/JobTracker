# Dette sécurité — JobTracker

Points relevés pendant l'audit du module « Opportunités » (Lot 1, octobre 2026).
Ils sont **volontairement hors périmètre** de ce chantier, pour ne pas mélanger
les sujets. Chacun mérite un correctif dédié, testé à part.

| # | Sujet | Gravité | Fichier |
|---|-------|---------|---------|
| S1 | Contournement du quota IA par l'en-tête `Origin` | Élevée | `backend/routes/ai.py` |
| S2 | `is_admin` toujours faux dans les routes IA | Moyenne | `backend/routes/ai.py`, `backend/utils/auth.py` |
| S3 | Secrets JWT / session avec valeur par défaut | Élevée (si variable absente en prod) | `backend/config.py` |

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

## S3 — Secrets avec valeur par défaut

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
- [ ] S3 corrigé (et variables vérifiées sur tous les environnements Vercel)
