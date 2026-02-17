# 🚀 Guide de Publication - JobTracker Chrome Extension

Ce guide vous accompagne dans le déploiement de l'extension JobTracker sur le Chrome Web Store.

---

## 📋 Prérequis

### 1. Compte Développeur Chrome Web Store
- Créez un compte sur [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- **Frais d'inscription unique** : 5$ USD
- Vérification d'identité requise

### 2. Fichiers requis
```
chrome-extension/
├── manifest.json       ✅ Configuré
├── popup.html          ✅ Configuré
├── popup.js            ✅ Configuré
├── options.html        ✅ Configuré
├── options.js          ✅ Configuré
├── content.js          ✅ Configuré
├── styles.css          ✅ Configuré
└── icons/
    ├── icon16.png      ✅ 16x16 pixels
    ├── icon48.png      ✅ 48x48 pixels
    └── icon128.png     ✅ 128x128 pixels
```

### 3. Assets supplémentaires pour la publication
Vous devrez créer :
- **Logo promotionnel** : 440x280 pixels (PNG)
- **Screenshots** : 1280x800 ou 640x400 pixels (min 1, max 5)
- **Icône du store** : 128x128 pixels (PNG)

---

## 🔧 Configuration avant publication

### Étape 1 : Modifier l'URL de l'API

Ouvrez `/chrome-extension/popup.js` et vérifiez l'URL de production :

```javascript
// Ligne ~50 - Changez l'URL par défaut vers votre domaine de production
if (!config.jt_apiUrl) {
    config.jt_apiUrl = 'https://votre-domaine-production.com';
    await chrome.storage.sync.set({ jt_apiUrl: config.jt_apiUrl });
}
```

### Étape 2 : Mettre à jour le manifest.json

```json
{
  "manifest_version": 3,
  "name": "JobTracker Clipper",
  "version": "2.1.0",
  "description": "Ajoutez des offres d'emploi à votre JobTracker avec extraction IA automatique. Gagnez du temps dans votre recherche d'emploi.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Étape 3 : Créer le fichier ZIP

```bash
cd chrome-extension
zip -r jobtracker-extension-v2.1.0.zip . -x "*.DS_Store" -x "*.git*"
```

Ou manuellement :
1. Sélectionnez tous les fichiers dans le dossier `chrome-extension/`
2. Clic droit → "Compresser" / "Créer une archive ZIP"
3. Nommez le fichier `jobtracker-extension.zip`

---

## 📤 Publication sur Chrome Web Store

### Étape 1 : Accéder au Developer Dashboard

1. Allez sur [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Connectez-vous avec votre compte Google
3. Cliquez sur **"+ Nouvel élément"**

### Étape 2 : Uploader l'extension

1. Cliquez sur **"Charger le fichier ZIP"**
2. Sélectionnez votre fichier `jobtracker-extension.zip`
3. Attendez le traitement (quelques secondes)

### Étape 3 : Remplir les informations

#### Onglet "Fiche Store"

| Champ | Valeur recommandée |
|-------|-------------------|
| **Nom** | JobTracker Clipper |
| **Description courte** | Sauvegardez les offres d'emploi en un clic avec extraction IA |
| **Description complète** | Voir ci-dessous |
| **Catégorie** | Productivité |
| **Langue** | Français |

**Description complète suggérée** :
```
🎯 JobTracker Clipper - Votre assistant de recherche d'emploi

Gagnez du temps dans votre recherche d'emploi ! Cette extension vous permet de sauvegarder instantanément les offres d'emploi depuis n'importe quel site vers votre tableau de bord JobTracker.

✨ FONCTIONNALITÉS PRINCIPALES

• Extraction IA automatique : L'IA analyse la page et extrait automatiquement le nom de l'entreprise, le poste, le salaire, les compétences requises, etc.

• Compatible avec tous les sites : LinkedIn, Indeed, Welcome to the Jungle, APEC, France Travail, et tous les sites d'emploi.

• Connexion sécurisée : Connectez-vous avec vos identifiants JobTracker ou utilisez un code de connexion rapide généré depuis l'application.

• Synchronisation instantanée : Vos candidatures sont immédiatement disponibles dans votre tableau de bord JobTracker.

🔐 CONNEXION FACILE

Deux options de connexion :
1. Email et mot de passe JobTracker
2. Code de connexion rapide (généré depuis Paramètres → Extension Chrome)

📊 SUIVI COMPLET

Une fois l'offre sauvegardée, retrouvez-la dans votre dashboard JobTracker avec :
• Suivi du statut de candidature
• Rappels automatiques
• Statistiques de votre recherche
• Score de matching avec votre CV

🚀 COMMENT ÇA MARCHE

1. Installez l'extension
2. Connectez-vous à votre compte JobTracker
3. Sur une page d'offre d'emploi, cliquez sur l'icône JobTracker
4. Cliquez sur "Extraire avec IA" pour remplir automatiquement les champs
5. Cliquez sur "Ajouter au Tracker"

C'est tout ! L'offre est maintenant dans votre suivi.

💬 SUPPORT

Besoin d'aide ? Contactez-nous à support@jobtracker.app

Développé avec ❤️ par l'équipe JobTracker
```

#### Onglet "Images"

Uploadez les assets suivants :
- **Icône du Store** : 128x128 PNG
- **Image promotionnelle** : 440x280 PNG (optionnel mais recommandé)
- **Screenshots** : Au moins 1 screenshot 1280x800

**Conseils pour les screenshots** :
1. Montrez l'extension en action sur LinkedIn ou Indeed
2. Montrez le formulaire rempli après extraction IA
3. Montrez le message de succès
4. Utilisez des données fictives réalistes

#### Onglet "Pratiques de confidentialité"

| Question | Réponse |
|----------|---------|
| L'extension collecte-t-elle des données utilisateur ? | Oui |
| Données collectées | Email (pour l'authentification) |
| Usage des données | Authentification uniquement |
| Partage avec des tiers | Non |

**Politique de confidentialité** :
Créez une page sur votre site web ou utilisez un service comme [TermsFeed](https://www.termsfeed.com/). L'URL est requise.

### Étape 4 : Soumettre pour examen

1. Vérifiez tous les onglets (une coche verte doit apparaître)
2. Cliquez sur **"Soumettre pour examen"**
3. Attendez l'approbation (généralement 1-3 jours ouvrés)

---

## ⏱️ Délais d'examen

| Type | Délai moyen |
|------|-------------|
| Première publication | 1-3 jours |
| Mise à jour mineure | 24-48 heures |
| Mise à jour majeure | 1-3 jours |

**Note** : Google peut rejeter l'extension si :
- Les permissions demandées semblent excessives
- La politique de confidentialité est manquante ou incomplète
- Les screenshots sont trompeurs
- Le code contient des pratiques interdites

---

## 🔄 Processus de mise à jour

### Pour publier une nouvelle version :

1. Incrémentez la version dans `manifest.json` :
```json
"version": "2.1.1"
```

2. Créez un nouveau ZIP

3. Dans le Developer Dashboard :
   - Cliquez sur votre extension
   - Cliquez sur **"Package"**
   - Uploadez le nouveau ZIP
   - Soumettez pour examen

---

## 🧪 Test avant publication

### Mode développeur (recommandé avant publication)

1. Ouvrez Chrome → `chrome://extensions/`
2. Activez le **"Mode développeur"** (en haut à droite)
3. Cliquez sur **"Charger l'extension non empaquetée"**
4. Sélectionnez le dossier `chrome-extension/`

### Checklist de test

- [ ] La connexion email/mot de passe fonctionne
- [ ] La connexion par code rapide fonctionne
- [ ] L'extraction IA remplit correctement les champs
- [ ] La sauvegarde de candidature fonctionne
- [ ] La déconnexion fonctionne
- [ ] L'extension s'affiche correctement sur différents sites (LinkedIn, Indeed, etc.)
- [ ] Les icônes s'affichent correctement
- [ ] Pas d'erreurs dans la console (F12 → Console)

---

## 📊 Suivi des statistiques

Une fois publiée, vous aurez accès à :
- Nombre d'installations
- Nombre d'utilisateurs actifs
- Notes et avis
- Statistiques géographiques

---

## 🆘 Résolution des problèmes courants

### L'extension est rejetée

| Raison | Solution |
|--------|----------|
| "Permissions excessives" | Réduisez les `host_permissions` si possible |
| "Description trompeuse" | Ajustez la description pour correspondre exactement aux fonctionnalités |
| "Politique de confidentialité manquante" | Ajoutez une URL vers votre politique |
| "Code obfusqué" | Soumettez le code source lisible |

### L'extension ne se charge pas

```bash
# Vérifiez la syntaxe JSON du manifest
cat manifest.json | python3 -m json.tool
```

### Erreurs de permissions

Assurez-vous que `host_permissions` inclut les domaines nécessaires :
```json
"host_permissions": [
  "https://votre-api.com/*",
  "<all_urls>"
]
```

---

## 📞 Support Google

- [Centre d'aide Chrome Web Store](https://support.google.com/chrome_webstore/)
- [Forum des développeurs](https://groups.google.com/a/chromium.org/g/chromium-extensions)
- [Documentation officielle](https://developer.chrome.com/docs/extensions/)

---

## ✅ Checklist finale

Avant de soumettre :

- [ ] `manifest.json` avec la bonne version
- [ ] URL de l'API de production configurée
- [ ] Icônes dans les 3 tailles (16, 48, 128)
- [ ] Screenshots prêts (1280x800)
- [ ] Description complète rédigée
- [ ] Politique de confidentialité publiée
- [ ] Tests effectués en mode développeur
- [ ] Fichier ZIP créé sans fichiers cachés

---

**Bonne publication ! 🎉**

© 2025 JobTracker - MAADEC
