# JobTracker SaaS - Product Requirements Document

## Problème Original
Application SaaS de suivi de candidatures avec intégration IA pour impressionner les recruteurs tech.

## Stack Technique
- **Backend:** FastAPI, MongoDB, JWT, emergentintegrations
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI, Recharts
- **IA:** Google Gemini 2.5 Flash, OpenAI GPT-4o

---

## ✅ Toutes les Phases Complétées (11 Février 2025)

### Phase 1-2: Core
- CRUD Candidatures et Entretiens
- Authentification JWT
- Dashboard avec KPIs
- Internationalisation FR/EN

### Phase 3: Fonctionnalités Avancées
- Calendrier interactif entretiens
- Vue carte/table candidatures
- Changement de statut via dropdown
- Vue détaillée (modal)
- Export Excel/JSON/CSV

### Phase 4: Intégration IA
- Conseiller Carrière (Gemini)
- Assistant Chatbot (GPT-4o)
- Interface chat avec suggestions

### Phase 5: Import/Export & Analyse CV
- Import JSON/CSV avec prévisualisation
- Guide des colonnes attendues
- Analyse CV IA (score, compétences, recommandations)

### Phase 6: Notifications (NOUVEAU)
- 🔔 Cloche de notification dans le header
- ⚙️ Paramètres de notification dans Settings
- 📅 Rappels automatiques 24h et 1h avant entretien
- ✅ Sidebar fixe (ne scroll plus avec la page)

---

## APIs Disponibles

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
- **URL:** https://career-compass-735.preview.emergentagent.com

---

## Backlog Futur
- [ ] Notifications push (PWA)
- [ ] Mode offline
- [ ] Déploiement production

© 2025 MAADEC
