"""Autenticación JWT para el Centro de Control de Pantallas."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import CurrentUser, get_current_user
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """Login del Centro de Control (admin / operador)."""

    usuario: str = Field(..., description="username o codigo (ej. cajero1 / CAJ01)")
    password: str = Field(..., min_length=1, description="Contraseña o PIN")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            """
            SELECT id, codigo, username, nombre, rol::text AS rol,
                   pin_hash, password_hash, activo
            FROM usuarios
            WHERE activo = TRUE
              AND (
                    lower(codigo) = lower(:u)
                    OR lower(COALESCE(username, '')) = lower(:u)
                  )
            LIMIT 1
            """
        ),
        {"u": body.usuario.strip()},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Acepta password_hash o pin_hash
    stored = row["password_hash"] or row["pin_hash"]
    if not verify_password(body.password, stored):
        # Intentar el otro campo
        alt = row["pin_hash"] if stored == row["password_hash"] else row["password_hash"]
        if not verify_password(body.password, alt):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

    # Migrar seed en claro → bcrypt (una sola vez, en servidor)
    if stored and not str(stored).startswith("$2"):
        hashed = hash_password(body.password)
        await db.execute(
            text(
                """
                UPDATE usuarios
                SET password_hash = :h, pin_hash = :h, actualizado_en = NOW()
                WHERE id = :id
                """
            ),
            {"h": hashed, "id": str(row["id"])},
        )
        await db.commit()

    token = create_access_token(
        user_id=row["id"],
        codigo=row["codigo"],
        rol=row["rol"],
        nombre=row["nombre"],
    )
    return LoginResponse(
        access_token=token,
        usuario={
            "id": str(row["id"]),
            "codigo": row["codigo"],
            "username": row["username"],
            "nombre": row["nombre"],
            "rol": row["rol"],
        },
    )


@router.get("/me")
async def me(user: Annotated[CurrentUser, Depends(get_current_user)]):
    return {
        "id": str(user.id),
        "codigo": user.codigo,
        "nombre": user.nombre,
        "rol": user.rol,
        "puede_caja": user.puede_caja,
    }
