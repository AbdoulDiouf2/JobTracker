# JobTracker SaaS - Product Requirements Document

## Problème Original
Application SaaS de suivi de candidatures avec intégration IA pour impressionner les recruteurs tech.

## Stack Technique
- **Backend:** FastAPI, MongoDB, JWT, emergentintegrations
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI, Recharts
- **IA:** Google Gemini (2.0 Flash, 1.5 Pro), OpenAI (GPT-4o, GPT-4o Mini), Groq (Llama 3.3, Mixtral)

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

### Phase 10: Gestion des Documents (12 Février 2025)
- **Stockage multi-CV** : Upload de fichiers PDF/DOC/DOCX (max 10 MB)
- **Étiquettes CV** : Organiser par secteur/poste (CV Tech, CV Data, etc.)
- **CV par défaut** : Définir un CV principal
- **Templates LM** : Créer des templates de lettres de motivation avec variables
- **Variables dynamiques** : {entreprise}, {poste}, {date}, {nom}, {email}
- **Portfolio & Liens** : Stocker liens GitHub, LinkedIn, Portfolio
- **Détection automatique** : Icônes selon le type de lien
- **Liaison candidatures** : Tracker quel CV/LM envoyé à quelle entreprise

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

### IA
- `GET /api/ai/available-models` - Liste des modèles disponibles
- `POST /api/ai/career-advisor` - Conseiller carrière (avec sélection modèle)
- `POST /api/ai/chatbot` - Assistant chat (avec sélection modèle)
- `POST /api/ai/extract-job` - Extraction IA offre d'emploi (Chrome Extension)
- `GET /api/ai/chat-history/{session_id}` - Historique de conversation
- `GET /api/ai/chat-sessions` - Liste des sessions

### Documents
- `POST /api/documents/upload` - Upload CV/document
- `POST /api/documents/link` - Ajouter lien portfolio
- `GET /api/documents/` - Liste des documents
- `GET /api/documents/cv` - Liste des CV
- `GET /api/documents/portfolio-links` - Liste des liens portfolio
- `GET /api/documents/{id}/download` - Télécharger document
- `PUT /api/documents/{id}` - Modifier document
- `DELETE /api/documents/{id}` - Supprimer document
- `POST /api/documents/templates` - Créer template LM
- `GET /api/documents/templates/` - Liste templates
- `POST /api/documents/templates/{id}/generate` - Générer LM depuis template
- `POST /api/documents/link-to-application` - Lier document à candidature
- `GET /api/documents/application/{id}` - Documents d'une candidature

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
- [ ] Auto-Fill formulaires candidature (Lever, Greenhouse)
- [ ] Intégration calendrier (Google Calendar, Outlook)
- [ ] Déploiement production (Vercel + MongoDB Atlas)
- [ ] Monétisation (Stripe)

---

## Extension Chrome
- **Dossier:** `/app/chrome-extension/`
- **Fonctionnalités:**
  - Extraction IA automatique des offres d'emploi
  - Support: LinkedIn, Indeed, APEC, Welcome to the Jungle, France Travail
  - Extraction: Entreprise, Poste, Lieu, Salaire, Type contrat, Compétences
- **Configuration:** Options pour URL API et Token JWT

© 2025 MAADEC
