"""API de entrega de contenido: manifiestos, lease 1-a-1, sensor, turno video."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_caja
from app.services import content_delivery as cd
from app.services.resources import get_resources

router = APIRouter(prefix="/api/content", tags=["content-delivery"])


class LeaseIn(BaseModel):
    tv_id: int = Field(ge=1, le=6)
    reason: str = "sync"


class ReleaseIn(BaseModel):
    tv_id: int = Field(ge=1, le=6)
    lease_id: str | None = None


class AckIn(BaseModel):
    tv_id: int = Field(ge=1, le=6)
    version: str
    cached_bytes: int = 0
    assets_ok: int = 0
    assets_fail: int = 0
    display_ready: bool = True


class VideoDoneIn(BaseModel):
    tv_id: int = Field(ge=1, le=6)
    token: str | None = None


@router.get("/resources")
async def resources(force: bool = False) -> dict[str, Any]:
    """Sensor de CPU/RAM y política actual (público para TVs)."""
    return get_resources(force=force)


@router.get("/status")
async def status(
    _user=Depends(require_caja),
) -> dict[str, Any]:
    """Estado de cola + sensor (admin)."""
    return cd.get_delivery_status()


@router.get("/manifest/{tv_id}")
async def manifest(
    tv_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if tv_id < 1 or tv_id > 6:
        raise HTTPException(400, "tv_id 1-6")
    try:
        return await cd.build_manifest(db, tv_id)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/lease")
async def lease(body: LeaseIn) -> dict[str, Any]:
    """Pide canal exclusivo de descarga (1 TV a la vez, prioridad 1–2)."""
    return cd.request_lease(body.tv_id, reason=body.reason)


@router.post("/lease/release")
async def lease_release(body: ReleaseIn) -> dict[str, Any]:
    return cd.release_lease(body.tv_id, body.lease_id)


@router.post("/ack")
async def ack(body: AckIn) -> dict[str, Any]:
    return cd.ack_cache(
        body.tv_id,
        version=body.version,
        cached_bytes=body.cached_bytes,
        assets_ok=body.assets_ok,
        assets_fail=body.assets_fail,
        display_ready=body.display_ready,
    )


@router.get("/video-turn")
async def video_turn(
    tv_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Consulta / avanza turno de video (1 TV).
    Las TVs publicitarias llaman al montar y al terminar un clip.
    """
    current = await cd.tick_video_turn(db)
    if tv_id is not None:
        mine = cd.get_video_turn_for(tv_id)
        return {
            "for_you": mine is not None,
            "turn": mine,
            "global": current,
        }
    return {"turn": current}


@router.post("/video-done")
async def video_done(body: VideoDoneIn) -> dict[str, Any]:
    return cd.video_done(body.tv_id, body.token)
