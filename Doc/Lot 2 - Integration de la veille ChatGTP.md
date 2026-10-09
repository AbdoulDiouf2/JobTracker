# JobTracker — Lot 2 : Intégration de la veille ChatGPT

## 1. Contexte

Nous venons de terminer le **Lot 1 — Module Opportunités** de JobTracker.

Deux commits sont présents sur `origin/main` :
- `1286fba` : module Opportunités et ingestion sécurisée.
- `7a5415e` : correctifs du démarrage en développement et du plugin visual-edits.

Les 257 tests (215 backend, 42 frontend) passent.

Le Lot 1 a introduit :
- Une collection MongoDB `opportunities`.
- Une interface utilisateur pour consulter, ignorer et convertir les opportunités.
- Un statut de candidature `to_apply` (« À postuler »).
- Un système d'AgentTokens.
- Une API d'ingestion externe `POST /api/agent/opportunities`.
- Une déduplication par URL normalisée ou `external_id`.
- Des quotas, permissions et protections contre les accès non autorisés.

Consulte en priorité :

`Doc/LOT1-OPPORTUNITES-CHECKPOINT.md`

ainsi que les services, routes et modèles concernés.

## 2. Vision du Lot 2

Je souhaite connecter JobTracker à une **veille d'emploi automatisée utilisant ChatGPT**.

Aujourd'hui, ChatGPT peut effectuer une veille programmée et m'envoyer les résultats sous forme de notifications ou de rapports.

Mon objectif est de supprimer l'étape manuelle consistant à recopier les offres dans JobTracker.

**Parcours cible :**

1. Une veille automatisée recherche des offres d'emploi.
2. Elle identifie les offres correspondant à mes critères.
3. Elle transmet les offres pertinentes à JobTracker.
4. JobTracker les enregistre comme `Opportunity:new`.
5. Les doublons sont ignorés automatiquement.
6. Je retrouve les offres dans mon interface Opportunités.
7. Je peux consulter chaque offre, l'ignorer ou la convertir en candidature `to_apply`.
8. Je conserve le contrôle sur l'envoi réel des candidatures.

### Critères actuels de veille

- **Pays** : France, Suisse, Belgique, Luxembourg.
- **Contrat** : principalement CDI ou équivalent permanent.
- **Niveau** : junior, débutant, jeune diplômé.
- **Domaines** : Data Engineering, Data Science, Big Data, Intelligence artificielle, Machine Learning et métiers Data associés.

Ces critères doivent être configurables à terme, et non codés en dur.

Le Lot 2 concerne la **collecte et la synchronisation des opportunités**, pas l'envoi automatique des candidatures.

## 3. Question architecturale centrale

Nous devons déterminer si une **tâche programmée ChatGPT** peut réellement utiliser un connecteur personnalisé pour écrire dans une application externe sans intervention humaine.

Il ne faut surtout pas supposer que :

« ChatGPT prend en charge les MCP » signifie automatiquement « les tâches programmées ChatGPT peuvent invoquer un MCP ».

Ces capacités doivent être vérifiées dans la documentation officielle OpenAI actuelle.

## 4. Architectures à étudier

### Option A — ChatGPT Tasks → Connecteur → JobTracker

Une tâche ChatGPT programmée recherche les offres puis utilise un connecteur pour appeler JobTracker.

Étudier :
- Disponibilité réelle des connecteurs dans les tâches programmées.
- Exécution sans intervention humaine.
- Gestion des autorisations.
- Authentification.
- Limites et restrictions.
- Compatibilité avec les comptes utilisateurs.
- Fiabilité des exécutions récurrentes.

### Option B — ChatGPT → MCP JobTracker

Créer un serveur MCP distant exposant des outils tels que :

- `create_opportunity`
- `list_opportunities`
- `get_opportunity`

Le MCP communiquerait avec l'API JobTracker.

Étudier :
- Transport MCP HTTP actuel.
- Compatibilité avec ChatGPT.
- Hébergement sur Vercel ou service distinct.
- Authentification OAuth ou autre mécanisme réellement supporté.
- Gestion des secrets.
- Limitations des connecteurs personnalisés.
- Possibilité d'utilisation dans les tâches programmées.

Attention : `opportunities:read` n'existe pas encore dans les AgentTokens du Lot 1.

### Option C — Veille autonome côté serveur

Si ChatGPT Tasks ne peut pas appeler automatiquement un connecteur personnalisé, étudier une architecture indépendante :

Planificateur (cron)
→ recherche d'offres
→ collecte et extraction
→ filtrage et qualification
→ API Agent JobTracker
→ Opportunités.

ChatGPT pourrait alors rester un assistant interactif, sans être responsable de l'exécution programmée.

