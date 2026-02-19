
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path

# Config
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "jobtracker"
DOCUMENT_ID = "4b183c56-6296-46cf-9fcd-0471e6aaf791"

async def check_document():
    print(f"Checking document {DOCUMENT_ID}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check DB
    doc = await db.documents.find_one({"id": DOCUMENT_ID})
    
    if not doc:
        print("❌ Document NOT FOUND in database.")
    else:
        print("✅ Document found in database:")
        print(f"   - Name: {doc.get('name')}")
        print(f"   - Type: {doc.get('document_type')}")
        print(f"   - File Path (DB): {doc.get('file_path')}")
        
        file_path_str = doc.get('file_path')
        if file_path_str:
            file_path = Path(file_path_str)
            if file_path.exists():
                print(f"✅ File exists at: {file_path}")
                print(f"   - Size: {file_path.stat().st_size} bytes")
            else:
                print(f"❌ File MISSING at: {file_path}")
                
                # Check if it exists in current dir relative path
                if not file_path.is_absolute():
                     cwd_path = Path.cwd() / file_path
                     if cwd_path.exists():
                         print(f"✅ File found relative to CWD at: {cwd_path}")
                     else:
                         print(f"❌ File also missing relative to CWD: {cwd_path}")

        else:
            print("⚠️ No file_path set for this document.")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_document())
