# JobTracker — CDC Lot 2 V2 : Veille ChatGPT → MCP → Opportunités

**Version :** 2.0 — 8 octobre 2026  
**Statut :** cadrage fonctionnel validé ; faisabilité d'exécution programmée non démontrée ; **aucun développement autorisé** avant le gate 0.  
**Remplace :** `CDC-LOT2-JOBTRACKER.md` V1 (veille autonome côté serveur). Ne pas implémenter la V1.

## 1. Décision du porteur de projet — non négociable

**ChatGPT est le seul moteur de veille et de qualification.** Le propriétaire utilise son abonnement ChatGPT. JobTracker n'effectue **aucune** recherche autonome d'offres et n'appelle **aucune API OpenAI payante** pour collecter ou qualifier des annonces. Aucune intégration France Travail, Adzuna, scraper, moteur de recherche serveur, cron de collecte JobTracker ou pipeline LLM backend ne doit être développée dans ce lot.

Architecture cible, sous réserve de faisabilité vérifiée :

`Tâche planifiée ChatGPT (recherche + sélection) → plugin MCP JobTracker (écriture autorisée) → API/services Opportunités existants → MongoDB → interface JobTracker`

**Critère cardinal :** deux veilles quotidiennes peuvent s'exécuter et transmettre des offres **sans intervention humaine**. Si ce critère n'est pas démontré, le projet s'arrête au gate 0 et le commanditaire choisit explicitement entre (a) MCP interactif avec envoi manuel, (b) attente de prise en charge native, ou (c) nouveau cadrage. **Ne jamais substituer une veille serveur.**

## 2. Paramètres métier arrêtés

| Dimension | Exigence |
|---|---|
| Bénéficiaire | Compte propriétaire uniquement pour le MVP ; aucun accès aux autres comptes |
| Origine des offres | Exclusivement la recherche effectuée par ChatGPT |
| Pays | France, Suisse, Belgique, Luxembourg |
| Cadence | 2 fois par jour, horaires et fuseau à confirmer lors du paramétrage |
| Nombre | Au plus **20 nouvelles opportunités** par exécution (pas un objectif de remplissage) |
| Score | Au moins **75/100** selon une grille explicite, révisable |
| Postes | Data Engineering, Data Science, Big Data, IA/ML et domaines Data associés |
| Niveau | Junior, débutant, jeune diplômé |
| Contrat | CDI et équivalents permanents selon le pays |
| Préférences | Interface JobTracker permettant de modifier critères et seuil |
| Financement | Abonnement ChatGPT existant ; aucun budget API OpenAI additionnel prévu |
| MCP | Inclus dans le lot, avec authentification et opérations minimales |
| Candidatures | Aucune candidature envoyée automatiquement |

La recherche doit distinguer offres réelles, vérifiables et accessibles des résultats incertains. La couverture des quatre pays est un **objectif de recherche**, pas une garantie de volume ou d'exhaustivité.

## 3. État existant à préserver

Le Lot 1 fournit `opportunities`, le service métier et les routes utilisateur, `POST /api/agent/opportunities`, AgentTokens `jt_agent_`, déduplication URL et `(user_id, source, external_id)`, idempotence, isolation par utilisateur, statuts `new/ignored/converted` et conversion en candidature `to_apply`. Les commits signalés sont `1286fba` et `7a5415e`, poussés sur `origin/main`. 215 tests backend et 42 frontend ont été rapportés réussis.

L'audit précédent signale un risque **S3** : `JWT_SECRET` possède un défaut prévisible dans le code ; la valeur effectivement configurée en production est inconnue. Il faut la vérifier **sans divulguer sa valeur**. Toute correction ou rotation en production nécessite une autorisation séparée et un plan de gestion des sessions.

Le rapport précédent affirme que les déploiements Vercel ont réussi ; contrôler le déploiement Production auprès de Vercel plutôt que d'assimiler un statut GitHub à une preuve de disponibilité fonctionnelle.

## 4. Gate 0 — Faisabilité produit et sécurité : obligatoire AVANT le MCP

### 4.1 Recherche documentaire datée

Vérifier sur les **sources officielles actuelles** :

