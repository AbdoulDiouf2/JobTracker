# Frontend - JobTracker

Interface React pour l'application JobTracker.

## 🚀 Démarrage Rapide

```bash
# Installation
yarn install

# Variables d'environnement
cp .env.example .env

# Lancer le serveur
yarn start
```

## ⚙️ Configuration (.env)

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**En production**, remplacez par l'URL de votre backend déployé.

## 📁 Structure

```
frontend/src/
├── components/
│   └── ui/              # Composants Shadcn/UI
├── contexts/
│   ├── AuthContext.jsx  # Authentification
│   └── RefreshContext.jsx
├── hooks/
│   ├── useApplications.js
│   ├── useInterviews.js
│   ├── useStatistics.js
│   └── useAdmin.js
├── layouts/
│   ├── DashboardLayout.jsx
│   └── AdminLayout.jsx
├── pages/
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── AuthCallback.jsx     # Callback OAuth Google
│   ├── DashboardPage.jsx
│   ├── ApplicationsPage.jsx
│   ├── InterviewsPage.jsx
│   ├── SettingsPage.jsx
│   └── admin/
│       ├── AdminDashboardPage.jsx
│       └── AdminUsersPage.jsx
├── i18n/
│   └── index.js         # Traductions FR/EN
├── App.js
└── index.js
```

## 🔐 Authentification

### Email/Password
Formulaire classique de connexion/inscription.

### Google OAuth
Cliquez sur "Continuer avec Google" → Emergent Auth → Retour automatique.

**Aucune configuration requise** - Emergent Auth gère tout :
- ✅ Fonctionne en local (localhost)
- ✅ Fonctionne en production
- ✅ Pas de clés Google à configurer

### Flow OAuth
1. Clic sur bouton Google
2. Redirect vers `auth.emergentagent.com`
3. Connexion Google
4. Retour vers `/auth/callback#session_id=xxx`
5. `AuthCallback.jsx` échange le session_id
6. JWT stocké, utilisateur connecté

## 🎨 Composants UI

Utilisation de **Shadcn/UI** (`/src/components/ui/`):
- Button, Input, Select
- Dialog, Sheet
- Card, Badge
- Calendar, DatePicker
- Toast (Sonner)
- etc.

## 🌐 Internationalisation

Support Français/Anglais via `useLanguage()`:

```jsx
import { useLanguage } from '../i18n';

function MyComponent() {
  const { language, setLanguage } = useLanguage();
  
  const t = {
    fr: { hello: 'Bonjour' },
    en: { hello: 'Hello' }
  }[language];
  
  return <p>{t.hello}</p>;
}
```

## 📦 Build Production

```bash
# Build
yarn build

# Le dossier build/ contient les fichiers statiques
```

## 🚀 Déploiement

### Vercel (Recommandé)
```bash
# Via CLI
vercel

# Configurer REACT_APP_BACKEND_URL dans les settings
```

### Netlify
```bash
# Build command: yarn build
# Publish directory: build
```

### Nginx
```nginx
server {
    listen 80;
    root /var/www/jobtracker/build;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🧪 Tests

```bash
yarn test
```

## 📝 Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | URL du backend API | `https://api.monsite.com` |

## ⚠️ Notes Importantes

1. **Toujours utiliser `REACT_APP_BACKEND_URL`** pour les appels API
2. **Ne pas hardcoder d'URLs** - Utiliser les variables d'environnement
3. **OAuth Google** - Fonctionne automatiquement via Emergent Auth
