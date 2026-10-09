# JobTracker - Guide de Développement

Ce fichier contient les informations essentielles pour travailler sur le projet JobTracker.

## 🎯 Vision du Projet
JobTracker n'est pas un simple tableau de bord, c'est un **Agent de Carrière Personnel** qui centralise les candidatures, utilise l'IA pour le matching CV/Offre, et automatise les relances.

## 🚀 Commandes de démarrage

### Backend (FastAPI)
```bash
cd backend
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Lancer le serveur
uvicorn server:app --reload --port 8001
```

### Frontend (React)
```bash
cd frontend
yarn start
```

### Extension Chrome
```bash
cd chrome-extension
# Charger le dossier en mode développeur dans Chrome
```
**Lien publié** : [JobTracker Clipper - Chrome Web Store](https://chromewebstore.google.com/detail/jobtracker-clipper/ephlbjlapgadbjjpongcmniokflciidl?pli=1)

## 🧪 Tests & Qualité
- **Backend** : `cd backend && bash tests/run_mongo_tests.sh` (MongoDB éphémère via Docker ; `pytest` seul ignore les tests qui nécessitent une base)
- **Frontend** : `cd frontend && CI=true yarn test --watchAll=false`
- **Linting** : pas de script `yarn lint` ; ESLint (`react-hooks`) est appliqué par `craco` au build

## 🛠 Stack Technique
- **Frontend** : React 19, Tailwind CSS, Shadcn UI, Framer Motion, Recharts, Lucide React, Sonner (toasts).
- **Backend** : FastAPI, MongoDB (Motor), Pydantic v2, Python 3.10+.
- **Auth** : JWT de session, Google OAuth (connexion utilisateur) ; serveur OAuth 2.1 + MCP pour les agents (voir `Doc/OAUTH.md`).
- **IA** : Multi-provider (OpenAI, Google Gemini, Groq).

## 📚 Documentation
Référence : `Doc/README.md` (architecture, MCP, OAuth, veille, sécurité, exploitation). Documents historiques : `Doc/archives/`.

## 📁 Structure du Projet
- `backend/` : API FastAPI, modèles Pydantic, services IA.
- `frontend/` : Application React (basée sur create-react-app).
- `chrome-extension/` : Extension pour clipper les offres d'emploi.
- `landing-page/` : Site vitrine.

## 🎨 Directives de Design (Extraites de design_guidelines.json)
- **Esthétique** : Dark Mode par défaut, style "Linear", Glassmorphism, Bento Grids.
- **Couleurs** : 
  - Primary (Or) : `#c4a052` (à utiliser avec parcimonie pour les actions importantes).
  - Background : `#020817` / Surface : `#0f172a`.
- **Typographie** : Outfit (Headings), Plus Jakarta Sans (Body), JetBrains Mono (Code).
- **Interactions** : Toujours ajouter des micro-animations (hover states, transitions). Éviter `transition: all`.

## 📏 Normes de Code
- **React Components** : Utiliser des **named exports** (`export const Component = ...`).
- **React Pages** : Utiliser des **default exports** (`export default function Page() ...`).
- **Composants UI** : Prioriser l'utilisation des composants dans `src/components/ui` (Shadcn).
- **Toasts** : Utiliser `sonner`.
- **Backend** : Utiliser des modèles Pydantic pour la validation. Respecter le typage Python.
- **Données** : Ajouter `data-testid` sur les éléments interactifs pour les tests.
- **Icônes** : Utiliser `lucide-react`. **Interdiction** d'utiliser des Emojis comme icônes dans l'UI.
