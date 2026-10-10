# Déploiement sur maadec-infra-01

Le déploiement de production utilise Docker Compose sur le réseau externe `prod-net`. Caddy est le seul point d'entrée public. Le frontend et l'API sont servis sous la même origine : `https://jobtracker.maadec.com`.

## Pré-requis avant le basculement

- Le serveur doit pouvoir cloner le dépôt sur `~/infra/prod/jobtracker` et avoir le réseau Docker externe `prod-net`.
- MongoDB reste sur le cluster Atlas existant. **Aucune migration de données n'est prévue** dans cette étape. Vérifier une sauvegarde Atlas récente et ajouter l'IP publique du VPS `2.29.2.166` à l'IP Access List Atlas avant le premier démarrage. Ne pas autoriser `0.0.0.0/0`.
- Préparer `.env.production` sur le serveur à partir des variables actuellement utilisées en production sur Vercel, notamment `MONGO_URL` **et `DB_NAME`** : ils doivent pointer exactement sur la même base pour retrouver les données existantes. Le fichier est ignoré par Git ; permissions `600`. Ne jamais copier de secrets dans le dépôt ou dans un message.
- Régler `APP_ENV=production` et reprendre les valeurs de production existantes pour `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `SECRET_KEY` et `ENCRYPTION_KEY`. Garder exactement les clés JWT/session et de chiffrement existantes pour conserver les sessions et déchiffrer les secrets utilisateurs. Les deux secrets de signature doivent rester distincts. Renseigner les URL publiques ci-dessous. Reporter également les variables réellement utilisées par Google OAuth/Agenda, les fournisseurs IA, SMTP, VAPID et MCP/OAuth.
- Garder **une seule instance API** : son cycle de vie démarre le planificateur des rappels. Ne pas ajouter de replicas/workers Uvicorn sans séparer le scheduler.

Référence des noms de variables : `backend/config.py`, `backend/.env.example` et `Doc/INSTALLATION-ET-CONFIGURATION.md`. Le fichier d'exemple à la racine est une aide, pas un jeu complet de valeurs de production.

## Déploiement initial (avant DNS)

Sur le VPS, en tant que `maadec` :

```bash
mkdir -p ~/infra/prod/jobtracker
cd ~/infra/prod/jobtracker
# Cloner le dépôt ici, branche main, si ce n'est pas déjà fait.
# Créer .env.production depuis un canal sûr, puis :
chmod 600 .env.production
docker compose -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 jobtracker-api
```

Le compose ne publie aucun port hôte. Caddy joint `jobtracker-web:80` sur `prod-net`. L'API n'a pas de port publié ; elle communique via les réseaux Docker et ne reçoit les requêtes publiques qu'au travers du proxy Nginx du frontend. Vérifier dans Caddy que le service `caddy` est bien joint à `prod-net`.

Bloc à ajouter manuellement dans `~/infra/caddy/Caddyfile` :

```caddy
jobtracker.maadec.com {
    reverse_proxy jobtracker-web:80
}
```

Valider puis recharger Caddy avec sa procédure habituelle. Ne pas modifier les enregistrements du domaine racine `maadec.com`. Tant que le DNS de JobTracker pointe encore vers Vercel, ne teste pas le nouveau site en HTTPS avec `curl --resolve` : Let’s Encrypt doit pouvoir résoudre publiquement le nom vers le VPS pour délivrer le certificat.

## Vérifications avant de changer le DNS

Avant le DNS, vérifier depuis le conteneur web `nginx -t` et `wget -qO- http://127.0.0.1/api/health`, et vérifier que l’API répond en état healthy. Après le changement DNS et sa propagation publique (`dig +short jobtracker.maadec.com @8.8.8.8` doit retourner `2.29.2.166`), ouvrir le site en HTTPS pour déclencher l’émission du certificat, puis vérifier assets, routes SPA, API, connexion/déconnexion, OAuth Google, rappels, documents, endpoints `.well-known` et MCP/OAuth si activés. Si Caddy a tenté d’obtenir le certificat avant la propagation DNS et reste en échec, suivre la procédure serveur documentée : recréer Caddy après propagation.

