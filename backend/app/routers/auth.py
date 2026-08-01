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
from app.security import create_access_token
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


# Compat: /login redirige a mensaje de usar PIN
class LoginRequest(BaseModel):
    usuario: str | None = None
    password: str | None = None
    pin: str | None = None
    pin_token: str | None = None


@router.post("/login", response_model=LoginResponse)
async def login_compat(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Compatibilidad: acepta {pin} igual que POST /pin."""
    pin = (body.pin or body.password or "").strip()
    if not pin:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "pin_only",
                "message": "Use solo el PIN de acceso (POST /api/auth/pin)",
            },
        )
    return await pin_login(PinRequest(pin=pin), request, db)


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
