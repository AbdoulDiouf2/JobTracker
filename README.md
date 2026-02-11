# JobTracker SaaS 🚀

Application SaaS complète de suivi de candidatures avec intelligence artificielle, développée pour démontrer des compétences en Full-Stack et AI Engineering.

![Version](https://img.shields.io/badge/version-2.0-gold)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🎯 Fonctionnalités

### Gestion des Candidatures
- ✅ CRUD complet (créer, lire, modifier, supprimer)
- ✅ Vue carte et vue tableau
- ✅ Système de favoris
- ✅ Recherche et filtres par statut
- ✅ Changement de statut via dropdown

### Gestion des Entretiens
- ✅ CRUD complet avec liaison aux candidatures
- ✅ Calendrier interactif mensuel
- ✅ Indicateurs d'urgence (24h, 1h)
- ✅ Types : RH, Technique, Manager, Final
- ✅ Formats : Téléphone, Visio, Présentiel

### Intelligence Artificielle
- ✅ **Conseiller Carrière** (Google Gemini) - Analyse et conseils personnalisés
- ✅ **Assistant Chatbot** (OpenAI GPT-4o) - Aide CV, entretiens, négociation
- ✅ **Analyse de CV** - Score, compétences, recommandations, postes suggérés

### Import/Export
- ✅ Import JSON et CSV avec prévisualisation
- ✅ Guide des colonnes attendues
- ✅ Export Excel, JSON, CSV

### Notifications
- ✅ Cloche de notification avec compteur
- ✅ Rappels automatiques 24h et 1h avant entretien
- ✅ Paramètres personnalisables

### Interface
- ✅ Design dark mode premium (style Stripe/Vercel)
- ✅ Sidebar fixe avec navigation intuitive
- ✅ Internationalisation FR/EN
- ✅ Responsive (desktop, tablet, mobile)
- ✅ Statistiques avec graphiques Recharts

---

## 🛠 Stack Technique

### Backend
| Technologie | Usage |
|-------------|-------|
| FastAPI | Framework API REST async |
| MongoDB | Base de données NoSQL |
| Motor | Driver async MongoDB |
| Pydantic | Validation des données |
| JWT | Authentification |
| bcrypt | Hash des mots de passe |
| emergentintegrations | Intégration LLM |
| openpyxl | Export Excel |

### Frontend
| Technologie | Usage |
|-------------|-------|
| React 19 | Framework UI |
| Tailwind CSS | Styling utility-first |
| Shadcn/UI | Composants accessibles |
| Framer Motion | Animations fluides |
| Recharts | Graphiques interactifs |
| React Hook Form | Gestion des formulaires |
| Zod | Validation côté client |
| i18next | Internationalisation |
| Axios | Client HTTP |
| date-fns | Manipulation des dates |

---

## 📁 Structure du Projet

```
/app/
├── backend/
│   ├── models/              # Modèles Pydantic
│   ├── routes/              # Endpoints API
│   │   ├── applications.py  # CRUD candidatures
│   │   ├── auth.py          # Authentification
│   │   ├── interviews.py    # CRUD entretiens
│   │   ├── statistics.py    # Statistiques
│   │   ├── export.py        # Export données
│   │   ├── ai.py            # IA (Gemini, GPT)
│   │   ├── data_import.py   # Import + Analyse CV
│   │   └── notifications.py # Notifications
│   ├── utils/               # Utilitaires
│   ├── config.py            # Configuration
│   ├── server.py            # Point d'entrée
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── contexts/        # Contextes React
│   │   ├── hooks/           # Hooks personnalisés
│   │   ├── i18n/            # Traductions
│   │   ├── layouts/         # Layouts
│   │   └── pages/           # Pages
│   └── package.json
└── memory/
    └── PRD.md
```

---

## 🚀 Installation

### Prérequis
- Python 3.11+
- Node.js 18+
- MongoDB 6+

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configurer les variables
uvicorn server:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

---

## 🔑 Variables d'Environnement

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
JWT_SECRET=your-secret-key
EMERGENT_LLM_KEY=sk-emergent-xxx  # Pour IA
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 📊 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil

### Candidatures
- `GET /api/applications` - Liste paginée
- `POST /api/applications` - Créer
- `PUT /api/applications/{id}` - Modifier
- `DELETE /api/applications/{id}` - Supprimer
- `POST /api/applications/{id}/favorite` - Toggle favori

### Entretiens
- `GET /api/interviews` - Liste
- `POST /api/interviews` - Créer
- `PUT /api/interviews/{id}` - Modifier
- `DELETE /api/interviews/{id}` - Supprimer

### IA
- `POST /api/ai/career-advisor` - Conseiller (Gemini)
- `POST /api/ai/chatbot` - Chatbot (GPT-4o)

### Import/Export
- `POST /api/import/json` - Import JSON
- `POST /api/import/csv` - Import CSV
- `POST /api/import/analyze-cv` - Analyse CV
- `GET /api/export/json` - Export JSON
- `GET /api/export/excel` - Export Excel
- `GET /api/export/csv` - Export CSV

### Notifications
- `GET /api/notifications` - Liste
- `GET /api/notifications/settings` - Paramètres
- `PUT /api/notifications/settings` - Modifier paramètres

---

## 🔐 Credentials de Test

- **Email:** demo@jobtracker.com
- **Password:** Demo123!

---

## 📄 Licence

MIT © 2025 MAADEC - MAAD Engineering & Consulting

---

## 👨‍💻 Auteur

**MAADEC**  
Full-Stack & AI Engineering  
[Logo MAADEC](https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png)