Les callbacks Google restent sous le même domaine ; vérifier toutefois que les URI autorisées côté Google correspondent toujours aux valeurs configurées. Vérifier aussi `MCP_ALLOWED_HOSTS` et `OAUTH_ISSUER` pour `jobtracker.maadec.com`.

## Basculement et retour arrière

Une fois les vérifications internes faites, modifier chez Hostinger uniquement l'enregistrement A de `jobtracker.maadec.com` vers `2.29.2.166`. Ne pas toucher aux enregistrements Vercel de `maadec.com`. Garder le déploiement Vercel et sa configuration disponibles pendant la période d'observation. En cas de problème, remettre l'ancien enregistrement DNS de JobTracker.

Après propagation, vérifier `https://jobtracker.maadec.com/api/health`, les journaux Caddy et API, puis les parcours utilisateurs/OAuth. Ne pas supprimer les données Atlas ni les fichiers persistants éventuels pendant le retour arrière.

## Déploiement automatique sur push `main`

Le workflow `.github/workflows/deploy-production.yml` connecte un runner GitHub Actions au tailnet, puis exécute `scripts/deploy-production.sh` sur le VPS. Chaque push sur `main` déploie le dernier commit disponible ; un lancement manuel est aussi disponible dans l'onglet Actions. Le script utilise `git pull --ff-only`, valide Compose, construit l'API et le frontend séquentiellement, redémarre la stack et attend que `/api/health` réponde healthy. Il n'affiche pas les logs applicatifs dans GitHub Actions.

### Préparation requise une seule fois

1. Dans Tailscale, créer un tag dédié `tag:jobtracker-deploy` et un OAuth client pour Actions avec le scope d'auth keys et ce tag autorisé. Le workflow utilise l'action officielle `tailscale/github-action@v4`; ses nœuds sont éphémères. La documentation Tailscale exige un tag pour un OAuth client utilisé par GitHub Actions et le scope `auth_keys`.
2. Dans la politique Tailscale, ajouter une autorisation **étroite** depuis `tag:jobtracker-deploy` vers le serveur `100.69.104.54`, TCP 22 uniquement. Le grant « membres uniquement » actuel ne couvre pas le runner tagué. Ne pas ouvrir le port 22 au public et ne pas élargir le grant général. Pour une politique en syntaxe grants, l’entrée minimale ressemble à `{"src":["tag:jobtracker-deploy"],"dst":["100.69.104.54"],"ip":["tcp:22"]}`. Ajouter aussi le tag dans `tagOwners`, limité aux administrateurs du tailnet.
3. Générer une clé SSH dédiée à ce déploiement. Installer sa clé publique dans le compte `maadec` sur le serveur. Ajouter dans les secrets GitHub Actions du dépôt :
   - `TS_OAUTH_CLIENT_ID`
   - `TS_OAUTH_SECRET`
   - `DEPLOY_SSH_PRIVATE_KEY`
   - `DEPLOY_KNOWN_HOSTS` : clé d'hôte SSH épinglée pour `100.69.104.54`, vérifiée depuis la console ou le serveur.
4. Vérifier que le checkout serveur existe dans `~/infra/prod/jobtracker`, que son remote `origin` peut lire le dépôt sans interaction, que la branche `main` existe, que `.env.production` est en place, et que `maadec` peut exécuter Git, Docker Compose et `flock`.
5. Configurer et vérifier tous les secrets Actions et règles Tailscale **avant le premier push** qui contient ce workflow, sinon l'exécution échouera. Valider le premier déploiement et l'accès HTTPS manuellement. Les modifications Caddy, la configuration Tailscale, les secrets Actions et le DNS restent des opérations ponctuelles séparées du déploiement applicatif.

Les secrets SSH/Tailscale restent dans GitHub Actions et ne sont jamais écrits dans le dépôt. La connexion passe par Tailscale ; le workflow ne demande aucune ouverture publique du port 22. Référence : [Tailscale GitHub Action](https://github.com/tailscale/github-action#readme).
