"""API de configuración de pantallas (menú board TV #1 / #2)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_caja
from app.services import config_menu

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/menu-board")
async def get_menu_board(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Público para las TVs (sin auth)."""
    return await config_menu.get_menu_board_config(db)


@router.put("/menu-board")
async def put_menu_board(
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await config_menu.save_menu_board_config(db, body)
