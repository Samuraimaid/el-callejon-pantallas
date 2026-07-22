from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.ws_manager import ws_manager

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "el-callejon-pantallas",
        "ws_clients": ws_manager.count,
    }


@router.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(text("SELECT 1 AS ok"))
    row = result.mappings().first()
    return {"status": "ok", "database": bool(row and row["ok"] == 1)}
