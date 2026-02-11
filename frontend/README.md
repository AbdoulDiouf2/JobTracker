# 🎨 JobTracker SaaS - Frontend

Application React moderne pour le suivi de candidatures.

## 📋 Stack Technique

| Technologie | Usage |
|-------------|-------|
| **React 19** | Framework UI |
| **React Router** | Navigation SPA |
| **Tailwind CSS** | Styling utilitaire |
| **Shadcn/UI** | Composants (Radix UI) |
| **Framer Motion** | Animations |
| **Recharts** | Graphiques |
| **React Hook Form** | Formulaires |
| **Zod** | Validation |
| **Axios** | Requêtes HTTP |
| **Lucide React** | Icônes |
| **date-fns** | Manipulation dates |

## 🗂️ Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/              # Composants Shadcn
│   ├── contexts/
│   │   └── AuthContext.jsx  # Gestion auth & JWT
│   ├── hooks/
│   │   ├── useApplications.js
│   │   ├── useInterviews.js
│   │   └── useStatistics.js
│   ├── i18n/
│   │   ├── translations.js  # Traductions FR/EN
│   │   └── LanguageContext.jsx
│   ├── layouts/
│   │   └── DashboardLayout.jsx  # Layout avec sidebar
│   ├── pages/
│   │   ├── LandingPage.jsx      # Page vitrine
│   │   ├── LoginPage.jsx        # Connexion
│   │   ├── RegisterPage.jsx     # Inscription
│   │   ├── DashboardPage.jsx    # Tableau de bord
│   │   ├── ApplicationsPage.jsx # Liste candidatures
│   │   ├── InterviewsPage.jsx   # Gestion entretiens
│   │   ├── StatisticsPage.jsx   # Graphiques & stats
│   │   └── SettingsPage.jsx     # Paramètres
│   ├── App.js
│   ├── App.css
│   └── index.css
├── public/
├── package.json
└── tailwind.config.js
```

## 🛣️ Routes

| Route | Page | Protection |
|-------|------|------------|
| `/` | Landing Page | Public |
| `/login` | Connexion | Public |
| `/register` | Inscription | Public |
| `/dashboard` | Tableau de bord | 🔒 Auth |
| `/dashboard/applications` | Candidatures | 🔒 Auth |
| `/dashboard/interviews` | Entretiens | 🔒 Auth |
| `/dashboard/statistics` | Statistiques | 🔒 Auth |
| `/dashboard/settings` | Paramètres | 🔒 Auth |

## ✨ Fonctionnalités

### 🏠 Dashboard
- KPIs en temps réel (total, en attente, avec entretien, taux de réponse)
- Prochains entretiens avec countdown et urgence
- Candidatures récentes

### 📋 Candidatures
- Liste avec cards modernes
- Recherche full-text (entreprise, poste)
- Filtres par statut, type, méthode
- Système de favoris (étoile)
- Création/édition via modal
- Pagination
- Suppression avec confirmation

### 📅 Entretiens
- Liste avec indicateur d'urgence (rouge/jaune/bleu)
- Countdown temps restant
- Filtres : Tous / Planifiés / Effectués
- Liaison automatique à la candidature

### 📊 Statistiques
- Graphique évolution temporelle (LineChart)
- Répartition par statut (PieChart)
- Répartition par type de poste (BarChart)
- Répartition par moyen de candidature (PieChart)
- Stats entretiens (planifiés, effectués, annulés)
- Export Excel / JSON

### ⚙️ Paramètres
- Modification du profil
- Configuration clés API (Google AI, OpenAI)
- Changement de langue FR/EN

## 🌐 Internationalisation

Support complet **Français** (défaut) et **Anglais** :
- Toutes les pages et composants traduits
- Persistance dans localStorage
- Switch instantané

## 🎨 Design System

### Couleurs
| Couleur | Hex | Usage |
|---------|-----|-------|
| Navy Dark | `#020817` | Background |
| Navy | `#1a365d` | Accents |
| Gold | `#c4a052` | Primary, CTA |
| Gold Light | `#e5c57f` | Hover |

### Typographie
- **Outfit** : Titres (font-heading)
- **Plus Jakarta Sans** : Corps (font-body)
- **JetBrains Mono** : Code

### Composants Shadcn
- Button, Input, Dialog, Select
- Accordion, Card, Badge
- Tooltip, Dropdown

## ⚙️ Configuration

### Variables d'environnement (`.env`)

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 🚀 Installation

```bash
cd frontend

# Installer les dépendances
yarn install

# Lancer en développement
yarn start

# Build production
yarn build
```

## 📱 Responsive

- ✅ Desktop : Sidebar fixe
- ✅ Tablet : Sidebar collapse
- ✅ Mobile : Menu hamburger + drawer
