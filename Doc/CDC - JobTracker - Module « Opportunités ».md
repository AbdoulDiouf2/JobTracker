# CDC — JobTracker — Module « Opportunités »
## Lot 1 — Inbox d'opportunités et API d'ingestion externe

## 0. Contexte

JobTracker est une application de suivi de recherche d'emploi existante.

Stack actuelle :
- Frontend : React 19
- React Router 7
- TanStack Query
- Tailwind CSS
- Shadcn UI
- Backend : FastAPI
- Pydantic v2
- MongoDB / Motor async
- Authentification JWT + Google OAuth
- PWA
- Hébergement Vercel

JobTracker possède déjà :
- gestion des candidatures ;
- historique/timeline ;
- documents/CV ;
- matching CV ↔ offre ;
- génération de lettres de motivation ;
- génération de relances ;
- statistiques ;
- notifications ;
- extension Chrome avec extraction d'offres via `/extract-job`.

IMPORTANT :
Avant toute implémentation, auditer le code existant afin de réutiliser les modèles,
services, composants, conventions, enums et endpoints existants.

Ne pas créer de logique métier parallèle si une fonctionnalité équivalente existe déjà.


# 1. Objectif

Ajouter à JobTracker une boîte de réception appelée :

> Opportunités

Une opportunité représente une offre d'emploi découverte mais pour laquelle
l'utilisateur n'a PAS encore candidaté.

Le module doit permettre à des systèmes externes d'envoyer des offres à JobTracker.

Exemples futurs :
- ChatGPT ;
- MCP JobTracker ;
- agent de veille ;
- extension Chrome ;
- import externe ;
- autre automatisation.

Le workflow MVP est :

VEILLE EXTERNE
      ↓
API JobTracker
      ↓
OPPORTUNITÉ
      ↓
Utilisateur consulte
      ↓
 ┌────────────┐
 │            │
Ignorer    Candidater
               ↓
      Candidature JobTracker
               ↓
       système existant


# 2. Hors périmètre

NE PAS implémenter dans ce lot :

- MCP ;
- Playwright ;
- candidature automatique ;
- soumission automatique de formulaires ;
- scraping automatique de sites emploi ;
- modification automatique du CV ;
- génération automatique de lettre à la réception ;
- agent autonome ;
- nouveau moteur de matching ;
- refonte du système de candidatures ;
- workflow complexe d'approbation ;
- cron de recherche d'offres.

Ce lot doit uniquement fournir une infrastructure propre permettant
d'INGÉRER, AFFICHER, IGNORER et CONVERTIR des opportunités.


# 3. Nouveau domaine métier : Opportunity

Créer un modèle Opportunity distinct du modèle Application/Candidature.

Une Opportunity signifie :

> « Une offre potentiellement intéressante découverte pour l'utilisateur. »

Une Application signifie :

> « Une candidature réellement créée/envoyée ou suivie par l'utilisateur. »

Ne pas mélanger les deux concepts.


# 4. Modèle de données

Créer une collection MongoDB dédiée :

`opportunities`

Structure indicative :

```json
{
  "_id": "ObjectId",

  "user_id": "ObjectId",

  "title": "Data Engineer Junior",
  "company": "Orange",

  "location": "Paris",
  "country": "France",

  "contract_type": "CDI",

  "url": "https://...",
  "description": "...",

  "source": "chatgpt_watch",
  "external_id": null,

  "status": "new",

  "discovered_at": "2026-10-08T08:00:00Z",
  "created_at": "2026-10-08T08:00:05Z",
  "updated_at": "2026-10-08T08:00:05Z",

  "converted_application_id": null,

  "metadata": {}
}
```

Adapter les noms/types aux conventions existantes du repository.


# 5. Champs obligatoires

Minimum requis pour créer une opportunité :

- title
- company
- url

Les autres champs peuvent être optionnels.


# 6. Statuts

Pour le MVP, seulement :

- `new`
- `ignored`
- `converted`

Ne pas introduire de workflow plus complexe.


# 7. Source

Prévoir un champ `source`.

Valeurs possibles initialement :

- `chatgpt_watch`
- `chrome_extension`
- `manual`
- `external_agent`
- `other`

Ne pas forcément rendre l'enum rigide si cela complique les futures intégrations.

