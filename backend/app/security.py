"""Hash de credenciales y JWT — todo en servidor."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import bcrypt
import jwt

from app.config import get_settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, stored: str | None) -> bool:
    """Acepta bcrypt o texto plano legacy del seed (lo migra el caller)."""
    if not stored:
        return False
    if stored.startswith("$2"):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    # Legacy seed: PIN/password en claro solo en desarrollo
    return plain == stored


def create_access_token(
    *,
    user_id: UUID | str,
    codigo: str,
    rol: str,
    nombre: str,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "codigo": codigo,
        "rol": rol,
        "nombre": nombre,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )
