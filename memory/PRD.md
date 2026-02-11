# JobTracker SaaS - Product Requirements Document

## Problème Original
Construire un site web SaaS professionnel V2 pour présenter le projet "Job Tracking". L'objectif est d'impressionner les recruteurs tech en démontrant des compétences en full-stack et ingénierie IA. Le site doit avoir une esthétique moderne, premium, dark-mode, inspirée de Stripe et Vercel.

## Personas Utilisateur
1. **Recruteurs Tech** - Évaluant les capacités techniques du candidat
2. **Hiring Managers** - Recherchant des compétences full-stack & IA
3. **Professionnels Techniques** - Intéressés par l'architecture et l'implémentation

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

## Fonctionnalités Implémentées

### ✅ Phase 1 - Backend (Complété)
- [x] Architecture FastAPI avec routes modulaires
- [x] Modèles Pydantic pour validation
- [x] Authentification JWT complète
- [x] CRUD Candidatures avec pagination
- [x] CRUD Entretiens
- [x] API Statistiques
- [x] API Export (JSON, CSV, Excel)
- [x] Toggle favoris
- [x] Bulk update

### ✅ Phase 2 - Frontend UI (Complété - Février 2025)
- [x] Landing page style SaaS premium
- [x] Navigation avec scroll smooth
- [x] Dashboard avec KPIs temps réel
- [x] Page Candidatures avec cards modernes
- [x] Formulaire création/édition via modal
- [x] Recherche et filtres
- [x] Système de favoris
- [x] Page Statistiques avec graphiques Recharts
- [x] Page Entretiens
- [x] Page Paramètres
- [x] Internationalisation FR/EN
- [x] Design responsive (desktop/tablet/mobile)
- [x] Dark mode premium avec couleurs MAADEC

---

## Tests Validés (11 Février 2025)

### Backend API - 27/27 Tests (100%)
- Health check et version API
- Authentification (login, register, profile)
- CRUD Applications complet
- Toggle favoris
- Recherche et filtres
- Statistiques (timeline, distribution)
- CRUD Entretiens

### Frontend UI - 100% Fonctionnel
- Landing page avec logo MAADEC
- Navigation et language switcher
- Authentification complète
- Dashboard avec KPIs
- CRUD Candidatures via UI
- Recherche et favoris
- Statistiques avec graphiques
- Entretiens et paramètres

---

## Backlog Priorisé

### P0 - Critique (À venir)
- [ ] Gestion complète des entretiens (UI)
- [ ] Export données (Excel, CSV, JSON)
- [ ] Import données

### P1 - Haute Priorité (À venir)
- [ ] Intégration Google Gemini (conseiller IA)
- [ ] Intégration OpenAI GPT (chatbot)
- [ ] Notifications

### P2 - Nice to Have
- [ ] Analyse de CV
- [ ] Animations avancées
- [ ] Mode offline (PWA)

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
│   ├── utils/            # Auth utilities
│   ├── tests/            # Pytest tests
│   ├── config.py
│   └── server.py
├── frontend/
│   ├── src/
│   │   ├── components/ui/  # Shadcn components
│   │   ├── contexts/       # Auth context
│   │   ├── hooks/          # Custom hooks
│   │   ├── i18n/           # Translations
│   │   ├── layouts/        # Dashboard layout
│   │   └── pages/          # All pages
│   └── package.json
└── memory/
    └── PRD.md
```

---

## Notes Techniques
- Le sidebar navigation utilise des éléments statiques (animation framer-motion désactivée pour compatibilité)
- MongoDB exclut `_id` dans toutes les réponses API
- JWT tokens avec expiration configurable
- Internationalisation persistée dans localStorage

---

## Auteur
**MAADEC - MAAD Engineering & Consulting**
Full-Stack & AI Engineering

© 2025 MAADEC - Tous droits réservés.
