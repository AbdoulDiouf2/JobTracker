# JobTracker Backend API 🔧

API REST FastAPI pour l'application JobTracker SaaS.

## 🛠 Technologies

- **FastAPI** - Framework async haute performance
- **MongoDB** - Base de données NoSQL (via Motor)
- **Pydantic** - Validation et sérialisation
- **JWT** - Authentification sécurisée
- **bcrypt** - Hash des mots de passe
- **emergentintegrations** - Intégration Google Gemini & OpenAI
- **openpyxl** - Export Excel

## 📁 Structure

```
backend/
├── models/
│   ├── user.py           # Modèle utilisateur
│   ├── application.py    # Modèle candidature
│   └── interview.py      # Modèle entretien
├── routes/
│   ├── auth.py           # Authentification (register, login, profile)
│   ├── applications.py   # CRUD candidatures
│   ├── interviews.py     # CRUD entretiens
│   ├── statistics.py     # Statistiques dashboard
│   ├── export.py         # Export JSON/CSV/Excel
│   ├── ai.py             # IA (Gemini, GPT-4o)
│   ├── data_import.py    # Import JSON/CSV + Analyse CV
│   └── notifications.py  # Système de notifications
├── utils/
│   └── auth.py           # Utilitaires JWT
├── config.py             # Configuration centralisée
├── server.py             # Point d'entrée FastAPI
└── requirements.txt      # Dépendances Python
```

## 🚀 Installation

```bash
# Créer environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Installer dépendances
pip install -r requirements.txt

# Configurer variables d'environnement
cp .env.example .env

# Lancer le serveur
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

## ⚙️ Configuration (.env)

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
JWT_SECRET=your-super-secret-key
CORS_ORIGINS=*
EMERGENT_LLM_KEY=sk-emergent-xxx
```

## 📊 Endpoints API

### 🔐 Authentification (`/api/auth`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/register` | Créer un compte |
| POST | `/login` | Se connecter |
| GET | `/me` | Profil utilisateur |
| PUT | `/update-profile` | Modifier profil |
| PUT | `/update-api-keys` | Modifier clés API |

### 📋 Candidatures (`/api/applications`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste paginée avec filtres |
| POST | `/` | Créer une candidature |
| GET | `/{id}` | Détails d'une candidature |
| PUT | `/{id}` | Modifier une candidature |
| DELETE | `/{id}` | Supprimer une candidature |
| POST | `/{id}/favorite` | Toggle favori |
| PUT | `/bulk-update` | Mise à jour en masse |

### 📅 Entretiens (`/api/interviews`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste avec filtres |
| POST | `/` | Créer un entretien |
| GET | `/{id}` | Détails d'un entretien |
| PUT | `/{id}` | Modifier un entretien |
| DELETE | `/{id}` | Supprimer un entretien |
| GET | `/upcoming` | Prochains entretiens |

### 📈 Statistiques (`/api/statistics`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/dashboard` | KPIs dashboard |
| GET | `/overview` | Vue complète |
| GET | `/timeline` | Évolution temporelle |

### 📤 Export (`/api/export`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/json` | Export JSON |
| GET | `/csv` | Export CSV |
| GET | `/excel` | Export Excel (.xlsx) |

### 📥 Import (`/api/import`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/json` | Import depuis JSON |
| POST | `/csv` | Import depuis CSV |
| POST | `/analyze-cv` | Analyse CV avec IA |
| GET | `/cv-history` | Historique analyses CV |

### 🤖 IA (`/api/ai`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/career-advisor` | Conseiller carrière (Gemini) |
| POST | `/chatbot` | Assistant chatbot (GPT-4o) |
| GET | `/chat-history/{session_id}` | Historique conversation |
| GET | `/chat-sessions` | Liste des sessions |
| DELETE | `/chat-session/{session_id}` | Supprimer session |

### 🔔 Notifications (`/api/notifications`)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste des notifications |
| GET | `/settings` | Paramètres notifications |
| PUT | `/settings` | Modifier paramètres |
| PUT | `/{id}/read` | Marquer comme lu |
| PUT | `/read-all` | Tout marquer comme lu |
| DELETE | `/{id}` | Supprimer notification |
| POST | `/generate-reminders` | Générer rappels |

## 🧪 Tests

```bash
# Tester l'API
curl http://localhost:8001/api/health

# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@jobtracker.com","password":"Demo123!"}'
```

## 📝 Modèles de Données

### User
```json
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "hashed_password": "string",
  "is_active": true,
  "has_google_ai_key": false,
  "has_openai_key": false
}
```

### Application
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "entreprise": "string",
  "poste": "string",
  "type_poste": "cdi|cdd|stage|alternance|freelance",
  "lieu": "string",
  "moyen": "linkedin|email|...",
  "date_candidature": "datetime",
  "reponse": "pending|positive|negative|no_response",
  "is_favorite": false
}
```

### Interview
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "candidature_id": "uuid",
  "date_entretien": "datetime",
  "type_entretien": "rh|technical|manager|final",
  "format_entretien": "phone|video|in_person",
  "statut": "planned|completed|cancelled"
}
```

---

© 2025 MAADEC - MAAD Engineering & Consulting
