# Assistant de candidature (local)

À lancer sur ta machine : le conteneur cloud n'a pas tes sessions (Indeed, LinkedIn, HelloWork, WTTJ).
Le script remplit les formulaires et **s'arrête avant l'envoi**. Tu cliques sur "Envoyer" toi-même.

```bash
cd scripts/apply
npm i playwright && npx playwright install chromium
cp profile.example.json profile.json   # compléter disponibilité, salaire, chemin du CV
node apply.js                          # ou: node apply.js --only hublo,grdf
```

1. Au premier lancement, connecte-toi aux sites dans la fenêtre (session gardée dans `.browser-profile/`).
2. Pour chaque offre : relis, complète les questions, envoie, puis réponds `o` / `n` dans le terminal.
3. Renvoie `results.json` à Claude : il passe les offres envoyées en "pending" dans JobTracker
   avec la date réelle (`application_id` est déjà dans `offers.json`).

`profile.json`, `results.json`, captures et profil navigateur sont ignorés par git.
