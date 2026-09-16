"""Autenticacion solo con PIN (Centro de Control)."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import CurrentUser, get_current_user, require_caja
from app.security import create_access_token, verify_password
from app.services import pin_gate

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for") or ""
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def _is_tv_user_agent(request: Request) -> bool:
    ua = (request.headers.get("user-agent") or "").lower()
    markers = (
        "smart-tv",
        "smarttv",
        "hbbtv",
        "tizen",
        "webos",
        "web0s",
        "bravia",
        "viera",
        "netcast",
        "googletv",
        "appletv",
        "crkey",
        "aftb",
        "aftm",
        "aftt",
        "fire tv",
        "hisense",
        "philips tv",
        "vidaa",
        "opera tv",
        "tv safari",
        "sraf",
    )
    return any(m in ua for m in markers)


class PinRequest(BaseModel):
    pin: str = Field(..., min_length=1, max_length=12)


class PinChangeRequest(BaseModel):
    old_pin: str = Field(..., min_length=1, max_length=12)
    new_pin: str = Field(..., min_length=4, max_length=8)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict


async def _admin_user(db: AsyncSession) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
            SELECT id, codigo, username, nombre, rol::text AS rol
            FROM usuarios
            WHERE activo = TRUE
              AND rol::text IN ('admin', 'operador')
            ORDER BY CASE WHEN rol::text = 'admin' THEN 0 ELSE 1 END, codigo
            LIMIT 1
            """
        )
    )
    row = result.mappings().first()
    if not row:
        # fallback sin fila (no deberia pasar con seed)
        return {
            "id": UUID("00000000-0000-4000-8000-0000000000a1"),
            "codigo": "admin",
            "username": "admin",
            "nombre": "Administrador",
            "rol": "admin",
        }
    return dict(row)


@router.get("/pin/status")
async def pin_status(request: Request) -> dict[str, Any]:
    if _is_tv_user_agent(request):
        raise HTTPException(
            status_code=403,
            detail="El Centro de Control no esta disponible en pantallas TV",
        )
    return pin_gate.status(_client_key(request))


@router.post("/pin", response_model=LoginResponse)
async def pin_login(
    body: PinRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """
    Un solo paso: PIN correcto -> JWT de sesion (sin usuario/contrasena).
    """
    if _is_tv_user_agent(request):
        raise HTTPException(
            status_code=403,
            detail="El Centro de Control no esta disponible en pantallas TV",
        )

    result = pin_gate.verify_pin(body.pin, client_key=_client_key(request))
    if not result.get("ok"):
        code = 429 if result.get("error") == "locked" else 401
        raise HTTPException(status_code=code, detail=result)

    admin = await _admin_user(db)
    token = create_access_token(
        user_id=admin["id"],
        codigo=admin.get("codigo") or "admin",
        rol=admin.get("rol") or "admin",
        nombre=admin.get("nombre") or "Administrador",
    )
    return LoginResponse(
        access_token=token,
        usuario={
            "id": str(admin["id"]),
            "codigo": admin.get("codigo"),
            "username": admin.get("username"),
            "nombre": admin.get("nombre"),
            "rol": admin.get("rol"),
            "auth": "pin",
        },
    )


@router.post("/pin/change")
async def pin_change(
    body: PinChangeRequest,
    request: Request,
    _user: Annotated[CurrentUser, Depends(require_caja)],
) -> dict[str, Any]:
    """Cambia el PIN del panel (4-8 digitos). Requiere sesion JWT."""
    if _is_tv_user_agent(request):
        raise HTTPException(status_code=403, detail="No permitido en TV")
    result = pin_gate.change_pin(body.old_pin, body.new_pin)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result)
    return result


class LoginRequest(BaseModel):
    username: str | None = None
    usuario: str | None = None
    password: str | None = None
    pin: str | None = None
    pin_token: str | None = None


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Autenticación principal: Soporta Usuario y Contraseña (Bcrypt) y PIN."""
    username = (body.username or body.usuario or "").strip()
    password = (body.password or "").strip()
    pin = (body.pin or "").strip()

    # 1. Autenticación con Usuario y Contraseña
    if username and password:
        res = await db.execute(
            text(
                """
                SELECT id, codigo, username, nombre, rol::text AS rol, password_hash, pin_hash, activo
                FROM usuarios
                WHERE (LOWER(username) = LOWER(:u) OR LOWER(codigo) = LOWER(:u))
                  AND activo = TRUE
                LIMIT 1
                """
            ),
            {"u": username},
        )
        row = res.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos",
            )

        valid = False
        if row.get("password_hash") and verify_password(password, row["password_hash"]):
            valid = True
        elif row.get("pin_hash") and verify_password(password, row["pin_hash"]):
            valid = True

        if not valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario o contraseña incorrectos",
            )

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
                "auth": "password",
            },
        )

    # 2. Fallback de PIN si solo se ingresa PIN
    effective_pin = pin or password
    if effective_pin:
        return await pin_login(PinRequest(pin=effective_pin), request, db)

    raise HTTPException(
        status_code=400,
        detail="Ingrese usuario y contraseña para acceder",
    )


@router.get("/me")
async def me(user: Annotated[CurrentUser, Depends(get_current_user)]):
    return {
        "id": str(user.id),
        "codigo": user.codigo,
        "nombre": user.nombre,
        "rol": user.rol,
        "puede_caja": user.puede_caja,
        "auth": "pin",
    }
