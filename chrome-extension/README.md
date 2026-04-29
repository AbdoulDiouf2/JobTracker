# JobTracker Chrome Extension

Extension Chrome pour capturer une offre d'emploi et l'ajouter a JobTracker depuis un panneau lateral.

## Installation locale

1. Ouvrez `chrome://extensions/`.
2. Activez le mode developpeur.
3. Cliquez sur "Charger l'extension non empaquetee".
4. Selectionnez le dossier `chrome-extension/`.

## Connexion recommandee

Utilisez le code rapide genere depuis JobTracker :

1. Ouvrez JobTracker.
2. Allez dans `Parametres > Extension Chrome`.
3. Generez un code temporaire.
4. Collez ce code dans l'extension.

L'extension stocke le token dans `chrome.storage.local`, donc il reste local a l'appareil.

## Utilisation

1. Ouvrez une page d'offre d'emploi.
2. Cliquez sur l'icone JobTracker.
3. Choisissez un mode :
   - `IA` : envoie un extrait cible de la page au backend JobTracker pour extraction.
   - `Scraping` : extrait localement via JSON-LD, selecteurs connus et meta tags.
   - `Manuel` : saisie directe.
4. Verifiez les champs.
5. Cliquez sur `Ajouter au Tracker`.

## Configuration

L'URL API officielle est :

```text
https://job-tracker-steel-eight.vercel.app
```

La page options permet de remplacer cette URL pour le developpement local.

## Notes techniques

- Manifest V3.
- Side panel Chrome.
- `activeTab` + injection a la demande pour limiter les permissions permanentes.
- Host permission permanente limitee a l'API officielle.
- Permissions optionnelles demandees seulement pour une API personnalisee.
- Les valeurs `moyen` envoyees au backend sont limitees aux enums acceptees par JobTracker.
