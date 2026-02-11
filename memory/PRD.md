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
- Changement statut via dropdown
- Vue détaillée (modal)
- Export Excel/JSON/CSV

### Phase 4: Intégration IA
- Conseiller Carrière (Gemini)
- Assistant Chatbot (GPT-4o)
- Interface chat avec suggestions

### Phase 5: Import/Export & Analyse CV
- **Import JSON/CSV** - Importer candidatures en masse
- **Export** - JSON, Excel, CSV
- **Analyse CV IA** - Score, compétences, points forts, améliorations, postes recommandés

---

## APIs Disponibles

### Import/Export
- `POST /api/import/json` - Import JSON
- `POST /api/import/csv` - Import CSV
- `POST /api/import/analyze-cv` - Analyse CV IA
- `GET /api/import/cv-history` - Historique analyses

### IA
- `POST /api/ai/career-advisor` - Conseiller (Gemini)
- `POST /api/ai/chatbot` - Chatbot (GPT-4o)

---

## Credentials
- **Email:** demo@jobtracker.com
- **Password:** Demo123!
- **URL:** https://career-compass-735.preview.emergentagent.com

---

## Backlog Futur
- [ ] Notifications rappel entretien
- [ ] Mode offline (PWA)
- [ ] Déploiement production

© 2025 MAADEC