Prévoir également :

`external_id`

optionnel.

Il permettra à un fournisseur externe d'envoyer son propre identifiant.


# 8. Dédoublonnage

Le système DOIT empêcher qu'une même offre soit créée plusieurs fois pour
le même utilisateur.

Priorité :

1. `(user_id, source, external_id)` si external_id existe ;
2. URL normalisée ;
3. éventuellement fallback déterministe company + title + location.

Minimum obligatoire :
- dédoublonnage URL par utilisateur.

Normaliser l'URL avant comparaison.

Exemples à neutraliser lorsque cela est raisonnablement possible :

- trailing slash ;
- fragments `#...` ;
- paramètres de tracking :
  - utm_source
  - utm_medium
  - utm_campaign
  - utm_content
  - utm_term

Ne PAS supprimer arbitrairement les query parameters pouvant identifier l'offre.

Exemple :

`https://company.com/jobs/123?utm_source=linkedin`

et

`https://company.com/jobs/123`

doivent pouvoir être reconnus comme la même offre.


# 9. Comportement en cas de doublon

L'API d'ingestion doit être IDEMPOTENTE.

Si l'opportunité existe déjà :

NE PAS créer une deuxième ligne.

Répondre par exemple :

```json
{
  "created": false,
  "duplicate": true,
  "opportunity_id": "..."
}
```

Si elle est créée :

```json
{
  "created": true,
  "duplicate": false,
  "opportunity_id": "..."
}
```

Le choix précis du code HTTP doit respecter les conventions actuelles du backend.


# 10. API utilisateur

Créer les routes nécessaires au frontend.

Minimum :

GET /api/opportunities

GET /api/opportunities/{id}

POST /api/opportunities

PATCH /api/opportunities/{id}

POST /api/opportunities/{id}/ignore

POST /api/opportunities/{id}/convert

DELETE éventuellement hors MVP si inutile.

Toutes les routes utilisateur doivent être strictement scopées au user connecté.

Un utilisateur ne doit jamais pouvoir lire/modifier une Opportunity appartenant
à un autre utilisateur.


# 11. Conversion Opportunity → Application

C'est une fonctionnalité critique.

Endpoint :

POST /api/opportunities/{id}/convert

Il doit créer une candidature en réutilisant le service métier existant.

NE PAS dupliquer la logique de création d'une candidature.

Mapping indicatif :

Opportunity.title
→ Application.position/title existant

Opportunity.company
→ Application.company

Opportunity.url
→ Application.job_url/source_url

Opportunity.description
→ champ description existant

Opportunity.contract_type
→ contract type existant

Opportunity.location
→ location existant

etc.

Auditer le modèle Application actuel pour déterminer le mapping exact.


# 12. Après conversion

Après succès :

Opportunity.status = "converted"

Opportunity.converted_application_id = <ID>

Retourner au frontend l'identifiant de la candidature.

Exemple :

```json
{
  "success": true,
  "application_id": "...",
  "opportunity_id": "..."
}
```

La conversion doit être idempotente.

Si l'utilisateur clique deux fois :

NE PAS créer deux candidatures.

Retourner la candidature déjà associée.


# 13. Date de candidature

ATTENTION :

La conversion d'une opportunité ne signifie pas nécessairement :

« J'ai déjà envoyé ma candidature ».

Respecter la sémantique du modèle Application existant.

Si JobTracker possède actuellement un champ indiquant que la candidature a été
envoyée, ne pas automatiquement considérer l'offre comme envoyée si ce n'est
pas réellement le cas.

Auditer ce comportement avant implémentation.

Si le modèle actuel ne permet pas cette distinction, documenter le problème
avant de modifier le domaine.


# 14. API d'ingestion externe

Préparer une API dédiée aux systèmes externes.

Exemple :

POST /api/agent/opportunities

Cette route permettra plus tard à ChatGPT/MCP ou à un agent externe
d'envoyer une opportunité.


# 15. Authentification machine-to-machine

NE PAS utiliser le JWT personnel de l'utilisateur comme secret permanent
pour un agent.

Créer un système minimal de token API dédié.

Exemple visuel :

`jt_agent_xxxxxxxxxxxxxxxxx`

Le token doit appartenir à un utilisateur JobTracker.


