# JobTracker Frontend 🎨

Interface utilisateur React pour l'application JobTracker SaaS.

## 🛠 Technologies

- **React 19** - Framework UI moderne
- **Tailwind CSS** - Styling utility-first
- **Shadcn/UI** - Composants accessibles et personnalisables
- **Framer Motion** - Animations fluides
- **Recharts** - Graphiques interactifs
- **React Router v6** - Navigation SPA
- **React Hook Form + Zod** - Formulaires validés
- **i18next** - Internationalisation (FR/EN)
- **Axios** - Client HTTP
- **date-fns** - Manipulation des dates

## 📁 Structure

```
frontend/src/
├── components/
│   ├── ui/                   # Composants Shadcn/UI
│   │   ├── button.jsx
│   │   ├── input.jsx
│   │   ├── dialog.jsx
│   │   ├── select.jsx
│   │   ├── switch.jsx
│   │   ├── progress.jsx
│   │   └── ...
│   └── NotificationBell.jsx  # Cloche de notifications
├── contexts/
│   └── AuthContext.jsx       # Contexte authentification
├── hooks/
│   ├── useApplications.js    # Hook candidatures
│   ├── useInterviews.js      # Hook entretiens
│   └── useStatistics.js      # Hook statistiques
├── i18n/
│   └── index.js              # Configuration i18next
├── layouts/
│   └── DashboardLayout.jsx   # Layout dashboard (sidebar fixe)
├── pages/
│   ├── LandingPage.jsx       # Page d'accueil
│   ├── LoginPage.jsx         # Connexion
│   ├── RegisterPage.jsx      # Inscription
│   ├── DashboardPage.jsx     # Tableau de bord
│   ├── ApplicationsPage.jsx  # Candidatures (carte/table)
│   ├── InterviewsPage.jsx    # Entretiens (liste/calendrier)
│   ├── StatisticsPage.jsx    # Statistiques + Export
│   ├── AIAdvisorPage.jsx     # Assistant IA
│   ├── ImportExportPage.jsx  # Import/Export + Analyse CV
│   └── SettingsPage.jsx      # Paramètres + Notifications
├── App.js                    # Routes principales
├── App.css                   # Styles globaux
└── index.js                  # Point d'entrée
```

## 🚀 Installation

```bash
# Installer les dépendances
yarn install

# Configurer l'environnement
cp .env.example .env

# Lancer en développement
yarn start

# Build production
yarn build
```

## ⚙️ Configuration (.env)

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 📄 Pages

### 🏠 Landing Page (`/`)
- Hero section avec CTA
- Fonctionnalités clés
- Logo MAADEC

### 🔐 Authentification (`/login`, `/register`)
- Formulaires avec validation
- Redirection automatique

### 📊 Dashboard (`/dashboard`)
- KPIs temps réel (candidatures, taux de réponse)
- Candidatures récentes
- Prochains entretiens

### 📋 Candidatures (`/dashboard/applications`)
- Vue carte (défaut) et vue tableau
- Recherche et filtres
- Création/édition via modal
- Changement de statut via dropdown
- Système de favoris

### 📅 Entretiens (`/dashboard/interviews`)
- Vue liste avec cards
- Vue calendrier interactif
- Indicateurs d'urgence (couleurs)
- Filtres : Tous, Planifiés, Effectués

### 📈 Statistiques (`/dashboard/statistics`)
- Graphiques Recharts :
  - Évolution temporelle (LineChart)
  - Répartition par statut (PieChart)
  - Par type de poste (BarChart)
- Boutons export (Excel, JSON, CSV)

### 🤖 Assistant IA (`/dashboard/ai-advisor`)
- Conseiller Carrière (Gemini) - Analyse candidatures
- Assistant Chatbot (GPT-4o) - Aide générale
- Suggestions de questions
- Historique conversations

### 📥 Import/Export (`/dashboard/import-export`)
- Import JSON/CSV avec :
  - Guide des colonnes (dépliable)
  - Prévisualisation avant import
- Export multi-format
- Analyse CV IA :
  - Score global
  - Compétences détectées
  - Points forts / Améliorations
  - Postes recommandés

### ⚙️ Paramètres (`/dashboard/settings`)
- Profil utilisateur
- Notifications :
  - Rappel 24h avant entretien
  - Rappel 1h avant entretien
  - Notifications navigateur
- Clés API (Google AI, OpenAI)
- Changement de langue (FR/EN)

## 🎨 Design System

### Couleurs
```css
--gold: #C9A227        /* Accent principal */
--gold-light: #D4B84A  /* Accent hover */
--navy: #1a1f2e        /* Fond secondaire */
--bg-dark: #020817     /* Fond principal */
```

### Composants Shadcn/UI
Tous les composants sont dans `/src/components/ui/` :
- Button, Input, Select
- Dialog, DropdownMenu
- Switch, Progress
- Sonner (toasts)

## 🌐 Internationalisation

Langues supportées : **Français** (défaut), **Anglais**

```jsx
import { useLanguage } from '../i18n';

const { language, toggleLanguage } = useLanguage();

const t = {
  fr: { title: 'Bonjour' },
  en: { title: 'Hello' }
}[language];
```

## 🧪 Tests

```bash
# Lancer les tests
yarn test

# Coverage
yarn test --coverage
```

---

© 2025 MAADEC - MAAD Engineering & Consulting
