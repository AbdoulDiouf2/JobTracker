"""
Chiffrement symétrique des données sensibles (clés API utilisateurs).
Utilise Fernet (AES-128-CBC + HMAC-SHA256).

La clé de chiffrement est ENCRYPTION_KEY dans les variables d'environnement.
Générer une clé : python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import logging
from cryptography.fernet import Fernet, InvalidToken
from config import settings

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None


def _get_fernet() -> Fernet | None:
    global _fernet
    if _fernet is not None:
        return _fernet
    key = getattr(settings, 'ENCRYPTION_KEY', None)
    if not key:
        logger.warning("ENCRYPTION_KEY non définie — les clés API ne seront pas chiffrées")
        return None
    try:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet
    except Exception as e:
        logger.error(f"ENCRYPTION_KEY invalide : {e}")
        return None


def encrypt(value: str | None) -> str | None:
    """Chiffre une chaîne. Retourne None si value est None."""
    if not value:
        return value
    f = _get_fernet()
    if not f:
        return value  # dégradé : stocke en clair si clé absente
    return f.encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    """Déchiffre une chaîne. Retourne None si value est None."""
    if not value:
        return value
    f = _get_fernet()
    if not f:
        return value  # dégradé : retourne tel quel si clé absente
    try:
        return f.decrypt(value.encode()).decode()
    except InvalidToken:
        # La valeur est probablement en clair (migration depuis ancien stock)
        return value
