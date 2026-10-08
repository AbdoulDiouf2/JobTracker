# S3 — Correction des secrets de signature et plan de rotation

> **Date** : 8 octobre 2026 · **Priorité** : urgente.
> **État** : correction **préparée et testée en local**. Aucun commit, push ni déploiement.
> Aucune modification des variables Vercel. Aucune requête authentifiée vers la production.

---

## 1. Constat

| Élément | Constat | Méthode |
|---|---|---|
| `JWT_SECRET` (Vercel, tous environnements) | Commence par `votre-cle-secrete-a-changer-en-producti…`, selon ton observation dans Vercel | Ta vérification manuelle (D1) |
| Même motif dans le dépôt | `backend/.env.example`, ligne `JWT_SECRET=…` : valeur d'exemple de **41 caractères** au même préfixe, présente **depuis le 12 février 2026** (`5887a04`) | `git grep`, `git log -S` |
| Visibilité du dépôt | `github.com/AbdoulDiouf2/JobTracker` est **public** (API GitHub sans authentification : 200) | Lecture seule |
| Conclusion | La valeur de production est **très probablement exactement** la valeur publiée. N'importe qui peut donc **forger un JWT valide** : pour tout compte dont il connaît l'identifiant, y compris un admin, pendant 7 jours, sans révocation possible autrement que par rotation | Recoupement, plus démonstration locale (§4) |
| `SECRET_KEY` | `.env.example` contenait aussi une valeur d'exemple (29 caractères). **Valeur Vercel à vérifier.** Impact limité : CSRF du login Google | Lecture seule |

> Pour confirmer sans me la transmettre : ta valeur Vercel fait-elle **exactement 41
> caractères**, et correspond-elle **mot pour mot** à l'ancienne ligne `JWT_SECRET` de
> `backend/.env.example` (visible dans `git show 45d7e98:backend/.env.example`) ?

**Autres vérifications (sans afficher de valeur)** :
- **Bundle JS public de production** (`main.4b976b6e.js`) : aucune occurrence de motifs de
  secret (Mongo, OpenAI, Google, Groq, tokens agent, `JWT_SECRET`, `SECRET_KEY`,
  `ENCRYPTION_KEY`, `GOOGLE_CLIENT_SECRET`). Seules variables exposées :
  `REACT_APP_BACKEND_URL` et `REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG`, qui sont publiques
  par nature. Les fragments JS chargés à la demande n'ont pas été analysés.
- **Historique git complet** : aucun secret réel détecté pour les motifs Mongo avec
  identifiants, OpenAI, Google API, Groq, secret OAuth Google, Fernet, SMTP, token agent et
  Stripe. Deux faux positifs ont été examinés : un fragment d'URL « ri*sk-ana*lyst… » et un
  gabarit commenté `EMERGENT_LLM_KEY` sans chiffre.
- **`.env` local** : `JWT_SECRET` et `SECRET_KEY` sont différents de `.env.example`, mais le
  `JWT_SECRET` local contient lui aussi un **motif de valeur d'exemple**. La nouvelle
  validation le refuse (§3.3).

---

## 2. Correction préparée (code local, non commité)

| Fichier | Changement |
|---|---|
| [backend/config.py](../backend/config.py) | **Suppression des valeurs par défaut publiques**. Nouveau `APP_ENV` (défaut `production`). `resolve_signing_secrets()` est appelé au chargement du module, donc aussi sur Vercel |
| [backend/.env.example](../backend/.env.example) | `JWT_SECRET=` et `SECRET_KEY=` **vides**, commande de génération en commentaire, `APP_ENV=development` pour un usage local explicite |
| [backend/tests/conftest.py](../backend/tests/conftest.py) | `APP_ENV=test` explicite pour la suite de tests |
| [backend/tests/test_security_settings.py](../backend/tests/test_security_settings.py) | **33 tests** de sécurité (nouveau fichier) |
| [backend/tests/run_mongo_tests.sh](../backend/tests/run_mongo_tests.sh) | Inclut les tests de sécurité |

