"""
Vérification minimale de l'accès aux modèles Gemini retenus par le correctif
(gemini-3.8-flash et gemini-3.5-flash-lite), AVANT son intégration.

- La clé est saisie de façon masquée (jamais affichée, jamais écrite sur le disque).
- Aucune donnée personnelle : seule la consigne « Réponds uniquement : OK » est envoyée.
- Coût : 2 appels de quelques jetons.

Usage (PowerShell, depuis le dossier backend, avec le venv du projet) :
    .\\.venv\\Scripts\\python ..\\Doc\\verifier-modeles-gemini.py
Option non interactive : variable d'environnement GEMINI_TEST_KEY (à effacer ensuite).
"""

import getpass
import os
import sys

MODELS = ("gemini-3.8-flash", "gemini-3.5-flash-lite")
PROMPT = "Réponds uniquement : OK"


def short_error(exc: BaseException) -> str:
    """Type d'erreur et code, sans texte pouvant contenir la clé."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    status = getattr(exc, "status", None)
    return f"{type(exc).__name__} code={code} status={status}"


def main() -> int:
    key = os.environ.get("GEMINI_TEST_KEY") or getpass.getpass("Clé API Gemini (saisie masquée) : ")
    if not key.strip():
        print("Aucune clé saisie.")
        return 2

    from google import genai

    client = genai.Client(api_key=key.strip())  # référence conservée (le SDK 2.x ferme un client orphelin)
    ok = True
    for model in MODELS:
        try:
            info = client.models.get(model=model)
            meta = f"métadonnées OK ({getattr(info, 'display_name', '') or model})"
        except Exception as exc:  # noqa: BLE001
            print(f"{model:24} ÉCHEC accès au modèle : {short_error(exc)}")
            ok = False
            continue
        try:
            # Même forme d'appel que le backend (aucune limite de jetons : un modèle qui
            # « réfléchit » pourrait sinon épuiser le budget et répondre vide à tort)
            response = client.models.generate_content(model=model, contents=PROMPT)
            text = (response.text or "").strip()
            verdict = "OK" if text else "RÉPONSE VIDE"
            ok = ok and bool(text)
            print(f"{model:24} {meta} ; génération {verdict} ({len(text)} caractères)")
        except Exception as exc:  # noqa: BLE001
            print(f"{model:24} {meta} ; ÉCHEC génération : {short_error(exc)}")
            ok = False

    print("\nRÉSULTAT :", "les deux modèles sont accessibles" if ok else "au moins un modèle est inaccessible")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
