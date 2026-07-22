"""Dependencias FastAPI: DB + usuario autenticado (Centro de Control)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

ROLES_CONTROL = frozenset({"admin", "operador"})
# Alias legacy usados por routers existentes
ROLES_CAJA = ROLES_CONTROL
ROLES_OPERACION = ROLES_CONTROL


@dataclass(slots=True)
class CurrentUser:
    id: UUID
    codigo: str
    nombre: str
    rol: str

    @property
    def puede_caja(self) -> bool:
        """Puede mutar menú y campañas (cualquier rol de control)."""
        return self.rol in ROLES_CONTROL

    @property
    def puede_control(self) -> bool:
        return self.rol in ROLES_CONTROL


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión requerida",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(creds.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido")

    result = await db.execute(
        text(
            """
            SELECT id, codigo, nombre, rol::text AS rol, activo
            FROM usuarios
            WHERE id = :id
            """
        ),
        {"id": user_id},
    )
    row = result.mappings().first()
    if not row or not row["activo"]:
        raise HTTPException(status_code=401, detail="Usuario inactivo o inexistente")

    return CurrentUser(
        id=row["id"],
        codigo=row["codigo"],
        nombre=row["nombre"],
        rol=row["rol"],
    )


async def require_caja(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if not user.puede_control:
        raise HTTPException(status_code=403, detail="Se requiere rol de control")
    return user


async def require_operacion(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if user.rol not in ROLES_OPERACION:
        raise HTTPException(status_code=403, detail="Rol no autorizado")
    return user