### Règles appliquées

**Production** (`APP_ENV` absent, `production`, `preview` ou toute autre valeur) : le
**démarrage est refusé** (`InsecureSecretError`) si `JWT_SECRET` ou `SECRET_KEY` est :
- absent ;
- plus court que 32 caractères ;
- composé de moins de 12 caractères distincts ;
- porteur d'un **motif de valeur d'exemple ou déjà publiée** (`change`, `changer`, `votre`,
  `your-`, `example`, `exemple`, `placeholder`, `super-secret`, `secret-key`, `cle-secrete`…) ;
- **ou identique** à l'autre secret.

Le message d'erreur cite le **nom** de la variable et la raison, **jamais la valeur**.

**`development` et `test` (explicites)** :
- un secret absent ou faible est remplacé par un **secret éphémère aléatoire**, généré à
  chaque processus, avec un avertissement dans les logs ;
- **jamais une valeur fixe** ;
- un secret conforme est conservé tel quel.

**Inchangés** : HS256 imposé à la vérification (déjà le cas), durée des sessions (7 jours),
JWT de l'extension (30 jours). Les **tokens agent** (hash SHA-256) et les **liens de
réinitialisation de mot de passe et de vérification d'e-mail** (aléatoires, stockés en base)
ne dépendent pas de ces secrets.

---

## 3. Impacts

### 3.1 Rotation de `JWT_SECRET`

| Élément | Effet | Comportement constaté dans le code |
|---|---|---|
| Sessions web | **Toutes invalidées** | Le premier appel API renvoie 401 ; l'intercepteur axios (`AuthContext`) vide la session et redirige vers `/login` |
| Extension Chrome | **Connexion invalidée** (JWT de 30 jours) | `handleApiFailure` : 401 → `clearAuth()` et message « Session expirée. Veuillez vous reconnecter. » → nouveau code via Paramètres |
| Tokens agent | Non affectés | — |
| Réinitialisation de mot de passe et vérification d'e-mail | Non affectées | — |

### 3.2 Rotation de `SECRET_KEY`

Seul un login Google en cours (moins de 10 minutes) échoue, avec `oauth_invalid_state` :
il suffit de recommencer.

### 3.3 Démarrage local ⚠️

Ton `.env` local contient un `JWT_SECRET` à motif d'exemple : **`uvicorn server:app` refusera
désormais de démarrer**. Deux solutions, au choix :
- ajouter `APP_ENV=development` dans `backend/.env`. Un secret éphémère est alors généré, et
  tu devras te reconnecter après chaque redémarrage du backend ;
- **ou** remplacer `JWT_SECRET` et `SECRET_KEY` locaux par deux valeurs générées avec
  `python -c "import secrets; print(secrets.token_urlsafe(64))"`.

Je n'ai pas modifié ton `.env`.

### 3.4 Déploiements Vercel Preview

Sans `APP_ENV`, une Preview suit les règles de production. **Elle exige donc des secrets
conformes**, à définir pour l'environnement Preview, sinon l'API refuse de démarrer.

---

## 4. Tests

| Suite | Résultat |
|---|---|
| `tests/test_security_settings.py` seul (sans Mongo) | 32 passés, 1 ignoré (le test HTTP exige Mongo) |
| **Suite backend complète** (`bash tests/run_mongo_tests.sh`, MongoDB Docker jetable) | **248 passés** : les 215 existants, sans régression, et 33 nouveaux |

**Ce que couvrent les 33 tests** :
- **Valeurs refusées** : secret absent ou vide, trop court, peu diversifié, ancien défaut du
  code (JWT et session), gabarit français, `change-me`, **valeurs réellement publiées dans
  `.env.example`** (lues dans l'historique git, sans être recopiées dans le test). Le
  `.env.example` actuel ne contient aucun secret utilisable.
- **Production** : refus pour 6 variantes d'`APP_ENV` (absent, vide, `production`,
  `preview`, `PRODUCTION`, `staging`) ; refus de secrets identiques ; acceptation de secrets
  forts et distincts ; **message d'erreur sans le secret**.
