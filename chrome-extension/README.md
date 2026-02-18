# 🎯 JobTracker Chrome Extension

Extension Chrome pour capturer et ajouter des offres d'emploi à JobTracker en un clic, avec extraction automatique par IA.

## 📦 Installation

### Mode Développeur (Local)

1. Ouvrez Chrome et allez dans `chrome://extensions/`
2. Activez le **Mode développeur** (toggle en haut à droite)
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `chrome-extension/`
5. L'extension apparaît dans votre barre d'outils

### Configuration Initiale

1. Cliquez droit sur l'icône de l'extension → **Options**
2. Renseignez :
   - **URL de l'API** : `https://jobscouter-1.preview.emergentagent.com` (ou votre URL de production)
   - **Token JWT** : Récupérez-le depuis les DevTools de votre navigateur (voir section ci-dessous)
3. Cliquez sur **Enregistrer**

## 🔑 Comment récupérer votre Token JWT

1. Connectez-vous à JobTracker dans votre navigateur
2. Ouvrez les DevTools (F12)
3. Allez dans **Application** → **Local Storage**
4. Trouvez la clé `token` et copiez sa valeur
5. Collez cette valeur dans les options de l'extension

## 🚀 Utilisation

### Méthode 1 : Extraction IA Automatique (Recommandé)

1. Naviguez vers une offre d'emploi (LinkedIn, Indeed, APEC, etc.)
2. Cliquez sur l'icône JobTracker
3. Cliquez sur **"Extraire avec IA"**
4. L'IA analyse la page et remplit automatiquement :
   - Entreprise
   - Poste
   - Lieu
   - Type de contrat (CDI, CDD, Stage...)
   - Salaire (si disponible)
   - Compétences requises
   - Description
5. Vérifiez et modifiez si nécessaire
6. Cliquez sur **"Ajouter au Tracker"**

### Méthode 2 : Saisie Manuelle

1. Cliquez sur l'icône JobTracker
2. Remplissez manuellement les champs
3. Cliquez sur **"Ajouter au Tracker"**

## 🌐 Sites Supportés

L'extraction IA fonctionne sur tous les sites, mais est optimisée pour :

| Site | Détection automatique |
|------|----------------------|
| LinkedIn | ✅ `linkedin` |
| Indeed | ✅ `indeed` |
| Welcome to the Jungle | ✅ `welcome_to_jungle` |
| APEC | ✅ `apec` |
| France Travail | ✅ `pole_emploi` |
| Autres sites | ✅ `other` |

## 📊 Champs Extraits par l'IA

| Champ | Description |
|-------|-------------|
| `entreprise` | Nom de l'entreprise |
| `poste` | Titre du poste |
| `type_poste` | CDI, CDD, Stage, Alternance, Freelance, Intérim |
| `lieu` | Ville, Pays ou "Remote" |
| `salaire_min` | Salaire annuel brut minimum |
| `salaire_max` | Salaire annuel brut maximum |
| `description_poste` | Résumé de la description (500 car. max) |
| `competences` | Liste des compétences techniques requises |
| `experience_requise` | Niveau d'expérience demandé |
| `moyen` | Source de l'offre (détecté via URL) |

## ⚙️ Configuration des Clés API

Pour que l'extraction IA fonctionne, vous devez avoir configuré au moins une clé API dans JobTracker :

1. Allez dans **Paramètres** de JobTracker
2. Configurez une des clés suivantes :
   - **Google AI (Gemini)** : Gratuit avec quota
   - **OpenAI** : Payant, très précis
   - **Groq** : Gratuit, très rapide (Llama, Mixtral)

### Obtenir des clés gratuites

| Fournisseur | URL | Modèles |
|-------------|-----|---------|
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | Llama 3.3 70B, Mixtral |
| Google AI | [aistudio.google.com](https://aistudio.google.com/apikey) | Gemini 2.0 Flash |

## 🔧 Structure des Fichiers

```
chrome-extension/
├── manifest.json      # Configuration Manifest V3
├── popup.html         # Interface du popup
├── popup.js           # Logique extraction + envoi API
├── options.html       # Page de configuration
├── options.js         # Sauvegarde des options
├── styles.css         # Styles du popup
└── icons/             # Icônes de l'extension
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🐛 Dépannage

### "Erreur: Token non configuré"
→ Allez dans les options et configurez votre token JWT

### "Erreur connexion API"
→ Vérifiez que l'URL de l'API est correcte et que le serveur est accessible

### "Extraction IA: Erreur 400"
→ Aucune clé API configurée dans JobTracker. Ajoutez une clé Groq (gratuite) dans les paramètres.

### L'extraction ne trouve pas certaines infos
→ L'IA fait de son mieux, mais certains sites ont des structures complexes. Complétez manuellement les champs manquants.

## 📝 API Endpoints Utilisés

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/ai/extract-job` | POST | Extraction IA du contenu de page |
| `/api/applications` | POST | Création de la candidature |

### Exemple de payload d'extraction

```json
{
  "page_content": "Contenu textuel de la page...",
  "page_url": "https://www.linkedin.com/jobs/view/123456"
}
```

### Exemple de réponse

```json
{
  "entreprise": "Google",
  "poste": "Senior Software Engineer",
  "type_poste": "cdi",
  "lieu": "Paris, France",
  "salaire_min": 65000,
  "salaire_max": 85000,
  "competences": ["Python", "Kubernetes", "GCP"],
  "confidence_score": 0.92
}
```

## 🔒 Sécurité

- Le token JWT est stocké localement dans `chrome.storage.sync`
- Aucune donnée n'est envoyée à des tiers
- Tout passe par votre instance JobTracker

## 📄 Licence

MIT - © 2025 MAADEC
