# Fonctionnalités

Comportements réellement présents sur `main` (octobre 2026). L'état de validation des fonctions
de veille et d'OAuth figure dans [HISTORIQUE-ET-DECISIONS.md](./HISTORIQUE-ET-DECISIONS.md#état-réel).

## Parcours utilisateur

1. Inscription (e-mail/mot de passe) ou connexion **« Continuer avec Google »** (OAuth Google
   direct, sans service tiers), puis parcours d'accueil (`/onboarding`).
2. **Opportunités** : offres repérées, à trier (ignorer) ou à transformer en candidature.
3. **Candidatures** : suivi jusqu'à la réponse ; entretiens, documents, statistiques.
4. Paramètres : profil, notifications, clés IA, agenda, accès externes.

## Tableau de bord

Score de recherche, objectif mensuel, activité hebdomadaire, indicateurs et recommandations
(`/api/statistics/dashboard-v2`).

## Opportunités (`/dashboard/opportunities`)

Une opportunité est une offre **pas encore candidatée** : statut `new`, `ignored` ou
`converted`.

- **Sources** : ajout manuel, extension Chrome, agent externe par jeton d'API (Lot 1), veille MCP.
- **Provenance affichée** (« Source : … ») :

  | Cas | Libellé |
  |---|---|
  | Veille d'un client OAuth vérifié | « Veille {nom du client} » (ex. Veille ChatGPT, Veille Claude, Veille Claude Code) |
  | Veille antérieure à l'identification du client | « Veille (antérieure) » |
  | Client supprimé sans nom conservé | « Veille (client inconnu) » |
  | Autres sources | Ajout manuel, Extension Chrome, Agent externe… |

  Le nom vient du registre OAuth (nom actuel, ou copie prise à la création si le client a
  disparu), jamais de l'agent. Le champ `source` vaut toujours `chatgpt_watch` pour la veille
  (compatibilité) ; la provenance réelle est dans `origin` (calculé par le serveur).
- **Onglets** Toutes / Nouvelles / Ignorées / Converties et **recherche** poste ou entreprise.
- **Filtres** (calculés par le serveur, avant pagination ; le total est le résultat filtré) :
  Origine (plusieurs), Pays (plusieurs, codes ISO ; « France » saisi à la main est reconnu),
  Pertinence (75–84, 85–94, 95–100), Date de découverte (aujourd'hui, 7 jours, 30 jours,
  période ; jours de Paris, bornes incluses), Contrat, Séniorité (une offre sans séniorité ne
  correspond à aucun niveau), Ville / région.
- **Tri** : date de découverte (défaut), pertinence (offres sans score en dernier), entreprise.
  Tri stable entre les pages.
- **Facettes** (`/api/opportunities/facets`) : valeurs réellement présentes et effectifs
  **globaux au compte** (tous statuts, indépendants des filtres en cours).
- **Mobile** : filtres rapides Origine et Pays, panneau « Plus de filtres », pastilles
  supprimables, réinitialisation, compteur. L'état est conservé dans l'URL (retour arrière).
- **Carte** : statut, note de pertinence (« 92/100 ») si elle existe, provenance, actions
  **Voir l'offre** (lien externe sécurisé), **Ignorer** (annulable), **Candidater**.
- **Candidater** crée une candidature au statut « À postuler » (`to_apply`), de façon idempotente.
- Badge du nombre d'offres nouvelles dans la navigation.

## Candidatures (`/dashboard/applications`)

CRUD, statuts `to_apply` (à postuler, pas encore envoyée), `pending`, `contacted`, `positive`,
`negative`, `no_response`, `cancelled` ; recherche, filtres, suivi.

## Autres modules

| Module | Contenu |
|---|---|
| Entretiens | Planification, notes ; rappels par le planificateur (voir limite plus bas) |
| Statistiques | Graphiques et indicateurs |
| Conseiller IA | Analyse de CV et d'offres, multi-fournisseurs (Gemini, OpenAI, Groq) ; clés personnelles ou quota quotidien de la plateforme |
| Documents | CV et documents, modèles |
| Import / Export | CSV et exports |
| Support | Formulaire de contact, tickets |

## Veille automatisée

Des agents externes (ChatGPT, Claude…) cherchent des offres selon les critères du compte et les
transmettent par MCP. Détails : [VEILLE-PROGRAMMEE.md](./VEILLE-PROGRAMMEE.md),
[MCP-REFERENCE.md](./MCP-REFERENCE.md).

- Réservée aux comptes dont la veille est activée par un admin.
- Critères, état et historique des exécutions : **API uniquement** (`/api/watch/*`), pas d'écran.

## Paramètres (`/dashboard/settings`)

| Section | Contenu |
|---|---|
| Compte et profil | Informations personnelles |
| Notifications | Navigateur, e-mail |
| Intégrations | Clés IA personnelles (Gemini, OpenAI, Groq), Google Agenda |
| **API / Agents** | Onglet **Tokens API** : jetons d'agents externes (Lot 1, permission « Ajouter des opportunités »). Onglet **Connexions OAuth / MCP** (admin) : état du service et interrupteur d'urgence, politique CIMD, applications clientes (cartes repliables), autorisations |
| Support | Contact |
| Zone de danger | Réinitialisation des candidatures ou des entretiens |

## Administration (`/admin`)

| Page | Contenu |
|---|---|
| Tableau de bord | Statistiques globales |
| Utilisateurs | Liste, création, modification, réactivation. L'activation de la veille d'un compte se fait par l'API `PUT /api/admin/users/{id}/watch` (pas de bouton) |
| Jobs automatiques | État du planificateur et déclenchement manuel (rappels d'entretiens, relances d'accueil) |
| Support | Tickets |
| Modèles | Modèles système |

## Extension Chrome

« JobTracker Clipper » : ajout d'offres depuis les sites d'emploi, authentification par code
(JWT dédié « extension », sans accès à la gestion des jetons ni d'OAuth). Voir
[chrome-extension/README.md](../chrome-extension/README.md).

## Limites connues

- Le planificateur (rappels, relances) démarre dans le `lifespan`, **non exécuté sur Vercel** :
  en production, ces jobs ne tournent que déclenchés depuis Administration → Jobs automatiques.
- Pas d'écran pour les critères ni l'historique de la veille.
- Filtres « Métier », « Date de publication » et « Compétences » non proposés : ces données ne sont
  pas enregistrées.
