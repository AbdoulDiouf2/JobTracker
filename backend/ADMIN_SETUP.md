# Création d'un compte administrateur

> Ce document ne contient aucun secret. Ne jamais y ajouter d'identifiant ni de mot de passe réel.
> Documentation générale : [Doc/README.md](../Doc/README.md).

## Initialisation du compte Admin

### Option 1 : Script seed_admin.py

> **Toujours fournir `--email` et `--password`.** Sans arguments, le script crée un compte
> administrateur avec des identifiants par défaut **faibles et connus** : à proscrire, surtout
> sur une base de production.

```bash
cd backend

# Créer avec vos propres identifiants (mot de passe long et unique)
python seed_admin.py create --email votre@email.com --password votremotdepasse --name "Votre Nom"

# Promouvoir un utilisateur existant
python seed_admin.py promote utilisateur@email.com

# Lister tous les admins
python seed_admin.py list

# Avec une URL MongoDB personnalisée
python seed_admin.py --mongo-url "mongodb://localhost:27017" --db-name "jobtracker" create
```

### Option 2 : Script MongoDB direct

```javascript
// Dans mongosh ou Compass
use jobtracker

// Promouvoir un utilisateur existant
db.users.updateOne(
  { email: "votre@email.com" },
  { $set: { role: "admin" } }
)

// Vérifier
db.users.findOne({ email: "votre@email.com" })
```

### Option 3 : Python inline

```python
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def promote_admin(email):
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["jobtracker"]
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"role": "admin"}}
    )
    
    print(f"Modified: {result.modified_count}")
    client.close()

asyncio.run(promote_admin("votre@email.com"))
```

## Rôles disponibles

| Rôle | Permissions |
|------|-------------|
| `admin` | Accès complet + Panel admin |
| `premium` | Rôle défini dans le modèle, sans fonctionnalité dédiée à ce jour |
| `standard` | Accès basique (défaut) |

La **veille** (agents MCP) est un droit distinct du rôle : un admin l'active compte par compte
avec `PUT /api/admin/users/{id}/watch` (`{"enabled": true}`). Voir
[Doc/DEPLOIEMENT-ET-EXPLOITATION.md](../Doc/DEPLOIEMENT-ET-EXPLOITATION.md).

## Variables d'environnement

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=jobtracker
```

## Accès au Panel Admin

URL: `/admin`

Le lien "Administration" apparaît dans la sidebar uniquement pour les utilisateurs avec `role: "admin"`.

---

© 2025 MAADEC - Document interne