1. Création et utilisation d'un plugin MCP personnalisé sur **le compte et le plan du propriétaire**.
2. Exposition d'un outil MCP **d'écriture** et permissions effectives du compte.
3. Disponibilité de ce plugin **dans une tâche ChatGPT programmée**, et non seulement dans une conversation interactive.
4. Possibilité d'appeler l'outil d'écriture **sans confirmation pendant l'absence de l'utilisateur**.
5. Authentification supportée (OAuth 2.1, configuration de plugin, restrictions du client) et durée de validité des autorisations.
6. Comportement en cas de tâche suspendue, consentement requis, erreurs, quotas ou outil indisponible.

Distinguer : **documenté**, **testé sur le compte**, **non confirmé**, **non pris en charge**. Ne pas confondre « les tâches utilisent des plugins » et « les tâches invoquent automatiquement ce MCP personnalisé avec écriture ».

### 4.2 POC sans développement de production

**Séquence de preuves minimale :**

- **P0 — Accès :** constater dans le compte réel les menus/permissions d'ajout de MCP et d'autorisation d'écriture, sans exposer de secret.
- **P1 — Interaction :** si possible, utiliser un outil MCP de test **sans donnée personnelle**, écrivant dans un environnement jetable isolé, avec autorisation du propriétaire. Pas de token JobTracker de production.
- **P2 — Programmation :** créer, avec autorisation explicite, une tâche planifiée de test qui tente cette écriture, puis examiner la trace du résultat et les éventuelles confirmations. Ne pas inférer la réussite d'une simple création de tâche.
- **P3 — Sans présence :** démontrer une exécution effective sans intervention humaine et une écriture reçue une seule fois.

Si l'agent de développement ne peut pas accéder au compte ChatGPT, fournir **un protocole pas à pas** que le propriétaire exécutera, puis attendre ses résultats. Un POC local simulé ne remplace pas P2/P3. **Ne pas créer de tâche programmée réelle sans consentement.**

### 4.3 Audit S3 et prérequis de sécurité

Inspecter les chemins de configuration JWT, vérifier sans afficher le secret si la production utilise une valeur robuste et non prédictible, évaluer l'impact d'une rotation et la possibilité de forge de JWT. Proposer la correction et les tests, **sans modifier la production**. Aucune création de token réel tant que S3 n'est pas levé.

### 4.4 Décision bloquante

- **GO** uniquement si P0–P3 sont prouvés et le risque S3 maîtrisé.
- **NO-GO** si l'écriture planifiée sans intervention est impossible ou non vérifiable : arrêter le CDC, demander arbitrage explicite. Un MCP interactif seul **ne satisfait pas** l'objectif principal.
- **GO conditionnel** seulement sur décision explicite du propriétaire, avec limites et objectifs révisés consignés.

**Livrable :** `Doc/LOT2-V2-ETAPE-0-FAISABILITE.md`, preuves datées, liens, captures/constats sans secrets, matrice P0–P3, verdict GO/NO-GO. **STOP.**

## 5. Architecture cible si Gate 0 = GO

### 5.1 Responsabilités

- **ChatGPT :** recherche des offres, vérification des liens, extraction structurée, filtre géographique/contrat/expérience, scoring motivé, envoi MCP dans les limites autorisées.
- **MCP :** authentifie l'utilisateur, expose des outils bornés, valide les entrées, limite les abus et relaie vers les services métier existants ; aucun scraping ni appel à un LLM.
- **JobTracker :** stocke les critères, vérifie l'identité et les autorisations, applique les quotas et la déduplication, stocke les opportunités, rend les résultats consultables.

### 5.2 Outils MCP envisagés (à confirmer au design)

- `get_watch_preferences` : lecture des critères de veille du compte connecté ; données minimales.
- `create_opportunities` : envoi groupé **borné à 20** par exécution ; résultats par élément (`created`, `duplicate`, `rejected`, `error`) ; chaque entrée inclut `title`, `company`, `url`, `location`, `country`, `contract_type`, `description`, `source`, `external_id`, `discovered_at`, `relevance_score`, `relevance_reasons`, `source_evidence` si disponible. Définir les champs réellement compatibles avec le modèle existant avant implémentation.
- `list_opportunities` : lecture paginée limitée au propriétaire, utile pour éviter de proposer les mêmes offres ; pas de données de candidatures sensibles par défaut.