- **Développement et test** : secret éphémère généré, différent à chaque appel, avec
  avertissement ; secret fort conservé ; la session de test signe avec un secret conforme.
- **JWT forgés refusés** : ancien défaut du code, **valeur publiée**, mauvaise signature,
  jeton expiré, `alg=none`, HS512. Un jeton correctement signé reste accepté.
- **Bout en bout HTTP** : un JWT forgé (ancien défaut, valeur publiée) pour un **compte
  existant** renvoie `401 Could not validate credentials` ; une vraie session renvoie 200.

---

## 5. Plan de rotation (chaque étape demande ton autorisation explicite)

**Principe clé : changer les secrets AVANT de déployer le code durci.** La rotation seule
ferme la faille. Le code durci empêche ensuite qu'elle revienne. Déployer le code avec les
anciens secrets bloquerait toute l'API, puisque le démarrage serait refusé.

### Phase A — Rotation (urgente, sans déploiement de code)

1. **Générer localement** deux valeurs **par environnement**, sans jamais les coller dans un
   chat, un ticket ou un commit :
   `python -c "import secrets; print(secrets.token_urlsafe(64))"`
   - Production : `JWT_SECRET` et `SECRET_KEY`, différents.
   - Preview : deux **autres** valeurs.
   - Development : deux autres valeurs, ou suppression si tu n'utilises pas `vercel dev`.
2. Vercel → *Settings → Environment Variables* : remplacer `JWT_SECRET` et `SECRET_KEY` pour
   chaque environnement. Les marquer **Sensitive** si l'option existe. **Ne pas toucher
   `ENCRYPTION_KEY`** : sa rotation rendrait illisibles les clés IA chiffrées des
   utilisateurs, ce qui exigerait une migration à part.
3. **Redéployer** le déploiement Production actuel (*Deployments → Current → Redeploy*). Les
   variables ne s'appliquent qu'aux nouveaux déploiements.
4. Faire la **validation §6** immédiatement.
5. **Prévenir** les utilisateurs actifs qu'une reconnexion est nécessaire, et que
   l'extension doit être reconnectée.

### Phase B — Déploiement du code durci (après autorisation de commit, push et déploiement)

