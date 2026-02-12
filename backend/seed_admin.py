"""
JobTracker SaaS - Script de Seed Admin
Exécuter ce script pour créer un compte administrateur initial

Usage:
    python seed_admin.py
    
    ou avec des paramètres personnalisés:
    python seed_admin.py --email votre@email.com --password votremotdepasse --name "Votre Nom"
"""

import asyncio
import argparse
import os
import sys
from datetime import datetime, timezone

# Ajouter le répertoire parent au path pour les imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid

# Configuration du hachage de mot de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def seed_admin(email: str, password: str, full_name: str, mongo_url: str, db_name: str):
    """Crée ou met à jour un compte administrateur"""
    
    print(f"\n🔧 Connexion à MongoDB...")
    print(f"   URL: {mongo_url[:30]}...")
    print(f"   Database: {db_name}")
    
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Vérifier la connexion
        await client.admin.command('ping')
        print("✅ Connexion MongoDB réussie")
        
    except Exception as e:
        print(f"❌ Erreur de connexion MongoDB: {e}")
        return False
    
    try:
        # Vérifier si l'utilisateur existe déjà
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            # Mettre à jour le rôle si l'utilisateur existe
            if existing_user.get("role") == "admin":
                print(f"ℹ️  L'utilisateur {email} est déjà administrateur")
            else:
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"role": "admin"}}
                )
                print(f"✅ Utilisateur {email} promu administrateur")
        else:
            # Créer un nouvel utilisateur admin
            admin_user = {
                "id": str(uuid.uuid4()),
                "email": email,
                "full_name": full_name,
                "hashed_password": get_password_hash(password),
                "role": "admin",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": None,
                "google_ai_key": None,
                "openai_key": None
            }
            
            await db.users.insert_one(admin_user)
            print(f"✅ Compte administrateur créé avec succès!")
            print(f"   Email: {email}")
            print(f"   Nom: {full_name}")
        
        # Afficher les stats
        total_users = await db.users.count_documents({})
        admin_count = await db.users.count_documents({"role": "admin"})
        
        print(f"\n📊 Statistiques:")
        print(f"   Utilisateurs totaux: {total_users}")
        print(f"   Administrateurs: {admin_count}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du seed: {e}")
        client.close()
        return False


async def promote_to_admin(email: str, mongo_url: str, db_name: str):
    """Promouvoir un utilisateur existant en admin"""
    
    print(f"\n🔧 Promotion de {email} en administrateur...")
    
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        user = await db.users.find_one({"email": email})
        
        if not user:
            print(f"❌ Utilisateur {email} non trouvé")
            client.close()
            return False
        
        if user.get("role") == "admin":
            print(f"ℹ️  {email} est déjà administrateur")
        else:
            await db.users.update_one(
                {"email": email},
                {"$set": {"role": "admin"}}
            )
            print(f"✅ {email} est maintenant administrateur")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False


async def list_admins(mongo_url: str, db_name: str):
    """Lister tous les administrateurs"""
    
    print(f"\n📋 Liste des administrateurs:")
    
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        admins = await db.users.find({"role": "admin"}).to_list(length=100)
        
        if not admins:
            print("   Aucun administrateur trouvé")
        else:
            for admin in admins:
                print(f"   • {admin['full_name']} ({admin['email']})")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Script de seed pour créer un compte administrateur JobTracker"
    )
    
    # Sous-commandes
    subparsers = parser.add_subparsers(dest="command", help="Commandes disponibles")
    
    # Commande: create
    create_parser = subparsers.add_parser("create", help="Créer un nouvel admin")
    create_parser.add_argument("--email", "-e", default="admin@maadec.com", help="Email de l'admin")
    create_parser.add_argument("--password", "-p", default="admin123", help="Mot de passe")
    create_parser.add_argument("--name", "-n", default="Admin MAADEC", help="Nom complet")
    
    # Commande: promote
    promote_parser = subparsers.add_parser("promote", help="Promouvoir un utilisateur existant")
    promote_parser.add_argument("email", help="Email de l'utilisateur à promouvoir")
    
    # Commande: list
    subparsers.add_parser("list", help="Lister tous les administrateurs")
    
    # Options globales
    parser.add_argument("--mongo-url", default=os.environ.get("MONGO_URL", "mongodb://localhost:27017"), 
                        help="URL MongoDB")
    parser.add_argument("--db-name", default=os.environ.get("DB_NAME", "jobtracker"), 
                        help="Nom de la base de données")
    
    args = parser.parse_args()
    
    # Afficher le header
    print("=" * 50)
    print("🔐 JobTracker - Seed Admin")
    print("=" * 50)
    
    # Exécuter la commande appropriée
    if args.command == "create" or args.command is None:
        # Par défaut, créer un admin
        email = getattr(args, 'email', 'admin@maadec.com')
        password = getattr(args, 'password', 'admin123')
        name = getattr(args, 'name', 'Admin MAADEC')
        
        asyncio.run(seed_admin(email, password, name, args.mongo_url, args.db_name))
        
    elif args.command == "promote":
        asyncio.run(promote_to_admin(args.email, args.mongo_url, args.db_name))
        
    elif args.command == "list":
        asyncio.run(list_admins(args.mongo_url, args.db_name))
    
    print("\n" + "=" * 50)


if __name__ == "__main__":
    main()
