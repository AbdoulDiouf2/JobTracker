# JobTracker SaaS - Product Requirements Document

## Problème Original
Construire un site web SaaS professionnel V2 pour présenter le projet "Job Tracking" avec intégration IA.

## Stack Technique
- **Backend:** FastAPI, MongoDB, JWT, emergentintegrations
- **Frontend:** React 19, Tailwind CSS, Shadcn/UI, Recharts
- **IA:** Google Gemini (conseiller), OpenAI GPT-4o (chatbot)

---

## Phases Complétées

### ✅ Phase 1-2 - Backend & Frontend Core
- CRUD Candidatures et Entretiens
- Authentification JWT
- Dashboard avec KPIs
- Internationalisation FR/EN

### ✅ Phase 3 - Fonctionnalités Avancées (11 Février 2025)
- Calendrier interactif entretiens
- Vue carte/table pour candidatures
- Changement de statut via dropdown
- Vue détaillée (modal)
- Export Excel/JSON/CSV

### ✅ Phase 4 - Intégration IA (11 Février 2025)
- **Conseiller Carrière** (Gemini) - Analyse candidatures et conseils personnalisés
- **Assistant Chatbot** (GPT-4o) - Aide CV, entretiens, négociation
- Interface chat avec suggestions
- Historique conversations MongoDB

---

## Backlog

### P1 - Haute Priorité
- [ ] Import de données (JSON, CSV)
- [ ] Notifications rappel entretien

### P2 - Nice to Have
- [ ] Analyse de CV avec IA
- [ ] Mode offline (PWA)

### P3 - Futur
- [ ] Déploiement production
- [ ] CI/CD pipelines

---

## Credentials
- **Email:** demo@jobtracker.com
- **Password:** Demo123!
- **URL:** https://career-compass-735.preview.emergentagent.com

---

## API Endpoints

### IA
- `POST /api/ai/career-advisor` - Conseiller carrière (Gemini)
- `POST /api/ai/chatbot` - Chatbot assistant (GPT-4o)
- `GET /api/ai/chat-history/{session_id}` - Historique
- `GET /api/ai/chat-sessions` - Liste sessions
- `DELETE /api/ai/chat-session/{session_id}` - Supprimer

---

© 2025 MAADEC - Tous droits réservés.
