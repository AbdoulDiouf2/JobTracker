# JobTracker — Lot 2 : audit de faisabilité de la veille ChatGPT

> **Nature** : audit et documentation uniquement. Aucun code, aucune dépendance, aucune configuration,
> aucun commit, aucun déploiement, aucun token créé.
> **Date de l'audit** : 8 octobre 2026.
> **Référence** : [Lot 2 - Integration de la veille ChatGTP.md](./Lot%202%20-%20Integration%20de%20la%20veille%20ChatGTP.md)

---

## 1. Résumé exécutif

- **La documentation OpenAI ne permet pas de confirmer qu'une tâche programmée ChatGPT peut
  écrire dans JobTracker via un connecteur personnalisé sans intervention humaine.** Le Lot 2
  ne doit donc pas reposer uniquement sur ce scénario (option A).
  - Les tâches programmées peuvent utiliser des apps et des plugins (Gmail, Slack et GitHub
    sont cités).
  - Mais pour les connecteurs MCP personnalisés, deux règles bloquent l'exécution sans
    supervision :
    - les actions d'écriture **peuvent demander une confirmation** ;
    - l'authentification passe obligatoirement par **OAuth 2.1**.
- **Les tokens `jt_agent_` du Lot 1 ne peuvent pas être utilisés par ChatGPT.** ChatGPT
  n'envoie pas de clé API statique (documentation officielle). Un connecteur ChatGPT exige
  donc un serveur d'autorisation OAuth, qui n'existe pas aujourd'hui.
- **La veille autonome côté serveur (option C) est faisable, maîtrisée et peu coûteuse.**
  - Elle réutilise directement le Lot 1 : `opportunity_service`, le dédoublonnage et le quota.
  - Elle s'appuie sur des sources légales : l'API officielle France Travail, Adzuna pour la France.
  - Elle peut ajouter une qualification par LLM via l'API OpenAI.
  - **Limite** : la couverture de la Suisse, de la Belgique et du Luxembourg n'est pas assurée
    par une API officielle identifiée.
- **Recommandation : architecture hybride (D), livrée par phases.**
  1. Commencer par la veille serveur (C).
  2. Ajouter plus tard, si besoin, un MCP en lecture et gestion depuis ChatGPT, avec OAuth.
  3. En parallèle, faire un **test manuel** de l'option A sur ton compte ChatGPT réel, car la
     documentation reste ambiguë.
- **Deux points bloquants avant toute intégration** :
  1. **Le Lot 1 est déjà en production** : Vercel a déployé `1286fba` puis `7a5415e`, avec succès.
  2. **La dette S3 (`JWT_SECRET` avec une valeur par défaut) doit être vérifiée en production
     avant de délivrer un token agent.** Je n'ai pas d'accès Vercel pour la contrôler.

---

## 2. Objectif métier du Lot 2

Supprimer la recopie manuelle des offres. Le parcours visé :

1. Une veille automatisée cherche des offres.
2. Elle filtre celles qui correspondent aux critères.
3. Elle les transmet à JobTracker, qui crée des `Opportunity:new`.
4. Les doublons sont ignorés.
5. L'utilisateur consulte, ignore ou convertit les offres (`to_apply`), et **garde la main
   sur l'envoi réel de ses candidatures**.

**Critères actuels**, à rendre configurables :
- **pays** : France, Suisse, Belgique, Luxembourg ;
- **contrat** : CDI ou équivalent permanent ;
- **niveau** : junior, débutant, jeune diplômé ;
- **domaines** : Data Engineering, Data Science, Big Data, IA, ML et métiers Data associés.

**Hors périmètre** : l'envoi automatique de candidatures.

---

## 3. État technique réel du Lot 1

### 3.1 Déploiement (vérifié via l'API publique GitHub, en lecture seule)

| Commit | Environnement | Statut Vercel | Date (UTC) |
|---|---|---|---|
| `7a5415e` | Production | success · « Deployment has completed » | 2026-10-07 23:14 |
| `1286fba` | Production | success | 2026-10-07 22:51 |

