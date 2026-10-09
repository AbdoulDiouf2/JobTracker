# JobTracker — Lot 2 V2 · Étape 3 : page de consentement OAuth — rapport synthétique

> **Date** : 9 octobre 2026 · **Statut** : développement **local** terminé, **à valider**.
> Aucun commit, push ni déploiement. Aucune tâche ChatGPT modifiée. Serveur Uvicorn non
> touché. Pas d'écran « Connexions ChatGPT » ni d'outil métier MCP.

## 1. Résultats

| Suite | Résultat |
|---|---|
| Backend, Windows 3.11 | **805 réussis, 1 xfail**, 0 échec |
| Backend, Linux 3.12 | **802 réussis, 2 ignorés, 1 xfail, 1 échec** → **échec dû à minuit UTC** (§5) ; fichier relancé : **61/61** |
| Frontend (`yarn test`) | **89 réussis**, 7 suites (42 existants + 47 nouveaux) |
| `yarn build` | **Compiled successfully**, aucun avertissement ESLint |

**Décompte backend** : 786 + 12 tests OAuth (ticket, demandes expirées, utilisées ou inconnues,
concurrence, en-têtes) + 8 tests d'en-têtes `vercel.json` = **806** sur chaque plateforme.

## 2. Ce qui a été fait

### Frontend — `pages/OAuthConsentPage.jsx` (route publique `/oauth/consent`)

| Exigence | Réalisation |
|---|---|
| 1. Authentification web existante | `useAuth` et le client `api` (JWT de la webapp) ; la session de l'extension est refusée par le backend |
| 2. Message clair | « ChatGPT demande l'autorisation d'accéder à ta veille d'opportunités JobTracker », compte concerné affiché |
| 3. Permissions | Lecture des critères de veille et de l'état ; création d'opportunités et compte-rendu ; plus la liste de ce que ChatGPT **ne pourra jamais faire** (candidatures, documents, suppression, candidature automatique) |
| 4. Deux actions | **Autoriser** (or, `#c4a052`) et **Refuser** ; désactivées pendant l'envoi |
| 5. Aucun secret côté frontend | Nouveau flux en deux temps : `POST /consent` renvoie un **ticket de continuation** (60 s, usage unique), et le navigateur suit `GET /api/oauth/continue`, qui crée le code et redirige vers ChatGPT. **Le code d'autorisation ne passe jamais par le JavaScript** ; aucun jeton ni `client_secret` n'existe côté frontend (testé) |
| 6. Paramètres OAuth préservés | `state`, `redirect_uri`, `scope`, `resource` et PKCE restent stockés côté serveur dans la demande ; la page ne transporte que l'identifiant de demande. Retour vers ChatGPT avec `code`, `state` et `iss` |
| 7. Anti-*clickjacking* | `vercel.json` : `X-Frame-Options: DENY`, `CSP frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` sur `/oauth…` (couvre aussi `/oauth/consent/`) ; mêmes en-têtes sur toutes les réponses `/api/oauth/*` ; route React **sensible à la casse** ; blocage JavaScript si la page est intégrée dans un cadre |
| 8. Cas | Déconnecté (connexion puis **retour automatique** sur la page) ; compte non autorisé (refus explicite renvoyé à ChatGPT) ; demande expirée (410), déjà utilisée (409), introuvable (404) ; refus ; consentement réussi ; erreur générique |
| 9. Responsive et cohérence | Carte `glass-card` sombre, typographies et icônes Lucide de JobTracker ; boutons empilés sur mobile, alignés sur grand écran ; micro-animations ; textes FR et EN |
| 10. Tests | 47 tests frontend, 20 tests backend nouveaux ou adaptés |

**Retour après connexion** : `lib/oauthReturn.js` ne mémorise qu'un chemin
`/oauth/consent?request=…` exact (liste blanche, 15 min, lu une seule fois), utilisé par la
connexion classique **et** par Google. Aucune redirection ouverte possible (8 cas refusés
testés).

### Backend

- `decide()` ne renvoie plus de code : il renvoie un ticket. Le nouveau `complete()` consomme
  le ticket de façon atomique, revérifie l'éligibilité du compte, crée le code et renvoie l'URL
  de retour.
- Les erreurs de demande sont distinguées : `request_expired`, `request_already_used` et
  `request_not_found`.
- Deux décisions simultanées : une seule l'emporte (testé).

## 3. Défauts trouvés et corrigés pendant le développement

1. **URL de continuation** : la première version ne vérifiait pas le **domaine** (une URL
   `https://evil.example/api/oauth/continue?ticket=…` aurait été suivie). Elle est désormais
   limitée à l'origine de la page ou du backend configuré (`REACT_APP_BACKEND_URL`), plus le
   chemin exact et le format du ticket.
2. **En-têtes** : la règle sur `/oauth/consent` seule laissait `/oauth/consent/` et
   `/OAUTH/consent` sans protection. La règle couvre maintenant `/oauth…`, et la route React
   est sensible à la casse.

## 4. Points documentés pour le futur test réel

Ajoutés au [protocole E0](./LOT2-V2-ETAPE-3-PROTOCOLE-E0.md), §5 bis :

- **Compatibilité du client confidentiel** : ChatGPT utilise-t-il les identifiants statiques ?
  Quelle méthode (`basic` ou `post`, les deux sont acceptées) ? Exige-t-il un client public
  (`none`) ? Quelle URI de redirection exacte ? Une conduite à tenir est prévue pour chaque cas.
- **Deux renouvellements quasi simultanés** : dans la fenêtre de 30 s, le second émet une
  nouvelle paire et **annule la première**. Si ChatGPT conservait la première, une reconnexion
  serait nécessaire. Le signal à observer et une option de repli (garder les deux paires) sont
  documentés, **sans changement aujourd'hui**.

## 5. Point d'attention hors périmètre

`test_agent_token_service.py::test_duplicate_does_not_consume_and_bypasses_exhausted_quota`
(Lot 1) dépend de la date UTC. Il a échoué parce que l'exécution a franchi **minuit UTC** (le
quota était compté le 8, puis lu le 9) ; relancé ensuite, il passe. C'est une fragilité
existante du test, pas du code. Correction proposée : figer l'heure dans ce test. **Non faite.**

## 6. Fichiers

| Fichier | Nature |
|---|---|
| `frontend/src/pages/OAuthConsentPage.jsx` | **Nouveau** |
| `frontend/src/lib/oauthReturn.js` | **Nouveau** |
| `frontend/src/App.js` | Route `/oauth/consent` (chargée à la demande, sensible à la casse) |
| `frontend/src/pages/LoginPage.jsx`, `AuthCallback.jsx` | Retour vers la demande en cours après connexion |
| `frontend/src/__tests__/OAuthConsentPage.test.jsx`, `oauthReturn.test.jsx` | **Nouveaux** : 47 tests |
| `backend/services/oauth_service.py`, `backend/routes/oauth.py` | Ticket de continuation, `/api/oauth/continue`, erreurs distinctes, en-têtes |
| `backend/tests/test_oauth.py`, `test_vercel_routing.py` | +20 tests |
| `vercel.json` | En-têtes de sécurité sur `/oauth…` |
| `Doc/LOT2-V2-ETAPE-3-PROTOCOLE-E0.md` | Flux avec ticket, §5 bis |
