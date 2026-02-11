# 🚀 Job Tracking - Site Vitrine SaaS

Un site web professionnel de style SaaS pour présenter le projet **Job Tracking**, une application full-stack intelligente de suivi de candidatures propulsée par l'IA.

![MAADEC Logo](https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png)

## 🎯 Objectif

Positionner MAADEC comme un **Ingénieur Full-Stack & IA** capable de construire des applications web intelligentes prêtes pour la production. Ce site vitrine présente le projet Job Tracking avec un design moderne inspiré de Stripe, Linear et Vercel.

## ✨ Fonctionnalités du Site

### 🌐 Multilingue
- **Français par défaut** avec support Anglais
- Basculement instantané via le sélecteur de langue
- Persistance de la préférence dans localStorage

### 📱 Design Responsive
- Optimisé pour desktop, tablette et mobile
- Menu hamburger pour les écrans mobiles
- Animations fluides et transitions élégantes

### 🎨 Design Premium
- Mode sombre avec couleurs MAADEC (Navy #1a365d, Or #c4a052)
- Effets glassmorphism et cartes flottantes
- Animations au scroll avec Framer Motion
- Typographie moderne (Outfit + Plus Jakarta Sans)

## 📄 Sections du Site

| Section | Description |
|---------|-------------|
| **Hero** | Accroche principale avec mockup du dashboard interactif |
| **Fonctionnalités** | 6 cartes présentant les capacités de l'application |
| **Analytique** | KPIs et visualisation des données avec graphiques |
| **Intelligence IA** | Conseiller de carrière (Gemini Pro) + Chatbot (GPT-3.5) |
| **Architecture** | Diagramme technique et stack technologique |
| **Export de Données** | Formats supportés (Excel, CSV, JSON, PDF) |
| **Sécurité** | Mesures de protection et bonnes pratiques |
| **Deep Dive Technique** | Accordion avec détails d'implémentation |
| **CTA** | Appel à l'action pour contact |
| **Footer** | Liens, réseaux sociaux et informations |

## 🛠️ Stack Technique du Site Vitrine

### Frontend
- **React 19** - Framework UI
- **Tailwind CSS** - Styling utilitaire
- **Framer Motion** - Animations
- **Shadcn/UI** - Composants (Accordion, Button, etc.)
- **Lucide React** - Icônes

### Architecture i18n
```
src/
├── i18n/
│   ├── index.js              # Exports
│   ├── LanguageContext.jsx   # Context React
│   └── translations.js       # Traductions FR/EN
├── pages/
│   └── LandingPage.jsx       # Page principale
└── App.js                    # Point d'entrée
```

## 🖥️ Projet Job Tracking Présenté

### Technologies
| Catégorie | Technologies |
|-----------|--------------|
| **Backend** | Python Flask, SQLAlchemy, SQLite |
| **Frontend** | HTML5, CSS3, Bootstrap 5.3, JavaScript, jQuery |
| **IA** | Google Gemini Pro, OpenAI GPT-3.5 Turbo |
| **Visualisation** | Chart.js |
| **DevOps** | Docker, Docker Compose |
| **Sécurité** | Variables d'environnement .env |

### Fonctionnalités Clés
- ✅ Tableau de bord de suivi des candidatures
- ✅ Système de gestion des entretiens
- ✅ Analytique avancée avec KPIs visuels
- ✅ Conseiller de carrière IA (analyse de CV)
- ✅ Assistant chatbot intelligent
- ✅ Import/Export de données (Excel, CSV, JSON)
- ✅ Architecture conteneurisée Docker

## 🚀 Installation & Démarrage

```bash
# Cloner le repository
git clone <repository-url>
cd job-tracking-showcase

# Installer les dépendances frontend
cd frontend
yarn install

# Démarrer le serveur de développement
yarn start
```

Le site sera accessible sur `http://localhost:3000`

## 📁 Structure du Projet

```
/app
├── frontend/
│   ├── src/
│   │   ├── components/ui/     # Composants Shadcn
│   │   ├── i18n/              # Internationalisation
│   │   ├── pages/             # Pages React
│   │   ├── App.js             # Composant principal
│   │   ├── App.css            # Styles personnalisés
│   │   └── index.css          # Styles globaux + Tailwind
│   ├── package.json
│   └── tailwind.config.js
├── backend/
│   ├── server.py              # API FastAPI
│   └── .env                   # Variables d'environnement
└── README.md
```

## 🎨 Palette de Couleurs

| Couleur | Hex | Usage |
|---------|-----|-------|
| Navy Dark | `#020817` | Arrière-plan principal |
| Navy | `#1a365d` | Éléments d'accent |
| Or | `#c4a052` | Boutons, highlights |
| Or Clair | `#e5c57f` | Hover states |
| Slate | `#94a3b8` | Texte secondaire |

## 🔧 Personnalisation

### Modifier les traductions
Éditez `/frontend/src/i18n/translations.js` pour ajouter ou modifier les textes.

### Ajouter une langue
1. Ajoutez une nouvelle clé dans `translations.js`
2. Dupliquez la structure FR ou EN
3. Traduisez tous les textes

### Changer le logo
Remplacez l'URL du logo dans `LandingPage.jsx` (recherchez `logo_maadec`).

## 📧 Contact

**MAADEC - MAAD Engineering & Consulting**

- 📧 Email: contact@maadec.com
- 🔗 LinkedIn: [À ajouter]
- 💻 GitHub: [À ajouter]

## 📜 Licence

© 2025 MAADEC - MAAD Engineering & Consulting. Tous droits réservés.

---

<p align="center">
  <strong>Construit avec ❤️ par MAADEC</strong><br>
  <em>Full-Stack & AI Engineering</em>
</p>
