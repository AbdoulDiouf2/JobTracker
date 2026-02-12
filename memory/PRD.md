# JobTracker SaaS - Product Requirements Document

## Problème Original
Application SaaS de suivi de candidatures avec intégration IA pour impressionner les recruteurs tech.

## Stack Technique
- **Backend:** FastAPI, MongoDB, JWT, emergentintegrations
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI, Recharts
- **IA:** Google Gemini 2.5 Flash, OpenAI GPT-4o

---

## ✅ Phases Complétées

### Phase 1-2: Core
- CRUD Candidatures et Entretiens
- Authentification JWT
- Dashboard avec KPIs
- Internationalisation FR/EN

### Phase 3: Fonctionnalités Avancées
- Calendrier interactif entretiens (jour, semaine, mois, année)
- Vue carte/table candidatures
- Changement de statut via dropdown
- Vue détaillée (modal)
- Export Excel/JSON/CSV

### Phase 4: Intégration IA
- Conseiller Carrière (Gemini)
- Assistant Chatbot (GPT-4o)
- Interface chat avec suggestions

### Phase 5: Import/Export & Analyse CV
- Import JSON/CSV/Excel/NDJSON avec prévisualisation
- Import entretiens avec mapping de colonnes
- Détection des doublons
- Analyse CV IA (score, compétences, recommandations)

### Phase 6: Notifications
- Cloche de notification dans le header
- Paramètres de notification dans Settings
- Rappels automatiques 24h et 1h avant entretien
- Sidebar fixe (ne scroll plus avec la page)

### Phase 7: Administration Multi-Tenant (12 Février 2025)
- Système de rôles (admin, standard, premium)
- Dashboard admin avec statistiques globales
- Gestion des utilisateurs (activation, rôles)
- Graphiques croissance et activité
- Export des statistiques admin
- Script seed_admin.py pour initialisation

### Phase 8: Suivi Avancé des Candidatures (12 Février 2025)
- **Timeline visuelle** : Historique complet (envoyé → réponse → entretien)
- **Rappels automatiques** : Alerte si pas de réponse après X jours
- **Génération relance IA** : Email de relance personnalisé (3 tons)
- **Score de matching** : Analyse IA CV vs offre d'emploi
- Nouveaux champs : contact_email, contact_name, description_poste, days_before_reminder

### Phase 9: IA Multi-Provider & Extension Chrome (12 Février 2025)
- **Support Groq** : Ajout de Groq comme 3ème fournisseur d'API
- **Sélection dynamique de modèle** : Dropdown dans le chatbot pour choisir le modèle
- **Modèles disponibles** :
  - OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo
  - Google: Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash
  - Groq: Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B, Gemma 2 9B
- **Extension Chrome v2** : Extraction IA automatique des offres d'emploi
- **Endpoint `/api/ai/extract-job`** : Extraction IA depuis contenu de page
- **Endpoint `/api/ai/available-models`** : Liste des modèles disponibles

---

## APIs Disponibles

### Authentication
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur

### Applications
- `GET /api/applications` - Liste paginée
- `POST /api/applications` - Créer
- `PUT /api/applications/{id}` - Modifier
- `DELETE /api/applications/{id}` - Supprimer

### Tracking (NOUVEAU)
- `GET /api/applications/{id}/timeline` - Historique complet
- `POST /api/applications/{id}/timeline/event` - Ajouter événement
- `GET /api/applications/reminders/pending` - Candidatures nécessitant relance
- `POST /api/applications/{id}/reminder/mark-sent` - Marquer rappel envoyé
- `POST /api/applications/{id}/followup/generate` - Générer email relance IA
- `POST /api/applications/{id}/matching/calculate` - Calculer score matching
- `GET /api/applications/{id}/matching` - Récupérer score existant

### Administration
- `GET /api/admin/dashboard` - Stats globales
- `GET /api/admin/users` - Liste utilisateurs
- `PUT /api/admin/users/{id}` - Modifier utilisateur
- `DELETE /api/admin/users/{id}` - Désactiver utilisateur

### Notifications
- `GET /api/notifications` - Liste des notifications
- `GET /api/notifications/settings` - Paramètres
- `PUT /api/notifications/settings` - Modifier paramètres
- `PUT /api/notifications/{id}/read` - Marquer comme lu
- `PUT /api/notifications/read-all` - Tout marquer lu
- `DELETE /api/notifications/{id}` - Supprimer
- `POST /api/notifications/generate-reminders` - Générer rappels

---

## Credentials
- **Email:** demo@jobtracker.com
- **Password:** Demo123!
- **URL:** https://careerpath-54.preview.emergentagent.com

---

## Backlog Futur
- [ ] Notifications push (PWA)
- [ ] Mode offline
- [ ] Déploiement production

© 2025 MAADEC