- **Le Lot 1 est donc en production.** Les index MongoDB (`opportunities`, `agent_tokens`,
  `agent_token_usage`) sont créés lors du premier appel des services concernés, car le
  `lifespan` ne s'exécute pas sur Vercel.
- **Hors de portée** : je n'ai ni CLI Vercel, ni `gh`, ni accès au tableau de bord. Je n'ai donc
  pu vérifier ni les variables d'environnement, ni les journaux d'exécution, ni la base utilisée.

**Procédure de vérification** (à faire par toi, sans rien modifier) :
1. Vercel → projet JobTracker → *Deployments* : confirmer que `7a5415e` est le déploiement
   « Current » de Production, et lire ses *Function Logs*.
2. *Settings → Environment Variables* (Production) : vérifier que `JWT_SECRET`, `SECRET_KEY`,
   `ENCRYPTION_KEY` et `MONGO_URL` **existent**. Ne pas afficher leur valeur ; seulement
   vérifier que `JWT_SECRET` n'est pas la valeur d'exemple.
3. *Settings → General* : noter le plan Vercel (Hobby ou Pro). Il conditionne les crons (§8).

### 3.2 Éléments réutilisables pour le Lot 2

| Élément | Fichier | Réutilisation |
|---|---|---|
| Ingestion idempotente | `services/opportunity_service.py` → `ingest_opportunity`, `find_existing_opportunity` | Point d'entrée **unique** pour toute veille ; aucun second stockage |
| Dédoublonnage | URL normalisée + `external_id` prioritaire | Une veille doit envoyer un `external_id` stable (identifiant de l'offre chez la source) |
| API agent | `POST /api/agent/opportunities` + `utils/agent_auth.py` | Pour un émetteur **externe** (GitHub Actions, script, autre service) |
| Quota par token | `services/agent_token_service.py` | Protection contre une veille qui s'emballe |
| Détection de plateforme | `utils/job_urls.py` → `detect_platform` | Remplit `moyen` à la conversion |
| Appel des LLM | `routes/ai.py` (OpenAI, Gemini, Groq ; clés chiffrées) | Possible base pour la qualification, mais aujourd'hui couplé aux routes HTTP |

### 3.3 Manques identifiés

- **Aucun modèle de « profil de veille »** (critères configurables, fréquence, sources).
- **Aucune trace des exécutions** : historique des runs, nombre d'offres trouvées, créées ou en
  doublon, erreurs.
- **Aucun connecteur de source d'offres.**
- **Aucun planificateur actif en production.** APScheduler démarre dans le `lifespan`
  ([server.py](../backend/server.py)), qui ne s'exécute pas sur Vercel. Les rappels
  automatiques existants ne tournent probablement que via le déclenchement manuel
  `POST /api/reminders/trigger-now`. *Constat à confirmer dans les logs Vercel.*
- **Pas de scope `opportunities:read`**, ni de serveur OAuth (nécessaire à l'option B).
- **Configuration `vercel.json` ancienne** (`builds` + `rewrites`). Aucun `crons` ni
  `maxDuration` n'est déclaré.

---

## 4. Capacités ChatGPT officiellement vérifiées

**Méthode et limites.** Pages consultées le **8 octobre 2026**.
- **`help.openai.com` refuse toute lecture automatisée** (HTTP 403, y compris via `curl`).
  Pour ces pages, je me fonde sur les **extraits indexés par le moteur de recherche**, marqués
  « extrait » ci-dessous.
- **`developers.openai.com` a été lu directement.**
- Les blogs et sites tiers sont signalés comme tels et **ne fondent aucune conclusion**.

### 4.1 Officiellement supporté

| Capacité | Preuve |
|---|---|
| Tâches programmées ponctuelles ou récurrentes ; sur les plans payants, récurrence jusqu'à 1 fois par heure et heure exacte | [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) (extrait) |
| Nombre de tâches actives : 3 (Free, Go), 5 (Plus), 10 (Business, Edu), 15 (Pro, Enterprise) | idem (extrait) |
| « Scheduled tasks can use supported apps, including Gmail, Slack, and GitHub » | idem (extrait) |
| Les tâches programmées créées avec **ChatGPT Work** (web) ou Work/Codex (desktop) **peuvent utiliser des plugins**. Les plugins regroupent skills, apps et modèles ; le Plugin Directory remplace l'App Directory | [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex), [Release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) (extraits) |
| Tâches déclenchées par des événements (webhooks) Gmail, Slack et GitHub, dans Work, jusqu'à 30 par heure et 720 par jour | [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) (extrait) |
| Les **MCP Events** (MCP 2.0) permettent à ChatGPT de s'abonner aux événements d'un serveur MCP (`events/list`, `events/subscribe`, rappel signé) | [MCP Events](https://developers.openai.com/plugins/build/mcp-events) (lu via le moteur) |
| Connecteurs MCP personnalisés via le **mode développeur**, en bêta | [Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) (extrait) |
| Transport MCP : **streamable HTTP** pour les plugins ChatGPT ; streamable HTTP ou HTTP/SSE pour l'API Responses | [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server), [MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) (lus) |
| Authentification d'un MCP dans ChatGPT : **OAuth 2.1** (code d'autorisation + PKCE, CIMD recommandé), ou absence d'authentification | [Authentication](https://developers.openai.com/plugins/build/auth) (lu) |
| Les annotations `readOnlyHint` et `destructiveHint` orientent le comportement de confirmation de ChatGPT | [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server) (lu) |
| L'API Responses peut appeler un MCP distant avec `require_approval: "never"`, donc sans confirmation, et un en-tête `authorization` non stocké | [MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) (lu) |

### 4.2 Officiellement non supporté

| Restriction | Preuve |
|---|---|
| ChatGPT **ne présente pas de clé API personnalisée** et ne prend pas en charge `client_credentials`, les comptes de service ni les assertions JWT bearer | [Authentication](https://developers.openai.com/plugins/build/auth) (lu) : *« ChatGPT does not support machine-to-machine OAuth grants such as client credentials, service accounts, or JWT bearer assertions, nor can it present custom API keys »* |
| Toute donnée propre au client ou toute action d'écriture doit être authentifiée | idem : *« anything that exposes customer-specific data or write actions should authenticate users »* |
| Les tâches programmées ne prennent pas en charge les conversations vocales ni les **GPTs** | [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) (extrait). Les GPT Actions sont donc exclues de la veille programmée |

### 4.3 Non documenté ou non confirmé

| Question | État |
|---|---|
| Une **tâche programmée** peut-elle utiliser un **connecteur MCP personnalisé** (mode développeur) ? | **Non confirmé.** Seules les « supported apps » (Gmail, Slack, GitHub) et les « plugins » sont cités. Rien ne dit qu'un MCP privé ajouté en mode développeur est utilisable dans une tâche. Un site tiers évoque un message « connector or app is unavailable » dans les tâches, sans valeur officielle |
| Une écriture peut-elle s'exécuter **sans confirmation** pendant une exécution programmée, sans l'utilisateur ? | **Non documenté.** Côté ChatGPT, les écritures *« may ask for confirmation »* (extrait) et la documentation développeur mentionne une confirmation manuelle. Les admins Enterprise peuvent « préautoriser » certaines actions (source tierce, non confirmée officiellement) |
| Écritures possibles sur les plans **Plus et Pro** (individuels) ? | **Ambigu.** Des extraits indiquent que les connecteurs complets, en écriture, sont réservés à Business, Enterprise et Edu, et que Plus et Pro sont limités à la lecture. Cela reste à confirmer sur ton plan |
| Un plugin **privé, non publié**, peut-il être utilisé dans une tâche Work ? | **Non documenté.** La documentation mentionne *Secure MCP Tunnel* pour les MCP privés, sans lien avec les tâches |
| Fiabilité et garanties d'exécution des tâches récurrentes | **Non documentée** : aucun SLA trouvé |

### 4.4 Sources tierces consultées (contexte seulement, sans valeur de preuve)

[usecarly.com — scheduled tasks](https://www.usecarly.com/blog/chatgpt-scheduled-tasks/) ·
[usecarly.com — connector unavailable](https://www.usecarly.com/blog/chatgpt-scheduled-task-connector-unavailable/) ·
[Auth0 — MCP dans ChatGPT](https://auth0.com/blog/add-remote-mcp-server-chatgpt/) ·
[OpenAI Community — connecteurs dans les projets](https://community.openai.com/t/apps-custom-connectors-not-working-inside-projects/1369786)

---

## 5. Comparaison des quatre architectures

| Critère | A. Tâche ChatGPT → connecteur | B. MCP JobTracker | C. Veille serveur | D. Hybride (C + B) |
|---|---|---|---|---|
| Exécution sans intervention humaine | **Non confirmée** (§4.3) | Non : B sert à l'interactif | **Oui**, maîtrisée | Oui (via C) |
| Qualité de recherche | Élevée (recherche web de ChatGPT) | Sans objet | Selon les sources : API officielles et LLM | Celle de C, plus ChatGPT en interactif |
| Authentification | OAuth 2.1 obligatoire (à construire) | OAuth 2.1 obligatoire (à construire) | Simple : interne, ou token `jt_agent_` en secret serveur | Simple pour C ; OAuth pour B |
| Réutilisation du Lot 1 | API agent inutilisable telle quelle (OAuth) | Service via le MCP | **Totale** (`opportunity_service`, quota) | Totale |
| Dépendance au plan ChatGPT | Forte (écriture limitée à Business ?) | Forte | **Aucune** | Faible (pour B seulement) |
| Infrastructure nouvelle | Serveur MCP + serveur OAuth | Serveur MCP + serveur OAuth | Cron + connecteurs de sources | C, puis B |
| Couverture FR / CH / BE / LU | Large (web) | — | FR solide ; CH, BE, LU incertains | Idem C |
| Risque d'évolution du produit OpenAI | Élevé (fonctions en bêta, renommées en 2026) | Moyen | Faible (API stables) | Faible au départ |
| Complexité | Élevée et incertaine | Élevée | **Moyenne** | Moyenne, puis élevée (phase 2) |

**Lecture du tableau.**
- **A** est la cible idéale sur le papier, mais elle repose sur trois incertitudes non levées :
  le connecteur personnalisé dans une tâche, l'écriture sans confirmation, et le plan requis.
- **B** n'apporte pas l'automatisation à elle seule. Elle sert à consulter et gérer les
  opportunités depuis ChatGPT.
- **C** répond au besoin d'automatisation de façon fiable, mais elle perd la « recherche web
  libre » de ChatGPT. On peut la reproduire en partie avec l'outil `web_search` de l'API
  OpenAI (§9).

---

## 6. Faisabilité de l'exécution automatique sans intervention humaine

| Option | Verdict | Justification |
|---|---|---|
| A | **Non démontrée** : à tester sur ton compte réel avant tout développement | Tâches programmées et plugins existent, mais rien n'établit qu'un MCP privé y est disponible ni qu'une écriture y passe sans confirmation |
| B | **Non applicable** à l'automatisation | Usage conversationnel |
| C | **Faisable** | Un planificateur (Vercel Cron ou GitHub Actions) déclenche un traitement qui appelle `opportunity_service` ou l'API agent. Aucune interface humaine dans la boucle |
| D | **Faisable** (via C) | — |

**Test proposé pour A**, à faire par toi, sans développement. Il faut d'abord un MCP minimal
(lecture seule, sans authentification) **ou** n'importe quel MCP public de test.
1. Activer le mode développeur sur ton compte ChatGPT.
2. Ajouter un connecteur MCP personnalisé.
3. Créer une tâche programmée qui l'appelle.
4. Observer : est-il proposé dans la tâche ? s'exécute-t-il pendant ton absence ? une
   confirmation est-elle demandée ?

Il suffit de **noter ton plan ChatGPT et le résultat**. Ce test lève l'incertitude principale
sans écrire une ligne de JobTracker.

---

## 7. Authentification et secrets

### 7.1 Réutilisation des AgentTokens

| Scénario | `jt_agent_` utilisable ? | Remarque |
|---|---|---|
| ChatGPT (connecteur ou plugin) → JobTracker | **Non** | ChatGPT ne présente pas de clé API (§4.2). Il faudrait un serveur OAuth 2.1 (code + PKCE, CIMD) lié aux comptes JobTracker |
| API Responses (OpenAI) → MCP JobTracker | Oui techniquement (en-tête `authorization`) | Mais dans ce cas c'est **notre serveur** qui appelle OpenAI : autant appeler `opportunity_service` directement (option C) |
| GitHub Actions ou script externe → API agent | **Oui** | Le token est stocké comme secret du dépôt ou de l'environnement, puis envoyé dans `Authorization: Bearer` |
| Cron Vercel → traitement interne au backend | Pas nécessaire | Appel direct du service. L'endpoint du cron est protégé par `CRON_SECRET` (en-tête envoyé par Vercel) et l'utilisateur cible est fixé côté serveur |

### 7.2 Où vivrait le secret

| Architecture | Secret | Stockage | Révocation |
|---|---|---|---|
| C (cron Vercel, en interne) | `CRON_SECRET` ; clés des sources (France Travail, Adzuna) ; clé OpenAI | Variables d'environnement Vercel (Production) | Rotation de la variable, puis redéploiement |
| C (émetteur externe) | `jt_agent_…` | Secret GitHub Actions ou gestionnaire de secrets | Paramètres → API / Agents (Lot 1), effet immédiat |
| B (MCP + OAuth) | Jetons OAuth émis par JobTracker | Base (hashés), courte durée et rafraîchissement | Révocation du consentement OAuth |

**Règles inchangées depuis le Lot 1** :
- aucun secret dans le frontend ni dans les journaux ;
- token brut affiché une seule fois ;
- hash SHA-256 en base.

### 7.3 Pré-requis bloquant : dette S3

- **Dans le code** ([config.py](../backend/config.py), l.20) :
  `JWT_SECRET = os.environ.get('JWT_SECRET', 'super-secret-key-change-in-production')`.
  Même chose pour `SECRET_KEY`.
- **En production** : **non vérifiable** sans accès Vercel. `.env.example` déclare bien la
  variable `JWT_SECRET`.
- **Impact si la valeur par défaut est active en production.** N'importe qui peut forger un
  JWT pour n'importe quel `user_id`, donc :
  - lire et modifier les données de tous les comptes ;
  - **créer des tokens agent au nom de n'importe quel utilisateur**.

  L'isolation entre utilisateurs du Lot 1 perdrait tout son sens.
- **Correction minimale proposée** (non appliquée) :
  1. Au démarrage, refuser de lancer l'application si `JWT_SECRET` ou `SECRET_KEY` est
     absent ou égal à sa valeur par défaut, hors `DEBUG`.
  2. Si la valeur par défaut a été utilisée en production : définir un secret fort, ce qui
     **invalide toutes les sessions** (reconnexion nécessaire), et révoquer les tokens agent
     créés entre-temps.

---

## 8. Hébergement et contraintes Vercel

**Faits vérifiés** (documentation Vercel, consultée le 8 octobre 2026) :

| Contrainte | Hobby | Pro |
|---|---|---|
| Fréquence minimale d'un cron | **1 fois par jour** (précision ±59 min) | 1 fois par minute |
| Nombre de crons par projet | 100 | 100 |
| Durée maximale d'une fonction | 300 s | 300 s par défaut, jusqu'à 800 s (1800 s en bêta) |

Sources : [Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[Functions limits](https://vercel.com/docs/functions/limitations),
[Hobby plan](https://vercel.com/docs/plans/hobby).

**Conséquences pour JobTracker** :
- **Pas de processus permanent** : APScheduler n'est pas utilisable. La planification passe
  par Vercel Cron ou un déclencheur externe (GitHub Actions `schedule`).
- **Une exécution de veille doit tenir en moins de 300 s.** Il faut donc découper le travail
  (par pays ou par page), limiter le nombre d'appels LLM, et ingérer au fil de l'eau (chaque
  appel est idempotent).
- **`vercel.json` utilise l'ancien format `builds`.** Ajouter `crons` est documenté, mais la
  compatibilité avec cet ancien format est à vérifier pendant l'implémentation, avec un
  déploiement de prévisualisation.
- **Plan Hobby** : 1 exécution par jour, ce qui suffit pour une veille d'emploi.
- **Option B** : un serveur MCP en streamable HTTP peut tourner en fonction Python sur Vercel
  s'il est sans état. Mais un serveur OAuth complet et les MCP Events (rappels) alourdissent
  l'ensemble. Un service séparé serait plus sain si B est retenue.

---

## 9. Coûts et complexité

### 9.1 Montants vérifiés (sites officiels, 8 octobre 2026)

| Poste | Prix | Source |
|---|---|---|
| Outil `web_search` de l'API OpenAI | **10 $ / 1 000 appels**, plus les tokens de contenu au tarif du modèle | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| `gpt-5-nano` | 0,05 $ / M tokens en entrée · 0,40 $ / M en sortie | idem |
| `gpt-4o-mini` | 0,15 $ / M en entrée · 0,60 $ / M en sortie | idem |
| Appels d'outils MCP via l'API | Pas de frais par appel, seulement les tokens | [MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) |
| API France Travail « Offres d'emploi » | Gratuite (compte francetravail.io, OAuth2) | [data.gouv.fr — France Travail](https://www.data.gouv.fr/organizations/france-travail/dataservices) |
| Vercel Cron | Inclus dans les deux plans (100 crons par projet) | [Vercel cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) |

### 9.2 Estimations (non vérifiées, hypothèses explicites)

| Scénario | Hypothèses | Ordre de grandeur |
|---|---|---|
| C1 : API France Travail + Adzuna, qualification par `gpt-5-nano` | 1 run par jour, environ 200 offres analysées, environ 1 500 tokens par offre | **< 1 $ / mois** de LLM |
| C2 : variante avec `web_search` (proche de la veille ChatGPT) | 1 run par jour, environ 20 recherches, plus les tokens de contenu | **environ 6 à 15 $ / mois** |
| A ou B | Abonnement ChatGPT (plan à confirmer : l'écriture semble réservée à Business et au-delà) et serveur OAuth | Coût surtout en **développement** et en abonnement |

### 9.3 Complexité relative (estimation)

| Option | Complexité de développement | Maintenance |
|---|---|---|
| C | Moyenne : 2 connecteurs, qualification, cron, historique des runs | Faible à moyenne (évolution des API sources) |
| B | Élevée : serveur MCP, **serveur OAuth 2.1 complet**, nouveaux scopes | Moyenne à élevée (bêta OpenAI, spécification MCP mouvante) |
| A | Celle de B, plus une incertitude d'exécution | Élevée |

---

## 10. Risques et limites

1. **Évolution rapide des produits OpenAI.** Plusieurs fonctions sont en bêta ou ont été
   renommées en 2026 (Plugins, Work, Scheduled). Toute dépendance à ChatGPT est fragile.
2. **Couverture CH / BE / LU.**
   - Aucune API publique officielle identifiée pendant l'audit pour la Suisse (jobs.ch,
     job-room.ch : seulement des scrapers tiers d'API internes), la Belgique (Actiris, Forem,
     VDAB) ni le Luxembourg (ADEM). **À rechercher spécifiquement.**
   - Adzuna : la liste des pays n'est pas confirmée par sa documentation officielle. Une source
     tierce cite FR, mais ni BE, ni CH, ni LU.
3. **Conditions d'utilisation des sources.**
   - **LinkedIn** interdit le scraping et l'automatisation (User Agreement) : **à exclure**.
   - **Indeed** : API réservée à des partenaires agréés, sans recherche en libre-service :
     **à exclure**.
   - **Welcome to the Jungle** : aucune API publique connue.
4. **Qualité du filtrage.** Une IA peut se tromper sur le niveau (« junior ») ou sur le contrat.
   L'utilisateur garde la décision finale (`new` → ignorer ou convertir) : risque acceptable.
5. **Volume.** Une veille trop large pourrait remplir l'inbox. Le quota du Lot 1 limite les
   dégâts, mais il faut un seuil de pertinence et une limite par exécution.
6. **Exécution serverless.** 300 s par exécution et aucun processus permanent : il faut
   découper et rendre chaque exécution reprenable.
7. **Dette S1 à S3** (§7.3) : S3 est bloquante.
8. **Planificateur existant inactif en production** (§3.3) : effet de bord à confirmer, hors
   Lot 2.

---

## 11. Pré-requis de sécurité (avant toute intégration externe)

1. **S3** : vérifier `JWT_SECRET` et `SECRET_KEY` en production. Puis appliquer la correction
   minimale (démarrage refusé si secret par défaut) et faire une rotation si nécessaire.
2. **Ne créer aucun token agent de production** tant que le point 1 n'est pas réglé.
3. **Secrets de la veille** : clés des sources, clé OpenAI et `CRON_SECRET`, uniquement dans
   les variables d'environnement Vercel (Production). Jamais dans le dépôt ni les logs.
4. **Endpoint de cron** : exiger `Authorization: Bearer <CRON_SECRET>`. Il ne prend aucun
   `user_id` en paramètre ; la configuration se fait côté serveur.
5. **S1 (contournement du quota IA par `Origin`)** : à corriger si la qualification réutilise
   les clés IA de la plateforme.
6. **Option B uniquement** : serveur OAuth 2.1 conforme à la spécification MCP (PKCE, CIMD,
   validation de l'émetteur, de l'audience et des scopes à chaque appel), et nouveau scope
   `opportunities:read` refusé par défaut.

---

## 12. Architecture recommandée

**Option D, livrée par phases, en commençant par C.**

```
Vercel Cron (1×/jour, Hobby) ──Bearer CRON_SECRET──▶ /api/internal/watch/run
                                                         │
                     ┌───────────────────────────────────┤
          Profil de veille (critères configurables)      │
                     │                                    ▼
          Connecteurs : France Travail API · Adzuna (FR) · [CH/BE/LU à trouver]
                     │
                     ▼
          Qualification LLM (gpt-5-nano) : niveau, contrat, domaine, score
                     │
                     ▼
          opportunity_service.ingest_opportunity  (Lot 1 : dédoublonnage, external_id)
                     │
                     ▼
          Opportunity:new  ──▶  interface Opportunités (Lot 1)

Phase ultérieure (optionnelle) : MCP JobTracker + OAuth 2.1 (lecture et gestion depuis ChatGPT)
```

**Justification** :
- **Seule option dont l'exécution automatique est démontrable** aujourd'hui, avec les preuves
  documentaires disponibles.
- **Réutilise intégralement le Lot 1** : un seul stockage, un seul dédoublonnage, le même
  quota. Pas de seconde chaîne d'ingestion.
- **Indépendante du plan ChatGPT** et des fonctions OpenAI en bêta.
- **Coût faible et vérifiable** (§9), infrastructure proportionnée (cron + fonction existante).
- **Laisse la porte ouverte** :
  - si le test manuel de l'option A réussit, une tâche ChatGPT pourra devenir une **source de
    plus** ;
  - le MCP (B) pourra arriver ensuite pour l'usage conversationnel.

**Variante sans cron Vercel** : GitHub Actions `schedule` appelle l'API agent avec un token
`jt_agent_` stocké en secret. Elle réutilise l'API agent telle quelle, mais ajoute une
dépendance et un secret de plus.

---

## 13. Décisions qui te reviennent

1. **Architecture** : valides-tu D en commençant par C, ou veux-tu d'abord le résultat du test
   manuel de l'option A (§6) ?
2. **Plans** :
   - quel est ton plan ChatGPT (Plus, Pro, Business) ?
   - quel est ton plan Vercel (Hobby, Pro) ?
3. **Sécurité S3** : confirmer la valeur de `JWT_SECRET` en production, et autoriser la
   correction minimale en **étape 0** du Lot 2.
4. **Sources** :
   - accepter France Travail (API officielle) et Adzuna (France) comme premières sources ?
   - consacrer une recherche dédiée aux sources CH, BE et LU, ou les reporter à plus tard ?
5. **IA** :
   - accepter un coût LLM côté serveur, et lequel : `gpt-5-nano` (sources structurées) ou
     `web_search` (veille plus large et plus coûteuse) ?
   - avec quelle clé : clé plateforme ou clé personnelle ?
6. **Portée utilisateur** : veille **pour ton compte seulement** (MVP) ou **pour tous les
   utilisateurs** (profil par utilisateur, quotas, coûts) ?
7. **Fréquence et volume** : 1 exécution par jour ? Nombre maximum d'offres créées par
   exécution ? Seuil de pertinence ?
8. **Critères** : simple configuration côté serveur pour le MVP, ou interface « Profil de
   veille » dès le Lot 2 ?
9. **MCP (B)** : à inclure dans le Lot 2 ou à reporter au Lot 3 ?

---

## 14. Découpage proposé du Lot 2 (si D/C est retenue)

| Étape | Contenu | Arrêt pour validation |
|---|---|---|
| 0 | **Sécurité** : vérification S3 en production, correction minimale (démarrage refusé si secret par défaut), plan de rotation | ✅ |
| 1 | **Domaine « profil de veille »** et **historique des exécutions** (modèles, collections, services), avec tests sur Mongo jetable | ✅ |
| 2 | **Connecteurs de sources** : France Travail puis Adzuna. Normalisation vers `OpportunityCreate`, `external_id` stable, tests avec réponses simulées | ✅ |
| 3 | **Qualification par LLM** : critères, score, seuil ; coûts plafonnés ; tests | ✅ |
| 4 | **Orchestration** : endpoint interne protégé par `CRON_SECRET`, découpage pour tenir sous 300 s, `crons` dans `vercel.json` validé sur un déploiement de prévisualisation, observabilité | ✅ |
| 5 | **Interface** : profil de veille (si retenu), historique des exécutions, source « Veille » dans les opportunités | ✅ |
| 6 | **Validation complète et non-régression** (Lots 1 et 2), documentation de clôture | ✅ avant commit |
| (7) | **Optionnel** : MCP en lecture et gestion + OAuth 2.1, ou intégration d'une tâche ChatGPT si le test A est concluant | décision ultérieure |

Le CDC d'implémentation définitif sera rédigé **après** tes arbitrages (§13).

---

### Annexe — Sources (consultées le 8 octobre 2026)

**OpenAI (officiel)**
- [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) — extrait (page 403)
- [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) — extrait (page 403)
- [ChatGPT Work and Codex](https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex) — extrait (page 403)
- [ChatGPT Release Notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) — extrait (page 403)
- [Plugins in ChatGPT](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt) — cité dans les résultats, non lu
- [Building MCP servers for plugins and API integrations](https://developers.openai.com/api/docs/mcp) — lu
- [Authentication (plugins)](https://developers.openai.com/plugins/build/auth) — lu
- [Build an MCP server (plugins)](https://developers.openai.com/plugins/build/mcp-server) — lu
- [MCP Events](https://developers.openai.com/plugins/build/mcp-events) — extrait
- [MCP and Connectors (API Responses)](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) — lu
- [API Pricing](https://developers.openai.com/api/docs/pricing) — lu

**Vercel (officiel)**
- [Cron jobs — usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [Functions limitations](https://vercel.com/docs/functions/limitations) · [Hobby plan](https://vercel.com/docs/plans/hobby) — extraits

**Sources d'offres**
- [France Travail — services de données (data.gouv.fr)](https://www.data.gouv.fr/organizations/france-travail/dataservices) — extrait
- [Adzuna API overview](https://developer.adzuna.com/overview) — lu (pays non listés)
- LinkedIn User Agreement (interdiction du scraping) et conditions Indeed : via des sources secondaires ([conductatlas.com](https://conductatlas.com/platform/linkedin/linkedin-user-agreement/provision/CA-P-002596/prohibition-on-scraping-and-automated-data-collection/)), **à confirmer sur les textes officiels**

**Déploiement**
- API publique GitHub (lecture) : `GET /repos/AbdoulDiouf2/JobTracker/commits/{sha}/status` et `/deployments`
