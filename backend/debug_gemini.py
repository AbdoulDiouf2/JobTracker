import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def list_models():
    try:
        from google import genai
        
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            print("No API key found in environment.")
            return

        print(f"Using API key: {api_key[:5]}...{api_key[-5:]}")
        client = genai.Client(api_key=api_key)
        
        print("Available models:")
        for model in client.models.list():
            print(f"- {model.name} (Methods: {model.supported_methods})")
            
    except ImportError:
        print("google-genai not installed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