# 16. Stockage sécurisé des tokens

IMPORTANT :

Ne jamais stocker le token brut en base.

Lors de la création :

token brut
   ↓
retourné UNE SEULE FOIS
   ↓
hash stocké en MongoDB

Approche recommandée :
- token cryptographiquement aléatoire ;
- préfixe identifiable `jt_agent_`;
- hash SHA-256/HMAC ou mécanisme adapté ;
- comparaison sécurisée.

Le token complet ne doit jamais être récupérable depuis MongoDB.


# 17. Modèle AgentToken

Exemple conceptuel :

```json
{
  "_id": "...",
  "user_id": "...",

  "name": "ChatGPT Watch",

  "token_prefix": "jt_agent_a82f",
  "token_hash": "...",

  "scopes": [
    "opportunities:create"
  ],

  "created_at": "...",
  "last_used_at": null,
  "revoked_at": null
}
```


# 18. Permissions du token

Pour ce MVP, prévoir au minimum :

`opportunities:create`

Optionnel pour préparer la suite :

`opportunities:read`

Le token utilisé pour la veille ne doit PAS avoir :

- admin ;
- users ;
- documents ;
- delete ;
- applications:write ;
- paramètres ;
- clés API IA.

Principe du moindre privilège.


# 19. Gestion des tokens dans l'interface

Ajouter dans les paramètres utilisateur une section :

« API / Agents »

Permettre :

- créer un token ;
- lui donner un nom ;
- afficher ses permissions ;
- afficher date de création ;
- afficher dernière utilisation ;
- révoquer le token.

Lors de la création :

Afficher le token complet UNE SEULE FOIS.

Message :

« Copiez ce token maintenant. Il ne sera plus affiché. »

Ajouter bouton :

[Copier]


# 20. Endpoint externe

Exemple :

POST /api/agent/opportunities

Header :

Authorization: Bearer jt_agent_xxxxx

Payload :

```json
{
  "title": "Data Engineer Junior",
  "company": "Orange",
  "location": "Paris",
  "country": "France",
  "contract_type": "CDI",
  "url": "https://...",
  "description": "...",
  "source": "chatgpt_watch",
  "external_id": "optional"
}
```

IMPORTANT :

`user_id` ne doit PAS être accepté depuis le payload.

Le user doit être déterminé exclusivement depuis le token.

Cela empêche un agent d'injecter une offre dans le compte d'un autre utilisateur.


# 21. Rate limiting

Ajouter un rate limiting raisonnable sur :

POST /api/agent/opportunities

Réutiliser slowapi si déjà présent.

Le but n'est pas d'empêcher une veille normale mais de limiter :
- token compromis ;
- boucle accidentelle ;
- spam API.


# 22. Page « Opportunités »

Ajouter une entrée dans la navigation :

Opportunités

avec éventuellement un badge :

Opportunités  4

Le badge correspond au nombre d'opportunités `new`.


# 23. Interface desktop

Chaque opportunité doit afficher au minimum :

- poste ;
- entreprise ;
- localisation ;
- type de contrat ;
- source ;
- date de découverte.

Actions :

