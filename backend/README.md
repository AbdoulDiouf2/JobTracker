# 🚀 JobTracker SaaS - Backend API

API FastAPI pour l'application de suivi de candidatures JobTracker.

## 📋 Stack Technique

| Technologie | Usage |
|-------------|-------|
| **FastAPI** | Framework API REST async |
| **MongoDB** | Base de données NoSQL |
| **Motor** | Driver MongoDB async |
| **Pydantic** | Validation des données |
| **JWT** | Authentification (python-jose) |
| **bcrypt** | Hash des mots de passe |
| **openpyxl** | Export Excel |

## 🗂️ Structure

```
backend/
├── models/
│   └── __init__.py      # Modèles Pydantic (User, JobApplication, Interview, etc.)
├── routes/
│   ├── auth.py          # Authentification (register, login, profile)
│   ├── applications.py  # CRUD Candidatures
│   ├── interviews.py    # CRUD Entretiens
│   ├── statistics.py    # Statistiques et analytics
│   └── export.py        # Export JSON/CSV/Excel
├── utils/
│   └── auth.py          # JWT et password utilities
├── config.py            # Configuration (Settings)
├── server.py            # Point d'entrée FastAPI
├── requirements.txt     # Dépendances Python
└── .env                 # Variables d'environnement
```

## 🔌 Endpoints API

### Authentification (`/api/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/register` | Inscription utilisateur |
| `POST` | `/login` | Connexion (retourne JWT) |
| `GET` | `/me` | Profil utilisateur connecté |
| `PUT` | `/update-profile` | Mise à jour du profil |
| `PUT` | `/update-api-keys` | Mise à jour clés API IA |

### Candidatures (`/api/applications`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/` | Liste avec filtres et pagination |
| `POST` | `/` | Créer une candidature |
| `GET` | `/{id}` | Détails d'une candidature |
| `PUT` | `/{id}` | Modifier une candidature |
| `DELETE` | `/{id}` | Supprimer (cascade entretiens) |
| `POST` | `/{id}/favorite` | Toggle favori |
| `POST` | `/bulk-update` | Mise à jour en masse |
| `GET` | `/favorites/list` | Liste des favoris |

### Entretiens (`/api/interviews`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/` | Liste tous les entretiens |
| `GET` | `/upcoming` | Prochains entretiens (limit) |
| `POST` | `/` | Créer un entretien |
| `GET` | `/{id}` | Détails d'un entretien |
| `PUT` | `/{id}` | Modifier un entretien |
| `DELETE` | `/{id}` | Supprimer un entretien |

### Statistiques (`/api/statistics`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/dashboard` | Stats pour le dashboard |
| `GET` | `/timeline` | Évolution temporelle (cumul) |
| `GET` | `/by-status` | Répartition par statut |
| `GET` | `/by-type` | Répartition par type de poste |
| `GET` | `/by-method` | Répartition par moyen |
| `GET` | `/response-rate` | Taux et temps de réponse |
| `GET` | `/overview` | Vue complète |

### Export (`/api/export`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/json` | Export JSON complet |
| `GET` | `/csv` | Export CSV |
| `GET` | `/excel` | Export Excel formaté |
| `GET` | `/statistics/excel` | Stats multi-sheets |

## 🗃️ Modèles de Données

### User
```python
{
    "id": "uuid",
    "email": "string",
    "full_name": "string",
    "hashed_password": "string",
    "is_active": true,
    "google_ai_key": "string?",
    "openai_key": "string?",
    "created_at": "datetime"
}
```

### JobApplication
```python
{
    "id": "uuid",
    "entreprise": "string",
    "poste": "string",
    "type_poste": "cdi|cdd|stage|alternance|freelance|interim",
    "lieu": "string?",
    "moyen": "linkedin|company_website|email|indeed|apec|pole_emploi|other",
    "date_candidature": "datetime",
    "lien": "string?",
    "reponse": "pending|positive|negative|no_response|cancelled",
    "date_reponse": "datetime?",
    "commentaire": "string?",
    "is_favorite": false,
    "user_id": "string"
}
```

### Interview
```python
{
    "id": "uuid",
    "candidature_id": "string",
    "date_entretien": "datetime",
    "type_entretien": "rh|technical|manager|final|other",
    "format_entretien": "phone|video|in_person",
    "lieu_entretien": "string?",
    "statut": "planned|completed|cancelled",
    "interviewer": "string?",
    "commentaire": "string?",
    "user_id": "string"
}
```

## ⚙️ Configuration

### Variables d'environnement (`.env`)

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
JWT_SECRET=your-secret-key-change-in-production
```

## 🚀 Installation

```bash
cd backend

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python server.py
# ou
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## 📖 Documentation API

Une fois le serveur lancé, accédez à :
- **Swagger UI** : `http://localhost:8001/docs`
- **ReDoc** : `http://localhost:8001/redoc`

## 🔒 Sécurité

- ✅ Hash bcrypt pour les mots de passe
- ✅ JWT avec expiration (7 jours par défaut)
- ✅ Validation Pydantic stricte
- ✅ CORS configuré
- ✅ Index MongoDB (user_id, email, dates)