Ne pas exposer d'outil d'envoi de candidature, d'effacement massif, d'accès admin ou d'exécution de code. Si l'écriture groupée n'est pas supportée, utiliser un outil unitaire avec limites équivalentes, **après** validation de la faisabilité des tâches.

### 5.3 Authentification et isolation

Concevoir l'authentification du MCP conformément aux exigences actuelles du client ChatGPT (OAuth 2.1 et découverte des métadonnées lorsque requis). Ne **jamais** mettre `jt_agent_` dans un prompt, une URL, un frontend, un journal ou une configuration ChatGPT non prévue à cet effet. Si un AgentToken est utilisé **entre le MCP et l'API interne**, il reste strictement côté serveur et ne se substitue pas à l'authentification du client MCP. Favoriser une délégation sécurisée avec `user_id` dérivé de l'identité vérifiée, et non d'une entrée LLM. Aucun accès à un autre utilisateur.

### 5.4 Contrôle de qualité et déduplication

Valider la structure et la taille des champs, URL HTTPS, source et lien direct vers une offre lorsque possible, pays, contrat et niveau. Ne pas accepter aveuglément un score déclaré par ChatGPT : vérifier au minimum les règles déterministes (pays, contrat, format, bornes de score, cohérence du lien) et conserver le score comme **estimation**, non vérité garantie. Dédupliquer par les mécanismes du Lot 1, éviter les doublons inter-exécutions et rendre l'envoi idempotent. Ne pas créer 20 offres artificiellement si seules 4 sont pertinentes.

### 5.5 Paramètres utilisateur

Interface propriétaire pour pays, métiers/intitulés, exclusions, niveau, contrat, langues, score minimal et activation/pause logique. Établir une **source de vérité** unique et s'assurer que ChatGPT lit ces paramètres à chaque exécution ; sinon documenter que la tâche doit être mise à jour manuellement et ne pas prétendre que l'interface agit automatiquement.

### 5.6 Observabilité

Journaliser sans secret : horodatage, ID d'exécution non sensible, statut, nombre proposé/accepté/dupliqué/rejeté, erreurs par type et dernier succès. Distinguer exécution ChatGPT **observée par JobTracker** et exécution ChatGPT **effectivement terminée** : sans signal explicite de fin, JobTracker ne peut pas prouver que la veille s'est déroulée intégralement. Prévoir une visibilité sur l'absence de réception attendue, sans inventer de preuve de recherche.

## 6. Étapes d'implémentation — avec STOP strict

### Étape 0 — Faisabilité réelle + sécurité S3 (audit uniquement)

**Livrables :** preuve P0–P3, vérification des permissions du plan, procédure de test, état S3, verdict GO/NO-GO. **STOP : aucun code, aucune rotation, aucun token.**

### Étape 1 — Contrat fonctionnel et sécurité du MCP

**Travail :** analyser le code réel, spécifier schémas des outils, OAuth, isolation, quotas, idempotence, gestion des erreurs, score, journalisation et compatibilité Vercel. **Critères :** revue de menace, contrats testables, aucun privilège transversal. **STOP : revue et validation avant code.**

### Étape 2 — Pré-requis sécurité et fondations backend

**Travail :** implémenter la correction S3 approuvée, les paramètres de veille et les adaptations minimales d'ingestion, sans recherche serveur. **Critères :** tests de JWT invalide/forgé, isolation multi-utilisateur, validation des préférences, non-régression Lot 1. **STOP : tests + rapport ; aucune rotation/déploiement sans autorisation distincte.**

### Étape 3 — Serveur MCP authentifié

**Travail :** implémenter OAuth/validation, outils de lecture et d'ingestion, intégration au service Opportunités, gestion des doublons et erreurs. **Critères :** tests négatifs d'auth, droits minimaux, absence de secrets dans logs, idempotence, protections anti-abus. **STOP : rapport + démonstration sur environnement isolé.**

### Étape 4 — Interface de préférences JobTracker

**Travail :** interface propriétaire pour critères et statut de veille ; afficher les derniers envois et erreurs réellement observés. **Critères :** RBAC, responsive réel desktop/mobile, validation des entrées, comportement cohérent avec `get_watch_preferences`. **STOP : captures et tests, sans déploiement.**