1. Commit de la correction (§2), avec son message.
2. Push, puis déploiement Preview. Vérifier que l'API démarre avec les nouveaux secrets
   Preview (`GET /api/health` sur l'URL Preview).
3. Promotion en Production, puis validation §6.
4. **Retour arrière** : Vercel *Promote* du déploiement précédent (instantané). Ne **jamais**
   revenir à l'ancienne valeur de secret.

---

## 6. Validation après rotation

| # | Contrôle | Attendu |
|---|---|---|
| 1 | `GET /api/health` sur `jobtracker.maadec.com` et `job-tracker-steel-eight.vercel.app` | 200 · `healthy` · `connected` |
| 2 | **Ancienne session** : garder un onglet connecté **avant** la rotation, puis recharger après | Redirection vers `/login` (401) |
| 3 | Connexion e-mail et mot de passe | Le tableau de bord se charge ; Opportunités et Candidatures sont visibles |
| 4 | Connexion Google | Réussie (`state` signé avec la nouvelle `SECRET_KEY`) |
| 5 | Extension Chrome | « Session expirée », puis reconnexion par code, puis ajout d'une offre réussi |
| 6 | API agent (si un token existe) | Inchangée |
| 7 | Vercel → *Function Logs* | Aucune `InsecureSecretError` ni erreur de démarrage |
| 8 | *(Optionnel, autorisation explicite requise)* Une requête avec un JWT forgé à l'ancienne valeur, `sub` aléatoire inexistant | `401 Could not validate credentials` |

---

## 7. Investigation de l'exposition (recommandée, autorisation requise)

Le secret était probablement public depuis février 2026. **Aucune preuve d'exploitation n'a
été recherchée** : cela demande d'accéder à la base de production. Ce qu'une session forgée
pouvait laisser derrière elle, **et qui survit à la rotation** :

| Persistance possible | Vérification proposée (lecture seule en production) |
|---|---|
| Compte admin créé via `POST /api/admin/users` (avec mot de passe) | Lister les `users` de rôle `admin` : chacun est-il attendu ? |
| Utilisateur promu admin | Idem ; il n'existe pas de journal des changements de rôle |
| Comptes inconnus récents | `users` triés par `created_at` |
| Tokens agent créés au nom d'un utilisateur | Lister `agent_tokens` (propriétaire, nom, `created_at`), puis révoquer les inconnus |
| Usage abusif des clés IA de la plateforme | Consulter les tableaux de bord OpenAI, Google et Groq (anomalies depuis février) |

**Limites** :
- les journaux Vercel ont une rétention courte ;
- aucun journal d'audit applicatif n'existe ;
- une notification aux utilisateurs relève de ta décision (je ne fournis pas d'avis
  juridique).

---

## 8. Variables « Needs Attention »

Je ne vois pas le tableau de bord Vercel. **Communique-moi uniquement les NOMS** des variables
signalées. En attendant, voici les variables **lues par l'application** et leur sensibilité :

| Sensibilité | Variables | Recommandation |
|---|---|---|
| **Secrets critiques** | `JWT_SECRET`, `SECRET_KEY`, `ENCRYPTION_KEY`, `MONGO_URL` (contient des identifiants), `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `CLOUDINARY_API_SECRET`, `SMTP_PASSWORD_APP`, `VAPID_PRIVATE_KEY` | *Sensitive*, valeurs distinctes par environnement, jamais dans le dépôt. Rotation : JWT et SECRET_KEY **maintenant** ; les autres seulement en cas de doute de fuite, car aucune n'a été trouvée dans le dépôt ni dans le bundle |
| **Clés de fournisseurs (coût)** | `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `GROQ_API_KEY`, `EMERGENT_LLM_KEY`, `CLOUDINARY_API_KEY` | *Sensitive* ; surveiller l'usage (§7) ; supprimer celles qui ne servent plus (`EMERGENT_LLM_KEY` ?) |
| **Configuration** | `APP_ENV` (nouveau, facultatif en production), `DB_NAME`, `CORS_ORIGINS`, `BACKEND_URL`, `FRONTEND_URL`, `SMTP_*` (hors mot de passe), `SUPPORT_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_CLAIMS_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_ID`, `CLOUDINARY_CLOUD_NAME`, `AGENT_*`, `DEBUG` | `DEBUG` doit valoir `false` en production. `CORS_ORIGINS` : éviter `*` (voir la dette S3 connexe) |
| **Frontend (public par nature)** | `REACT_APP_BACKEND_URL` | Ne jamais y mettre de secret : tout `REACT_APP_*` finit dans le JS public |

---

## 8 bis. Suivi : phase A réalisée (8 octobre 2026)

**Fait par le propriétaire** : `JWT_SECRET` remplacé dans Vercel, redéploiement Production
« Ready ». Tableau de bord, statistiques, candidatures et Opportunités sont accessibles.
**Constaté de mon côté** (lecture seule) : `GET /api/health` renvoie 200 et `healthy` sur les
deux domaines.

**Contrôles restants** (aucune manipulation de secret) :

| # | Contrôle | Pourquoi |
|---|---|---|
| A1 | **`SECRET_KEY` a-t-il été remplacé aussi ?** | **Bloquant pour la phase B** : un `SECRET_KEY` resté au gabarit fait refuser le démarrage du code durci. Vérifié par simulation |
| A2 | Environnements traités : Production ? Preview ? Development ? | Une Preview avec d'anciens secrets refusera de démarrer en phase B |
| A3 | Nouveaux secrets générés aléatoirement (`token_urlsafe(64)` ou équivalent), sans mot lisible, et `JWT_SECRET` ≠ `SECRET_KEY` | Sinon le démarrage est refusé |
| A4 | **Rejet des anciennes sessions** : extension Chrome connectée avant la rotation → n'importe quelle action | Attendu : « Session expirée. Veuillez vous reconnecter. » |
| A5 | **Ta session navigateur** : l'as-tu ouverte **après** la rotation ? Vérification dans la console du navigateur (ne copier le jeton nulle part) : `const p=JSON.parse(atob(localStorage.getItem('token').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); new Date((p.exp-7*24*3600)*1000)` | Affiche l'heure d'émission. Une heure **antérieure** au redéploiement avec un tableau de bord qui fonctionne voudrait dire que **la rotation n'a pas pris effet** |
| A6 | Connexion Google | Valide le `state` signé par `SECRET_KEY` |
| A7 | Vercel → *Function Logs* du déploiement courant : aucune erreur | — |
| A8 | `APP_ENV` absent sur Vercel, ou égal à `production` | Désormais neutralisé par `VERCEL_ENV` (voir ci-dessous), mais à garder propre |

## 8 ter. Phase B prête (non commitée)

**Ajouts depuis le §2** :
- **Garde `VERCEL_ENV`** : sur Vercel Production et Preview, les règles de production
  s'appliquent **toujours**, même si `APP_ENV` est réglé par erreur sur `development`. Cela
  évite que des secrets temporaires soient générés à chaque démarrage de fonction, ce qui
  déconnecterait les utilisateurs au hasard.
- **Script de pré-vol** `backend/scripts/check_signing_secrets.py` : il vérifie un fichier
  d'environnement (par exemple issu de `vercel env pull`) et n'affiche **que des verdicts**.
  Optionnel, à lancer par toi.

**Tests** : 45 tests de sécurité. Suite backend complète : **260 passés** (215 existants et 45).

**Simulation de démarrage Vercel** (`VERCEL_ENV=production`, sans `.env`) :

| Configuration | Résultat |
|---|---|
| `JWT_SECRET` neuf et `SECRET_KEY` neuf | Démarrage OK |
| `JWT_SECRET` neuf et `SECRET_KEY` resté au gabarit | **Démarrage refusé** (`SECRET_KEY` trop court ou prévisible) |
| `APP_ENV=development` par erreur et `SECRET_KEY` absent | **Démarrage refusé** (règles de production imposées) |

**Fichiers proposés pour le commit de la phase B** :
- `backend/config.py`
- `backend/.env.example`
- `backend/scripts/check_signing_secrets.py`
- `backend/tests/conftest.py`
- `backend/tests/run_mongo_tests.sh`
- `backend/tests/test_security_settings.py`
- `Doc/DETTE-SECURITE.md`
- `Doc/S3-CORRECTION-ET-ROTATION.md`

Les documents du Lot 2 sont **hors de ce commit**.

**Interruption de service ?** Il n'y en aura pas, **si et seulement si** A1 à A3 sont validés
pour l'environnement déployé. Dans le cas contraire, le comportement est sûr mais bloquant :
l'API répond 500, et le problème est visible dès `GET /api/health`. D'où cette séquence :
1. déploiement **Preview** ;
2. `GET /api/health` sur l'URL Preview ;
3. promotion en Production, puis contrôles §6 ;
4. retour arrière instantané (*Promote* du déploiement précédent) en cas de problème.

## 9. Décisions attendues

1. **Phase A** : autoriser la rotation de `JWT_SECRET` et `SECRET_KEY` (Production, Preview,
   Development) et le redéploiement. **Tu feras la manipulation dans Vercel.**
2. **Phase B** : autoriser le commit, le push et le déploiement du code durci, **après** la
   phase A.
3. **Investigation §7** : autoriser des requêtes en lecture seule sur la base de production
   (admins, comptes récents, tokens agent).
4. **Contrôle optionnel n°8** (§6) : autoriser une seule requête avec un JWT forgé à
   l'ancienne valeur.
5. Me transmettre les **noms** des variables « Needs Attention ».