[Voir l'offre]
[Ignorer]
[Candidater]

Optionnel :

[Voir détails]


# 24. Interface mobile

JobTracker étant une PWA, la page doit être réellement responsive.

Éviter une table desktop compressée.

Préférer des cartes compactes.

Exemple :

┌──────────────────────────────┐
│ Data Engineer Junior         │
│ Orange                       │
│ Paris · CDI                  │
│                              │
│ Trouvée aujourd'hui          │
│ Source : Veille ChatGPT      │
│                              │
│ [Voir] [Ignorer] [Candidater]│
└──────────────────────────────┘


# 25. Filtres minimum

Prévoir :

- Toutes
- Nouvelles
- Ignorées
- Converties

Et idéalement recherche par :
- poste ;
- entreprise.

Ne pas construire un moteur de filtrage complexe dans ce lot.


# 26. Détail d'une opportunité

Afficher :

- poste ;
- entreprise ;
- localisation ;
- contrat ;
- description ;
- source ;
- URL ;
- date de découverte.

Actions :

[Voir l'offre originale]

[Ignorer]

[Candidater]


# 27. Action « Ignorer »

Lorsqu'elle est utilisée :

status = ignored

Ne PAS supprimer l'opportunité.

Pourquoi :

Cela permet de conserver l'historique et surtout d'éviter qu'une veille
réimporte la même offre le lendemain.


# 28. Action « Candidater »

Le bouton ne doit PAS envoyer une candidature sur le site de l'entreprise.

Il signifie :

> « Je souhaite transformer cette opportunité en candidature suivie dans JobTracker. »

Il appelle :

POST /api/opportunities/{id}/convert

Puis redirige vers la candidature créée.

À partir de là, toutes les fonctionnalités existantes JobTracker reprennent.


# 29. Matching

NE PAS construire un nouveau moteur.

Si JobTracker sait déjà calculer le matching :

prévoir éventuellement un bouton :

[Analyser mon profil]

ou réutiliser le mécanisme existant après conversion.

L'automatisation du matching à l'ingestion est hors scope du Lot 1,
sauf si elle peut être branchée trivialement sur le service existant
sans complexifier le domaine.


# 30. Notifications

Lorsqu'une opportunité est ajoutée via API externe :

ne pas nécessairement envoyer immédiatement une notification pour CHAQUE offre.

Cela pourrait provoquer du spam.

Pour le MVP :
- mettre à jour le badge « Opportunités » ;
- rendre les nouvelles opportunités visibles dans l'application.

La stratégie push/email sera traitée ultérieurement.


# 31. Index MongoDB

Prévoir les index utiles.

Au minimum :

- user_id
- user_id + status
- user_id + created_at/discovered_at
- dédoublonnage URL
- token hash

Si external_id est utilisé :

index adapté sur :

(user_id, source, external_id)

en tenant compte du caractère optionnel du champ.


# 32. Sécurité

Vérifier :

- isolation stricte des utilisateurs ;
- aucun user_id contrôlable depuis l'API agent ;
- token jamais loggé ;
- Authorization header jamais loggé ;
- token hashé en base ;
- révocation immédiate ;
- validation stricte des URLs ;
- limites raisonnables sur taille de description/metadata ;
- sanitisation côté rendu frontend ;
- rate limiting ;
- CORS cohérent avec l'architecture actuelle.

Ne jamais placer le token agent dans le frontend public.


# 33. Observabilité minimale

Pour l'API agent, journaliser sans secrets :

- token_id ou prefix ;
- user_id ;
- endpoint ;
- résultat ;
- opportunity_id ;
- duplicate true/false ;
- timestamp.

Ne jamais journaliser :
- token complet ;
- Authorization header.


# 34. Tests backend obligatoires

Ajouter des tests couvrant au minimum :

1. création Opportunity utilisateur ;
2. récupération des Opportunities ;
3. isolation user A / user B ;
4. ignore ;
5. conversion ;
6. double conversion ;
7. dédoublonnage URL ;
8. URL avec UTM → doublon ;
9. external_id → doublon ;
10. token agent valide ;
11. token invalide ;
12. token révoqué ;
13. scope insuffisant ;
14. API agent sans user_id fourni ;
15. tentative d'injection d'un user_id ;
16. rate limiting si facilement testable ;
17. token non stocké en clair.


# 35. Tests frontend

Tester au minimum :

- affichage liste ;
- empty state ;
- badge nouvelles opportunités ;
- filtres ;
- recherche ;
- bouton Voir ;
- Ignorer ;
- Candidater ;
- redirection après conversion ;
- responsive mobile.


# 36. Empty state

Si aucune opportunité :

« Aucune opportunité pour le moment »

Texte secondaire :

« Les offres détectées par vos outils et agents apparaîtront ici. »

Ne pas mentionner uniquement ChatGPT afin que le module reste générique.


# 37. Préparation au MCP

IMPORTANT :

Ne PAS implémenter MCP dans ce lot.

En revanche, concevoir le domaine afin qu'un futur MCP puisse simplement appeler
les services existants.

Architecture souhaitée :

MCP futur
   ↓
Service Opportunity
   ↓
MongoDB

et NON :

MCP
   ↓
logique métier différente
   ↓
MongoDB

Les routes HTTP, les routes agent et le futur MCP doivent partager la même
couche service.


# 38. Architecture recommandée

Conceptuellement :

routes/opportunities.py
          │
          └──────┐
                 ↓
       OpportunityService
                 │
                 ↓
              MongoDB

routes/agent_opportunities.py
                 │
                 ┘

Le nom exact des fichiers doit suivre l'architecture existante du repo.

Ne pas imposer cette structure si le projet utilise déjà un pattern différent.


# 39. Compatibilité future

Le modèle doit pouvoir accueillir ultérieurement, sans migration majeure :

- matching_score ;
- matching_reason ;
- qualification IA ;
- selected_cv_id ;
- generated_cover_letter_id ;
- préparation automatique ;
- READY_FOR_REVIEW ;
- Playwright ;
- auto-application ;
- MCP ;
- Gmail ;
- Google Calendar.

Mais NE PAS implémenter ces fonctionnalités maintenant.


# 40. Critères d'acceptation

Le Lot 1 est considéré terminé lorsque le scénario suivant fonctionne :

### Scénario A — Agent externe

Un utilisateur génère un token :

`ChatGPT Watch`

Un client externe appelle :

POST /api/agent/opportunities

avec une offre.

Résultat :

- authentification réussie ;
- utilisateur déterminé depuis le token ;
- Opportunity créée ;
- elle apparaît dans JobTracker ;
- badge incrémenté.


### Scénario B — Doublon

Le même client renvoie la même offre.

Résultat :

- aucune deuxième Opportunity ;
- API répond duplicate=true ;
- première Opportunity conservée.


### Scénario C — Ignorer

Utilisateur clique Ignorer.

Résultat :

- status=ignored ;
- elle disparaît de « Nouvelles » ;
- reste consultable dans « Ignorées ».


### Scénario D — Candidater

Utilisateur clique Candidater.

Résultat :

- une Application existante JobTracker est créée via la logique métier existante ;
- Opportunity.status=converted ;
- converted_application_id renseigné ;
- redirection vers la candidature.


### Scénario E — Double clic

L'utilisateur relance la conversion.

Résultat :

- aucune deuxième candidature ;
- candidature existante retournée.


# 41. Contraintes de réalisation

Avant de coder :

1. Auditer le modèle Application existant.
2. Auditer les routes de création de candidature.
3. Auditer `/extract-job`.
4. Auditer le système JWT/auth.
5. Auditer les modèles Mongo/Pydantic.
6. Auditer les conventions frontend/TanStack Query.
7. Auditer slowapi.
8. Identifier les composants UI réutilisables.

Produire ensuite un court rapport :

- existant réutilisable ;
- écarts avec ce CDC ;
- architecture retenue ;
- fichiers prévus ;
- éventuels risques.

STOP après l'audit.

Ne rien implémenter avant validation de l'architecture.


# 42. Contraintes Git / déploiement

IMPORTANT :

- Aucun commit sans autorisation.
- Aucun push sans autorisation.
- Aucun déploiement sans autorisation.
- Aucun changement de production.
- Ne pas modifier les données de production pour tester.
- Utiliser les mécanismes de test existants du projet.

À la fin de chaque étape :
- fournir la liste des fichiers modifiés ;
- tests exécutés ;
- résultats ;
- dette/limitations éventuelles ;
- confirmer explicitement l'absence de commit/push/deploy.


# 43. Découpage recommandé

## Étape 1 — Audit
STOP validation.

## Étape 2 — Domaine Opportunity + Mongo + services + tests
STOP validation.

## Étape 3 — API utilisateur + conversion Application
STOP validation.

## Étape 4 — AgentToken + API d'ingestion externe
STOP validation.

## Étape 5 — Interface Opportunités desktop/mobile
STOP validation.

## Étape 6 — Validation complète / non-régression
STOP avant commit.

Aucun MCP.
Aucun Playwright.
Aucune auto-candidature.
Aucun déploiement.
```

Un point est particulièrement important : **je garderais `Opportunity` séparé de `Application`**. C'est ce qui évitera de polluer tes statistiques de candidatures avec des offres que tu n'as finalement jamais voulu poursuivre.

Et avec ce Lot 1 terminé, ton JobTracker sera techniquement prêt pour la brique suivante : **le petit connecteur/MCP qui permettra à la veille de déposer les opportunités dans cette inbox**.