### Étape 5 — Connexion ChatGPT et tests bout en bout

**Travail :** après autorisation, connecter le MCP à ChatGPT, vérifier lecture des critères, envoi d'offres de test, gestion des doublons, consentements et exécution programmée sans présence. **Critères :** deux exécutions quotidiennes configurables, au plus 20 créations/exécution, seuil 75, données uniquement sur le compte propriétaire ; preuve réelle du parcours. **STOP : résultats factuels, sans affirmer succès si approbation manuelle requise.**

### Étape 6 — Non-régression et mise en service contrôlée

**Travail :** tests complets backend/frontend/MCP, sécurité, UX, gestion des incidents, documentation d'exploitation, rollback, revue des accès. **Critères :** tests reproductibles, secret de production vérifié, consentement et traces, aucun faux positif de fonctionnement. **STOP : autorisation explicite séparée pour commit, push, déploiement et création de la tâche réelle.**

**Règle universelle :** l'agent s'arrête après chaque étape et attend un GO explicite. Aucune étape n'autorise automatiquement commit, push, déploiement, création de token, connexion de compte, tâche planifiée, rotation de secret ou modification de données de production.

## 7. Critères de recette finale

1. Sur le compte réel, ChatGPT exécute la veille **deux fois par jour** sans présence de l'utilisateur, sous réserve de preuve du Gate 0.
2. La recherche porte sur France, Suisse, Belgique et Luxembourg ; aucune promesse de couverture exhaustive.
3. Chaque exécution ajoute **0 à 20** nouvelles opportunités de score annoncé ≥75/100 ; les doublons ne sont pas recréés.
4. Chaque opportunité contient au minimum titre, entreprise, URL, pays/localisation et provenance exploitable ; les informations incertaines sont identifiées.
5. L'interface permet de modifier les critères et ChatGPT en tient effectivement compte lors de la veille suivante.
6. Aucune API de recherche/LLM supplémentaire n'est appelée par JobTracker pour la veille.
7. MCP authentifié, secrets protégés, S3 corrigée ou levée, droits restreints au compte propriétaire.
8. Les résultats sont consultables dans Opportunités et convertibles manuellement en `to_apply` ; aucune candidature n'est envoyée.
9. Erreurs et échecs d'exécution visibles sans exposer de données sensibles.
10. Tests fonctionnels, de sécurité et de non-régression documentés ; déploiement seulement après validation.

## 8. Hors périmètre explicite

Collecteurs France Travail/Adzuna, scraping LinkedIn/Indeed, cron de recherche JobTracker, LLM de qualification backend, facturation API OpenAI, automatisation des candidatures, envoi de CV, multi-utilisateur, scoring CV complexe, navigateur distant autonome développé par JobTracker. Tout repli vers ces options exige **un nouveau CDC approuvé**.

## 9. Sources officielles à revalider au Gate 0

Consultées le 8 octobre 2026 :

- [Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) — tâches, plugins, approbations et limites.
- [Create custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server) — ajout de MCP personnalisé, lecture/écriture et authentification.
- [Authentication — Plugins](https://developers.openai.com/plugins/build/auth) — OAuth 2.1 et métadonnées.
- [Managing app permissions in ChatGPT](https://help-lb.openai.com/fr-fr/articles/20001495-managing-app-permissions-in-chatgpt) — permissions et approbations.
- [Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt) — restrictions et disponibilité selon plans.

**Ces documents ne constituent pas, à eux seuls, une preuve qu'une tâche programmée sur ce compte précis peut effectuer une écriture MCP personnalisée sans approbation.** Cette preuve est l'objet de l'étape 0.

## 10. Consigne immédiate à l'agent

Lire intégralement ce CDC V2, le checkpoint Lot 1, la dette de sécurité et le rapport d'audit précédent. Constater que la V1 est obsolète. Exécuter **uniquement l'étape 0**, audit documentaire et protocole P0–P3 ; ne pas présumer disposer de l'accès au compte ChatGPT. Si une action nécessite le compte, demander au propriétaire de réaliser la manipulation et fournir une checklist précise. Ne rien coder, commiter, pousser, déployer, configurer ni créer de token. Rendre `Doc/LOT2-V2-ETAPE-0-FAISABILITE.md` puis **STOP**.
