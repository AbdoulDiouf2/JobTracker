# 🚀 JobTracker SaaS

Application full-stack moderne de suivi de candidatures avec intelligence artificielle.

![MAADEC Logo](https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png)

## 🎯 Présentation

**JobTracker SaaS** est une plateforme complète qui permet aux chercheurs d'emploi de :
- 📋 Gérer leurs candidatures de manière centralisée
- 📅 Planifier et suivre leurs entretiens
- 📊 Analyser leurs performances avec des statistiques détaillées
- 🤖 Obtenir des conseils personnalisés grâce à l'IA (à venir)

---

## 🏗️ Architecture

```
jobtracker-saas/
├── backend/                 # API FastAPI
│   ├── models/              # Modèles Pydantic
│   ├── routes/              # Endpoints API
│   ├── utils/               # Utilitaires (auth, etc.)
│   ├── config.py            # Configuration
│   ├── server.py            # Point d'entrée
│   └── README.md            # Documentation backend
│
├── frontend/                # Application React
│   ├── src/
│   │   ├── components/ui/   # Composants Shadcn
│   │   ├── contexts/        # Contextes React (Auth)
│   │   ├── hooks/           # Hooks personnalisés
│   │   ├── i18n/            # Internationalisation
│   │   ├── layouts/         # Layouts (Dashboard)
│   │   └── pages/           # Pages de l'application
│   └── README.md            # Documentation frontend
│
└── README.md                # Ce fichier
```

---

## 🛠️ Stack Technique

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

---

## ✨ Fonctionnalités

### ✅ Implémentées

#### Authentification
- Inscription / Connexion
- JWT avec expiration
- Profil utilisateur
- Gestion clés API

#### Candidatures
- CRUD complet
- Recherche et filtres
- Système de favoris
- Mise à jour en masse
- Pagination

#### Entretiens
- CRUD complet
- Types : RH, Technique, Manager, Final
- Formats : Téléphone, Visio, Présentiel
- Statuts : Planifié, Effectué, Annulé
- Countdown avec urgence

#### Statistiques
- Dashboard KPIs
- Évolution temporelle
- Répartition par statut/type/méthode
- Taux de réponse
- Stats entretiens

#### Export
- JSON
- CSV
- Excel formaté

#### Interface
- Design dark mode premium
- Multilingue FR/EN
- Responsive (desktop/tablet/mobile)
- Animations fluides

### 🔜 À venir (Phase 3)
- Conseiller IA (Google Gemini)
- Chatbot IA (OpenAI GPT)
- Analyse de CV
- Import de données
- Notifications

---

## 🚀 Installation

### Prérequis
- Python 3.8+
- Node.js 18+
- MongoDB

### Backend
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

### Variables d'environnement

**Backend** (`backend/.env`)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
JWT_SECRET=your-secret-key
```

**Frontend** (`frontend/.env`)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 📸 Captures d'écran

### Landing Page
Page vitrine moderne style SaaS avec sections :
- Hero avec mockup dashboard
- Fonctionnalités
- Analytics
- Intelligence IA
- Architecture
- Export données
- Sécurité

### Dashboard
- KPIs en temps réel
- Prochains entretiens
- Candidatures récentes

### Candidatures
- Cards avec statut, type, favori
- Recherche et filtres
- Modal création/édition

### Statistiques
- Graphiques interactifs (Recharts)
- Export Excel/JSON

---

## 🎨 Design

### Palette de couleurs
| Couleur | Hex | Usage |
|---------|-----|-------|
| Navy Dark | `#020817` | Background principal |
| Navy | `#1a365d` | Éléments d'accent |
| Gold | `#c4a052` | Boutons, highlights |
| Gold Light | `#e5c57f` | Hover states |

### Typographie
- **Outfit** : Titres
- **Plus Jakarta Sans** : Corps
- **JetBrains Mono** : Code

---

## 📖 Documentation

- [📘 Documentation Backend](./backend/README.md)
- [📗 Documentation Frontend](./frontend/README.md)

---

## 👤 Auteur

**MAADEC - MAAD Engineering & Consulting**

Ingénieur Full-Stack & IA spécialisé dans la création d'applications web intelligentes.

---

## 📜 Licence

© 2025 MAADEC - Tous droits réservés.

---

<p align="center">
  <strong>Construit avec ❤️ par MAADEC</strong><br>
  <em>Full-Stack & AI Engineering</em>
</p>