Étudier :
- Planification des exécutions.
- Sources d'offres et API disponibles.
- Respect des conditions d'utilisation des sources.
- Utilisation éventuelle d'un LLM via API.
- Coûts d'exécution.
- Gestion des erreurs.
- Retries et déduplication.
- Observabilité.
- Hébergement et maintenance.

### Option D — Architecture hybride

Étudier une combinaison :
- veille autonome fiable côté serveur ;
- MCP pour consulter et gérer les opportunités depuis ChatGPT ;
- API Agent existante pour l'ingestion ;
- interface JobTracker comme source de vérité.

## 5. Contraintes techniques

JobTracker utilise actuellement :
- FastAPI ;
- MongoDB ;
- React ;
- Vercel ;
- une API Agent authentifiée par token `jt_agent_`.

Réutiliser autant que possible les mécanismes du Lot 1.

Éviter :
- de créer un deuxième système de stockage d'opportunités ;
- de dupliquer les règles de dédoublonnage ;
- de multiplier les services inutilement ;
- d'introduire une infrastructure disproportionnée.

## 6. Sécurité — point bloquant

Avant toute intégration externe, auditer la dette S3 documentée dans :

`Doc/DETTE-SECURITE.md`

Vérifier si `JWT_SECRET` possède une valeur par défaut prévisible en production.

Si oui, identifier la correction minimale nécessaire avant l'utilisation réelle des AgentTokens.

Ne pas appliquer cette correction pendant l'audit.

Étudier également :
- où résiderait le secret `jt_agent_` ;
- comment il serait transmis ;
- comment le révoquer ;
- comment éviter toute exposition dans le frontend ou les journaux ;
- si OAuth est obligatoire pour une intégration MCP ChatGPT ;
- si les AgentTokens actuels peuvent être réutilisés directement ou nécessitent une couche d'authentification supplémentaire.

Ne jamais demander ni afficher un véritable token dans le rapport.

## 7. Déploiement actuel

Les deux commits ont été poussés sur `origin/main`.

Le déploiement automatique Vercel n'est pas encore confirmé.

Si les outils et accès disponibles le permettent, vérifier :
- si un déploiement Production a été déclenché ;
- le commit actuellement déployé ;
- le statut du déploiement ;
- les éventuelles erreurs.

Ne pas modifier le déploiement.

Si l'accès Vercel est indisponible, le signaler explicitement et fournir la procédure de vérification.

## 8. Travail demandé maintenant : AUDIT UNIQUEMENT

**Ne développer aucune fonctionnalité.**

Effectuer deux analyses complémentaires :

### A. Recherche documentaire OpenAI

Consulter la documentation officielle et actuelle concernant :
- ChatGPT Tasks ;
- connecteurs et applications personnalisées ;
- MCP ;
- authentification OAuth ;
- exécution automatisée ;
- restrictions des tâches programmées.

Distinguer :
- officiellement supporté ;
- officiellement non supporté ;
- non documenté ou non confirmé.

Fournir les liens des sources et leur date de consultation.

Ne pas inventer de capacité.

Si l'accès Internet est indisponible, signaler que cette partie de l'audit reste à vérifier. Ne pas conclure sur la base d'hypothèses.

### B. Audit technique JobTracker

Inspecter le code réel :
- services Opportunity ;
- API Agent ;
- AgentTokens ;
- configuration ;
- déploiement Vercel ;
- dépendances ;
- architecture des routes ;
- contraintes d'exécution serverless.

Identifier les éléments réutilisables, les manques et les risques.

## 9. Livrable attendu

Créer un rapport :

`Doc/LOT2-AUDIT-FAISABILITE.md`

Il devra contenir :

1. Résumé exécutif.
2. Objectif métier du Lot 2.
3. État technique réel du Lot 1.
4. Capacités ChatGPT officiellement vérifiées.
5. Comparaison des quatre architectures.
6. Faisabilité de l'exécution automatique sans intervention humaine.
7. Analyse de l'authentification et des secrets.
8. Hébergement et contraintes Vercel.
9. Coûts et complexité estimés.
10. Risques et limites.
11. Pré-requis de sécurité.
12. Architecture recommandée, avec justification.
13. Décisions nécessitant mon arbitrage.
14. Proposition de découpage du Lot 2 en étapes.

Pour les coûts, distinguer les montants vérifiés des simples estimations.

Ne pas encore rédiger le CDC d'implémentation définitif : nous choisirons d'abord l'architecture.

## 10. Règles de travail

- Audit et documentation uniquement.
- Aucun changement fonctionnel.
- Aucun ajout de dépendance.
- Aucun changement de configuration.
- Aucun commit.
- Aucun push.
- Aucun déploiement.
- Aucune modification des données.
- Ne pas créer de token réel.

**STOP après le rapport d'audit.**

Présente-moi les conclusions, les preuves documentaires et les questions d'architecture à trancher avant toute implémentation.