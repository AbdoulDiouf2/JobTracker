# JobTracker - Application de Suivi de Candidatures

![JobTracker Logo](frontend/public/Tech-driven_job_tracking_logo_design-removebg-preview.png)

## 🎯 Description

JobTracker est une application SaaS de suivi de candidatures conçue pour aider les chercheurs d'emploi à s'organiser efficacement. Créée par un Data Engineer après avoir envoyé plus de 200 candidatures, cette application offre une approche réaliste : elle ne promet pas de miracle, mais aide ceux qui se donnent les moyens.

## ✨ Fonctionnalités

### 🔐 Authentification
- **Connexion avec Google** (OAuth via Emergent Auth - aucune configuration requise)
- Authentification email/mot de passe classique
- JWT avec expiration configurable

### 📊 Dashboard Intelligent (V2)
- **Job Search Score** : Score composite de 0 à 100
- **Objectif mensuel** : Suivi de progression vers votre objectif
- **Insights IA** : Recommandations basées sur vos données
- **Graphique d'évolution** : Visualisation hebdomadaire de votre activité

### 📝 Gestion des Candidatures
- CRUD complet des candidatures
- Statuts personnalisables (Postulé, Entretien, Offre, Refusé, etc.)
- Filtres et recherche avancés
- Import/Export CSV

### 📅 Suivi des Entretiens
- Calendrier des entretiens
- Rappels automatiques
- Notes de préparation

### 🧠 Conseiller IA
- Analyse de CV
- Suggestions d'amélioration
- Support multi-LLM (Gemini, GPT-4, Groq)

### 🔌 Extension Chrome
- Ajout rapide de candidatures depuis LinkedIn, Indeed, etc.
- Authentification par code ou login direct

### 👨‍💼 Panel Admin
- Gestion des utilisateurs
- Statistiques globales
- Création de comptes utilisateurs

## 🛠️ Stack Technique

### Backend
- **FastAPI** - Framework Python asynchrone
- **MongoDB** - Base de données NoSQL
- **JWT** - Authentification
- **APScheduler** - Tâches planifiées (rappels)

### Frontend
- **React 18** - Framework UI
- **Tailwind CSS** - Styling
- **Shadcn/UI** - Composants
- **Framer Motion** - Animations
- **Recharts** - Graphiques

### Authentification
- **Emergent Auth** - OAuth Google managé (aucune configuration requise)

## 🚀 Installation

### Prérequis
- Node.js 18+
- Python 3.10+
- MongoDB 6+

### Backend

```bash
cd backend

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
.\venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Lancer le serveur
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend

# Installer les dépendances
yarn install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec l'URL du backend

# Lancer le serveur de développement
yarn start
```

## ⚙️ Configuration

### Variables d'environnement Backend (`backend/.env`)

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
JWT_SECRET=votre_secret_jwt_super_long
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

### Variables d'environnement Frontend (`frontend/.env`)

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## 🔐 Authentification Google

L'authentification Google utilise **Emergent Auth**, un service OAuth managé.

### ✅ Ce que tu n'as PAS besoin de faire :
- ❌ Créer un projet Google Cloud
- ❌ Configurer des credentials OAuth
- ❌ Gérer des clés API Google
- ❌ Configurer des URLs de redirect

### ✅ Ce qui fonctionne automatiquement :
- ✅ En local (`localhost:3000`)
- ✅ En production (n'importe quel domaine)
- ✅ L'URL de callback est générée dynamiquement

### Comment ça marche ?
1. L'utilisateur clique sur "Continuer avec Google"
2. Redirection vers `auth.emergentagent.com`
3. L'utilisateur se connecte avec Google
4. Retour vers ton app avec un `session_id`
5. Le backend échange le `session_id` contre les infos utilisateur
6. Un JWT est créé et l'utilisateur est connecté

## 📁 Structure du Projet

```
/app/
├── backend/
│   ├── models/             # Modèles Pydantic
│   ├── routes/
│   │   ├── auth.py         # Auth (email + Google OAuth)
│   │   ├── applications.py # CRUD candidatures
│   │   ├── interviews.py   # Gestion entretiens
│   │   ├── statistics.py   # Dashboard V2
│   │   └── admin.py        # Panel admin
│   ├── utils/
│   │   ├── auth.py         # Helpers JWT
│   │   └── scheduler.py    # Tâches planifiées
│   └── server.py           # Point d'entrée FastAPI
├── frontend/
│   ├── src/
│   │   ├── components/ui/  # Composants Shadcn
│   │   ├── contexts/       # Auth, Refresh contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Pages React
│   │   └── layouts/        # Layouts (Dashboard, Admin)
│   └── public/
└── chrome-extension/       # Extension navigateur
```

## 🧪 Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
yarn test
```

## 📦 Déploiement

### Option 1 : Emergent Platform (Recommandé)
L'application est déjà configurée pour Emergent. Cliquez sur "Deploy" dans l'interface.

### Option 2 : Déploiement Manuel

#### Backend (ex: Railway, Render, Fly.io)
```bash
cd backend
# Configurer les variables d'environnement sur la plateforme
# MONGO_URL, JWT_SECRET, etc.
```

#### Frontend (ex: Vercel, Netlify)
```bash
cd frontend
yarn build
# Déployer le dossier build/
# Configurer REACT_APP_BACKEND_URL
```

### Option 3 : Docker
```bash
docker-compose up -d
```

## 🔑 Comptes de Test

| Type | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@test.com | password123 |
| Standard | demo@test.com | password123 |

## 📝 API Endpoints Principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion email/password |
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/google/session` | Échange session Google |
| GET | `/api/auth/me` | Profil utilisateur |
| GET | `/api/applications` | Liste candidatures |
| POST | `/api/applications` | Créer candidature |
| POST | `/api/statistics/dashboard-v2` | Données dashboard |
| GET | `/api/admin/users` | Liste utilisateurs (admin) |
| POST | `/api/admin/users` | Créer utilisateur (admin) |

## 🤝 Contribution

Les contributions sont les bienvenues ! 

1. Fork le projet
2. Créez une branche (`git checkout -b feature/ma-feature`)
3. Committez (`git commit -m 'Ajout de ma feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrez une Pull Request

## 📄 Licence

MIT License - Voir [LICENSE](LICENSE)

## 👨‍💻 Auteur

**Abdoul** - Data Engineer
- Créé après 200+ candidatures sans organisation claire
- Conçu pour aider ceux qui se donnent les moyens

---

*JobTracker ne promet pas de job miracle, mais aide à rester organisé et à mettre toutes les chances de son côté.*
