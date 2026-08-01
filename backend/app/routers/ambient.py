"""API música ambiente (control estilo Winamp → host player → amplificador)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import require_caja
from app.services import ambient_config as amb_cfg
from app.services import ambient_music as amb

router = APIRouter(prefix="/api/ambient", tags=["ambient-music"])


class PlayIn(BaseModel):
    folder: str | None = None
    track_id: int | None = None


class ToggleIn(BaseModel):
    on: bool = True


class VolumeIn(BaseModel):
    volume: int = Field(ge=0, le=100)


class UiConfigIn(BaseModel):
    """Configuración de banners / UI del modo ambiente."""

    now_playing_show_ms: int | None = Field(default=None, ge=2000, le=60000)
    now_playing_max_elapsed_s: int | None = Field(default=None, ge=3, le=120)
    now_playing_enabled: bool | None = None
    mensajes_duracion_ms: int | None = Field(default=None, ge=3000, le=120000)
    banner_marquee_enabled: bool | None = None
    banner_marquee_speed_px_s: int | None = Field(default=None, ge=15, le=120)
    pause_on_event: bool | None = None


@router.get("/status")
async def status() -> dict[str, Any]:
    """Público: estado del host + config UI (duraciones de banners, marquesina…)."""
    return await amb.get_status()


@router.get("/config")
async def get_config() -> dict[str, Any]:
    """Público: solo config de UI/banners del modo ambiente (sin host)."""
    cfg = amb_cfg.get_ui_config()
    return {"ok": True, "config": cfg, **cfg}


@router.put("/config")
async def put_config(body: UiConfigIn, _user=Depends(require_caja)) -> dict[str, Any]:
    """Actualiza config de banners/UI; se propaga a las TVs por WebSocket."""
    patch = body.model_dump(exclude_none=True)
    cfg = amb_cfg.update_ui_config(patch)
    # Espejar pause_on_event al host si viene en el patch
    if "pause_on_event" in patch:
        await amb.set_pause_on_event(bool(patch["pause_on_event"]))
    await amb_cfg.broadcast_ui_config(cfg)
    return {"ok": True, "config": cfg, **cfg}


@router.get("/library")
async def library(
    folder: str | None = None,
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await amb.get_library(folder)


@router.post("/play")
async def play(body: PlayIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.play(folder=body.folder, track_id=body.track_id)


@router.post("/pause")
async def pause(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.pause()


@router.post("/resume")
async def resume(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.resume()


@router.post("/stop")
async def stop(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.stop()


@router.post("/next")
async def next_track(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.next_track()


@router.post("/prev")
async def prev_track(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.prev_track()


@router.post("/shuffle")
async def shuffle(body: ToggleIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.set_shuffle(body.on)


@router.post("/volume")
async def volume(body: VolumeIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.set_volume(body.volume)


@router.post("/pause-on-event")
async def pause_on_event(body: ToggleIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.set_pause_on_event(body.on)


@router.post("/scan")
async def scan(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.scan()


@router.post("/broadcast")
async def broadcast(_user=Depends(require_caja)) -> dict[str, Any]:
    await amb.broadcast_now_playing()
    return {"ok": True}
