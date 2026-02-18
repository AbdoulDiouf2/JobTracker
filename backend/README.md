# Backend - JobTracker API

API FastAPI pour l'application JobTracker.

## 🚀 Démarrage Rapide

```bash
# Installation
pip install -r requirements.txt

# Variables d'environnement
cp .env.example .env

# Lancer le serveur
uvicorn server:app --reload --port 8001
```

## ⚙️ Configuration (.env)

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker

# JWT
JWT_SECRET=votre_secret_super_long_et_securise
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 jours

# Optionnel - Clés IA (peuvent être ajoutées par utilisateur)
# GOOGLE_AI_KEY=
# OPENAI_KEY=
# GROQ_KEY=
```

## 📁 Structure

```
backend/
├── models/
│   └── __init__.py      # Modèles Pydantic
├── routes/
│   ├── auth.py          # Authentification (email + Google OAuth)
│   ├── applications.py  # CRUD candidatures
│   ├── interviews.py    # Gestion entretiens
│   ├── statistics.py    # Dashboard V2
│   ├── ai_advisor.py    # Conseiller IA
│   ├── documents.py     # Gestion documents
│   └── admin.py         # Panel admin
├── utils/
│   ├── auth.py          # Helpers JWT
│   └── scheduler.py     # Rappels automatiques
├── config.py            # Configuration
├── server.py            # Point d'entrée
└── requirements.txt
```

## 🔐 Authentification

### Email/Password
```bash
# Inscription
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password123","full_name":"Test User"}'

# Connexion
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password123"}'
```

### Google OAuth (Emergent Auth)
```bash
# Échange session_id contre JWT
curl -X POST http://localhost:8001/api/auth/google/session \
  -H "Content-Type: application/json" \
  -d '{"session_id":"abc123..."}'
```

**Note** : L'authentification Google utilise Emergent Auth. Aucune configuration Google Cloud n'est requise.

## 📝 Endpoints Principaux

### Auth
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/google/session` | OAuth Google |
| GET | `/api/auth/me` | Profil courant |
| PUT | `/api/auth/update-profile` | Mise à jour profil |

### Applications
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/applications` | Liste (pagination, filtres) |
| POST | `/api/applications` | Créer |
| GET | `/api/applications/{id}` | Détail |
| PUT | `/api/applications/{id}` | Modifier |
| DELETE | `/api/applications/{id}` | Supprimer |

### Statistics
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/statistics/dashboard-v2` | Données dashboard complet |
| GET | `/api/statistics/overview` | Statistiques générales |

### Admin
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/dashboard` | Stats admin |
| GET | `/api/admin/users` | Liste utilisateurs |
| POST | `/api/admin/users` | Créer utilisateur |
| PUT | `/api/admin/users/{id}` | Modifier utilisateur |

## 🧪 Tests

```bash
# Lancer les tests
pytest

# Avec couverture
pytest --cov=.
```

## 📦 Déploiement

### Variables d'environnement requises
- `MONGO_URL` - URI MongoDB (Atlas ou self-hosted)
- `JWT_SECRET` - Secret pour signer les JWT
- `DB_NAME` - Nom de la base de données

### Plateformes recommandées
- Railway
- Render
- Fly.io
- Google Cloud Run

### Docker
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```
