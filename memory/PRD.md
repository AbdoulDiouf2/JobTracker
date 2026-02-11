# JobTracker SaaS - Product Requirements Document

## Problème Original
Construire un site web SaaS professionnel V2 pour présenter le projet "Job Tracking". L'objectif est d'impressionner les recruteurs tech en démontrant des compétences en full-stack et ingénierie IA. Le site doit avoir une esthétique moderne, premium, dark-mode, inspirée de Stripe et Vercel.

## Stack Technique

### Backend
| Technologie | Usage |
|-------------|-------|
| FastAPI | Framework API REST |
| MongoDB | Base de données |
| Motor | Driver async MongoDB |
| Pydantic | Validation données |
| JWT | Authentification |
| bcrypt | Hash passwords |
| openpyxl | Export Excel |

### Frontend
| Technologie | Usage |
|-------------|-------|
| React 19 | Framework UI |
| Tailwind CSS | Styling |
| Shadcn/UI | Composants |
| Framer Motion | Animations |
| Recharts | Graphiques |
| React Hook Form | Formulaires |
| Zod | Validation |
| i18next | Internationalisation |

---

## Phases Implémentées

### ✅ Phase 1 - Backend (Complété)
- [x] Architecture FastAPI avec routes modulaires
- [x] Modèles Pydantic pour validation
- [x] Authentification JWT complète
- [x] CRUD Candidatures avec pagination
- [x] CRUD Entretiens
- [x] API Statistiques
- [x] API Export (JSON, CSV, Excel)

### ✅ Phase 2 - Frontend UI (Complété)
- [x] Landing page style SaaS premium
- [x] Dashboard avec KPIs temps réel
- [x] Page Candidatures avec CRUD complet
- [x] Formulaires modal création/édition
- [x] Recherche et filtres
- [x] Système de favoris
- [x] Page Statistiques avec graphiques
- [x] Internationalisation FR/EN
- [x] Design responsive

### ✅ Phase 3 - Fonctionnalités Avancées (Complété - 11 Février 2025)
- [x] **CRUD Entretiens UI complet**
  - Modal création avec sélection candidature
  - Types : RH, Technique, Manager, Final
  - Formats : Téléphone, Visio, Présentiel
  - Indicateur d'urgence (rouge/jaune/bleu)
  - Filtres : Tous / Planifiés / Effectués
- [x] **Export de données**
  - Export JSON avec candidatures + entretiens
  - Export Excel formaté (.xlsx)
  - Export CSV
- [x] **Statistiques entretiens**
  - Compteurs : Planifiés, Effectués, Annulés
  - KPI "Avec entretien" sur dashboard
  - Section "Prochains entretiens" sur dashboard

---

## Tests Validés (11 Février 2025)

### Phase 3 - Backend API : 47/47 Tests (100%)
- CRUD Entretiens complet
- Tous les types et formats d'entretien
- Filtres par statut
- Indicateur d'urgence
- Export JSON/Excel/CSV
- Statistiques entretiens

### Phase 3 - Frontend UI : 100% Fonctionnel
- Modal création entretien
- Cards avec urgence
- Filtres entretiens
- Boutons export
- Stats entretiens

---

## Backlog Priorisé

### P0 - Critique (Prochaine Phase)
- [ ] Intégration Google Gemini (conseiller IA)
- [ ] Intégration OpenAI GPT (chatbot)
- [ ] Interface chatbot dans le dashboard

### P1 - Haute Priorité
- [ ] Import de données (JSON, CSV)
- [ ] Notifications (rappel entretien)
- [ ] Analyse de CV avec IA

### P2 - Nice to Have
- [ ] Calendrier interactif entretiens
- [ ] Mode offline (PWA)
- [ ] Templates de messages

### P3 - Futur
- [ ] Déploiement production
- [ ] CI/CD pipelines
- [ ] Tests E2E automatisés

---

## Credentials de Test
- **Email:** demo@jobtracker.com
- **Password:** Demo123!
- **API URL:** https://career-compass-735.preview.emergentagent.com

---

## Architecture Fichiers

```
/app/
├── backend/
│   ├── models/           # Pydantic models
│   ├── routes/           # API endpoints
│   │   ├── applications.py
│   │   ├── auth.py
│   │   ├── interviews.py
│   │   ├── export.py
│   │   └── statistics.py
│   ├── utils/            # Auth utilities
│   ├── tests/            # Pytest tests
│   ├── config.py
│   └── server.py
├── frontend/
│   ├── src/
│   │   ├── components/ui/  # Shadcn components
│   │   ├── contexts/       # Auth context
│   │   ├── hooks/          # Custom hooks
│   │   │   ├── useApplications.js
│   │   │   ├── useInterviews.js
│   │   │   └── useStatistics.js
│   │   ├── i18n/           # Translations
│   │   ├── layouts/        # Dashboard layout
│   │   └── pages/          # All pages
│   └── package.json
├── memory/
│   └── PRD.md
└── test_reports/
    ├── iteration_2.json
    └── iteration_3.json
```

---

## Endpoints API

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur

### Candidatures
- `GET /api/applications` - Liste paginée
- `POST /api/applications` - Créer
- `GET /api/applications/{id}` - Détail
- `PUT /api/applications/{id}` - Modifier
- `DELETE /api/applications/{id}` - Supprimer
- `POST /api/applications/{id}/favorite` - Toggle favori

### Entretiens
- `GET /api/interviews` - Liste avec filtres
- `POST /api/interviews` - Créer
- `GET /api/interviews/{id}` - Détail
- `PUT /api/interviews/{id}` - Modifier
- `DELETE /api/interviews/{id}` - Supprimer
- `GET /api/interviews/upcoming` - Prochains entretiens

### Export
- `GET /api/export/json` - Export JSON
- `GET /api/export/csv` - Export CSV
- `GET /api/export/excel` - Export Excel

### Statistiques
- `GET /api/statistics/dashboard` - KPIs
- `GET /api/statistics/overview` - Vue complète
- `GET /api/statistics/timeline` - Évolution temporelle

---

## Auteur
**MAADEC - MAAD Engineering & Consulting**
Full-Stack & AI Engineering

© 2025 MAADEC - Tous droits réservés.
