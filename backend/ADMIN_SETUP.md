# 🔐 Documentation Admin - CONFIDENTIEL

> ⚠️ **NE PAS COMMITER CE FICHIER DANS UN REPO PUBLIC**

## Initialisation du compte Admin

### Option 1 : Script seed_admin.py

```bash
cd backend

# Créer un admin par défaut
python seed_admin.py

# Créer avec vos propres identifiants
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
| `premium` | Fonctionnalités avancées (futur) |
| `standard` | Accès basique (défaut) |

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
