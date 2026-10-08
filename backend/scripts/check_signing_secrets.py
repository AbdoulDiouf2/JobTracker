"""
Pré-vol S3 : vérifie qu'un fichier d'environnement passera la validation des
secrets de signature AVANT de déployer le code durci.

N'affiche JAMAIS de valeur : uniquement des verdicts et des raisons.

Usage (depuis backend/) :
    python scripts/check_signing_secrets.py <fichier.env> [--env production|preview]

Exemple avec la CLI Vercel (le fichier contient des secrets : le supprimer ensuite) :
    vercel env pull .env.vercel.production --environment=production
    python scripts/check_signing_secrets.py .env.vercel.production --env production
    del .env.vercel.production
"""

import argparse
import os
import sys
from pathlib import Path

# Ne pas valider le .env local au chargement de config : seul le fichier cible compte
os.environ["APP_ENV"] = "test"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import effective_app_env, secret_problems  # noqa: E402


def read_env_file(path: Path) -> dict:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def check_values(values: dict, vercel_env: str) -> list:
    """Liste des problèmes bloquants (sans aucune valeur de secret)."""
    issues = []
    for name in ("JWT_SECRET", "SECRET_KEY"):
        problems = secret_problems(values.get(name))
        if problems:
            issues.append(f"{name} : {', '.join(problems)}")
    if values.get("JWT_SECRET") and values.get("JWT_SECRET") == values.get("SECRET_KEY"):
        issues.append("JWT_SECRET et SECRET_KEY sont identiques")
    env = effective_app_env(values.get("APP_ENV"), vercel_env)
    if env != "production":
        issues.append(f"environnement effectif « {env} » : la production doit appliquer les règles strictes")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("env_file", type=Path)
    parser.add_argument("--env", default="production", choices=["production", "preview"])
    args = parser.parse_args()

    if not args.env_file.exists():
        print(f"Fichier introuvable : {args.env_file}")
        return 2
    values = read_env_file(args.env_file)
    issues = check_values(values, args.env)
    print(f"Pré-vol S3 ({args.env}) — APP_ENV présent : {'APP_ENV' in values}")
    if issues:
        print("BLOQUANT — le code durci refuserait de démarrer :")
        for issue in issues:
            print(f"  - {issue}")
        return 1
    print("OK — JWT_SECRET et SECRET_KEY conformes, distincts ; règles de production actives.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
