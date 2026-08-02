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
    # Musica al iniciar el sistema (default false)
    autoplay_on_boot: bool | None = None
    # TVs publicidad #3–#6: sin efectos de transición
    publicidad_lite_mode: bool | None = None


class BootAutoplayIn(BaseModel):
    """Solo flag de autoplay al arrancar el PC / backend."""

    autoplay_on_boot: bool = False


class PublicidadLiteIn(BaseModel):
    """Modo lite en pantallas de publicidad TV #3–#6."""

    publicidad_lite_mode: bool = False
    # Alias corto
    lite_mode: bool | None = None


@router.get("/status")
async def status() -> dict[str, Any]:
    """Público: estado del host + config UI (duraciones de banners, marquesina…).

    Autoplay al arrancar solo si autoplay_on_boot=true en config.
    """
    return await amb.get_status()


@router.post("/ensure-play")
async def ensure_play(_user=Depends(require_caja)) -> dict[str, Any]:
    """Fuerza autoplay en el host (Me gusta o shuffle), ignora autoplay_on_boot."""
    st = await amb.ensure_playing_if_needed(force=True)
    if st is None:
        return {"ok": False, "error": "sin respuesta del host"}
    return st


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


@router.get("/boot-autoplay")
async def get_boot_autoplay() -> dict[str, Any]:
    """
    Público: si la música debe iniciar sola al encender el sistema.
    Por defecto false (no autoplay).
    """
    cfg = amb_cfg.get_ui_config()
    on = bool(cfg.get("autoplay_on_boot"))
    return {
        "ok": True,
        "autoplay_on_boot": on,
        "enabled": on,
        "message": (
            "La musica arrancara sola al iniciar el PC/servidor"
            if on
            else "La musica NO arranca sola; use Play en el panel o active autoplay_on_boot"
        ),
    }


@router.put("/boot-autoplay")
async def put_boot_autoplay(
    body: BootAutoplayIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    """Activa/desactiva autoplay al iniciar el sistema (requiere sesion admin)."""
    cfg = amb_cfg.update_ui_config({"autoplay_on_boot": bool(body.autoplay_on_boot)})
    await amb_cfg.broadcast_ui_config(cfg)
    on = bool(cfg.get("autoplay_on_boot"))
    return {
        "ok": True,
        "autoplay_on_boot": on,
        "enabled": on,
        "config": cfg,
        "message": "Autoplay al arranque ACTIVADO" if on else "Autoplay al arranque DESACTIVADO",
    }


@router.get("/publicidad-lite")
async def get_publicidad_lite() -> dict[str, Any]:
    """Público (TVs): modo lite = imagenes fijas sin efectos de transición."""
    cfg = amb_cfg.get_ui_config()
    lite = bool(cfg.get("publicidad_lite_mode"))
    return {
        "ok": True,
        "publicidad_lite_mode": lite,
        "lite_mode": lite,
        "message": (
            "TVs #3-#6 en modo lite (sin transiciones)"
            if lite
            else "TVs #3-#6 en modo completo (con efectos)"
        ),
    }


@router.put("/publicidad-lite")
async def put_publicidad_lite(
    body: PublicidadLiteIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    """Activa/desactiva modo lite en publicidad TV #3–#6."""
    lite = body.publicidad_lite_mode
    if body.lite_mode is not None:
        lite = bool(body.lite_mode)
    cfg = amb_cfg.update_ui_config({"publicidad_lite_mode": bool(lite)})
    await amb_cfg.broadcast_ui_config(cfg)
    on = bool(cfg.get("publicidad_lite_mode"))
    return {
        "ok": True,
        "publicidad_lite_mode": on,
        "lite_mode": on,
        "config": cfg,
        "message": "Modo lite ACTIVADO" if on else "Modo lite DESACTIVADO",
    }


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


class ModeIn(BaseModel):
    """Modos: all_shuffle | all_order | folder_shuffle | folder_order"""

    mode: str = "all_shuffle"
    folder: str | None = None


@router.post("/mode")
async def play_mode(body: ModeIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.set_play_mode(body.mode, folder=body.folder)


@router.post("/volume")
async def volume(body: VolumeIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.set_volume(body.volume)


@router.post("/pause-on-event")
async def pause_on_event(body: ToggleIn, _user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.set_pause_on_event(body.on)


@router.post("/scan")
async def scan(_user=Depends(require_caja)) -> dict[str, Any]:
    """
    Rescanea MP3 y normaliza archivos de forma DEFINITIVA:
    renombra a 'Artista - Titulo.mp3', escribe ID3 y embebe caratula.
    Los ya normalizados se saltan (proceso una sola vez).
    """
    return await amb.scan()


class NormalizeIn(BaseModel):
    force: bool = False


@router.post("/normalize")
async def normalize(
    body: NormalizeIn | None = None, _user=Depends(require_caja)
) -> dict[str, Any]:
    """Solo renombrar + ID3 + caratula (sin depender de scan)."""
    force = bool(body.force) if body else False
    return await amb.normalize_library(force=force)


@router.post("/broadcast")
async def broadcast(_user=Depends(require_caja)) -> dict[str, Any]:
    await amb.broadcast_now_playing()
    return {"ok": True}


class LikeIn(BaseModel):
    rel: str | None = None
    liked: bool | None = None


class PlaylistNameIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)


class PlaylistTrackIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    rel: str | None = None


class PlaylistPlayIn(BaseModel):
    name: str = "likes"
    shuffle: bool = True


@router.post("/like")
async def like(body: LikeIn, _user=Depends(require_caja)) -> dict[str, Any]:
    """Me gusta / quitar me gusta (lista Me gusta)."""
    return await amb.like_track(rel=body.rel, liked=body.liked)


@router.get("/playlists")
async def playlists(_user=Depends(require_caja)) -> dict[str, Any]:
    return await amb.get_playlists()


@router.post("/playlist/create")
async def playlist_create(
    body: PlaylistNameIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    return await amb.create_playlist(body.name)


@router.post("/playlist/delete")
async def playlist_delete(
    body: PlaylistNameIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    return await amb.delete_playlist(body.name)


@router.post("/playlist/add")
async def playlist_add(
    body: PlaylistTrackIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    return await amb.playlist_add(body.name, rel=body.rel)


@router.post("/playlist/remove")
async def playlist_remove(
    body: PlaylistTrackIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    if not body.rel:
        return {"ok": False, "error": "rel requerido"}
    return await amb.playlist_remove(body.name, body.rel)


@router.post("/playlist/play")
async def playlist_play(
    body: PlaylistPlayIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    return await amb.playlist_play(body.name, shuffle=body.shuffle)
