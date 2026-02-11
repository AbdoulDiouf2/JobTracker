# 🚀 Job Tracking - Site Vitrine SaaS

Un site web professionnel de style SaaS pour présenter le projet **Job Tracking**, une application full-stack intelligente de suivi de candidatures propulsée par l'IA.

![MAADEC Logo](https://customer-assets.emergentagent.com/job_careernav-3/artifacts/2hooa0lk_logo_maadec_copie.png)

## 🎯 Objectif

Positionner MAADEC comme un **Ingénieur Full-Stack & IA** capable de construire des applications web intelligentes prêtes pour la production. Ce site vitrine présente le projet Job Tracking avec un design moderne inspiré de Stripe, Linear et Vercel.

---

## 📊 Architecture du Projet

### Stack Technique

| Couche | Technologies |
|--------|--------------|
| **Frontend** | React 19, Tailwind CSS, Framer Motion, Shadcn UI, Lucide React |
| **Backend** | FastAPI, Pydantic, Motor (MongoDB async driver) |
| **Base de données** | MongoDB |
| **Authentification** | JWT (python-jose), bcrypt |
| **i18n** | Système custom FR/EN |

### Structure du Projet

```
/app
├── frontend/                    # Application React
│   ├── src/
│   │   ├── components/ui/       # Composants Shadcn
│   │   ├── i18n/                # Internationalisation
│   │   │   ├── translations.js  # Traductions FR/EN
│   │   │   └── LanguageContext.jsx
│   │   ├── pages/
│   │   │   └── LandingPage.jsx  # Page vitrine
│   │   ├── App.js
│   │   └── index.css            # Styles globaux + Tailwind
│   └── tailwind.config.js
│
├── backend/                     # API FastAPI
│   ├── models/
│   │   └── __init__.py          # Modèles Pydantic
│   ├── routes/
│   │   ├── auth.py              # Authentification
│   │   ├── applications.py      # CRUD Candidatures
│   │   ├── interviews.py        # CRUD Entretiens
│   │   ├── statistics.py        # Statistiques
│   │   └── export.py            # Export JSON/CSV/Excel
│   ├── utils/
│   │   └── auth.py              # JWT & password utils
│   ├── config.py                # Configuration
│   └── server.py                # Serveur principal
│
└── README.md
```

---

## 🔌 API Endpoints

### Authentification (`/api/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/register` | Inscription |
| POST | `/login` | Connexion (retourne JWT) |
| GET | `/me` | Profil utilisateur |
| PUT | `/update-profile` | Mise à jour profil |
| PUT | `/update-api-keys` | Mise à jour clés IA |

### Candidatures (`/api/applications`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste avec filtres & pagination |
| POST | `/` | Créer candidature |
| GET | `/{id}` | Détails |
| PUT | `/{id}` | Modifier |
| DELETE | `/{id}` | Supprimer |
| POST | `/{id}/favorite` | Toggle favori |
| POST | `/bulk-update` | Mise à jour en masse |
| GET | `/favorites/list` | Liste favoris |

### Entretiens (`/api/interviews`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Liste tous les entretiens |
| GET | `/upcoming` | Prochains entretiens |
| POST | `/` | Créer entretien |
| GET | `/{id}` | Détails |
| PUT | `/{id}` | Modifier |
| DELETE | `/{id}` | Supprimer |

### Statistiques (`/api/statistics`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/dashboard` | Stats dashboard |
| GET | `/timeline` | Évolution temporelle |
| GET | `/by-status` | Répartition par statut |
| GET | `/by-type` | Répartition par type |
| GET | `/by-method` | Répartition par moyen |
| GET | `/response-rate` | Taux de réponse |
| GET | `/overview` | Vue complète |

### Export (`/api/export`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/json` | Export JSON |
| GET | `/csv` | Export CSV |
| GET | `/excel` | Export Excel |
| GET | `/statistics/excel` | Stats Excel multi-sheets |

---

## 🗃️ Modèles de Données

### JobApplication (Candidature)

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
    "is_favorite": "boolean",
    "created_at": "datetime",
    "updated_at": "datetime",
    "user_id": "string"
}
```

### Interview (Entretien)

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
    "created_at": "datetime",
    "user_id": "string"
}
```

---

## ✨ Fonctionnalités du Site Vitrine

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

---

## 🚀 Installation & Démarrage

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

**Backend (.env)**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
JWT_SECRET=your-secret-key
```

**Frontend (.env)**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 🎨 Palette de Couleurs

| Couleur | Hex | Usage |
|---------|-----|-------|
| Navy Dark | `#020817` | Arrière-plan principal |
| Navy | `#1a365d` | Éléments d'accent |
| Or | `#c4a052` | Boutons, highlights |
| Or Clair | `#e5c57f` | Hover states |
| Slate | `#94a3b8` | Texte secondaire |

---

## 📧 Contact

**MAADEC - MAAD Engineering & Consulting**

- 📧 Email: contact@maadec.com
- 🔗 LinkedIn: [À ajouter]
- 💻 GitHub: [À ajouter]

---

## 📜 Licence

© 2025 MAADEC - MAAD Engineering & Consulting. Tous droits réservés.

---

<p align="center">
  <strong>Construit avec ❤️ par MAADEC</strong><br>
  <em>Full-Stack & AI Engineering</em>
</p>
