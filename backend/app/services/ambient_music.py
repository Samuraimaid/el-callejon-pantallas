"""Cliente del reproductor ambiente del host Windows + broadcast now_playing."""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

# Desde Docker hacia el PC Windows
DEFAULT_HOST = os.environ.get("AMBIENT_HOST_URL", "http://host.docker.internal:8788")

_last_status: dict[str, Any] = {}
_last_broadcast = 0.0


def host_url() -> str:
    return (os.environ.get("AMBIENT_HOST_URL") or DEFAULT_HOST).rstrip("/")


async def _req(
    method: str, path: str, json_body: dict | None = None, timeout: float = 8.0
) -> dict[str, Any]:
    url = f"{host_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.request(method, url, json=json_body)
            if r.status_code >= 400:
                return {
                    "ok": False,
                    "error": f"host HTTP {r.status_code}",
                    "detail": r.text[:200],
                    "offline": False,
                }
            data = r.json()
            if isinstance(data, dict):
                data.setdefault("ok", True)
                data["host"] = host_url()
                return data
            return {"ok": True, "data": data, "host": host_url()}
    except Exception as e:
        return {
            "ok": False,
            "offline": True,
            "error": (
                "Reproductor host no disponible. "
                "En el PC Windows ejecute: python scripts/ambient_host_player.py"
            ),
            "detail": str(e),
            "host": host_url(),
        }


async def get_status() -> dict[str, Any]:
    from app.services import ambient_config as amb_cfg

    st = await _req("GET", "/status")
    # Importante: NO tocar _last_status aquí antes de maybe_broadcast.
    # Si se actualiza antes, track_changed siempre es False y nunca hay toast.
    if st.get("ok"):
        await maybe_broadcast(st)
    # Siempre adjuntar config de UI/banners (también si host offline)
    ui = amb_cfg.get_ui_config()
    st = dict(st) if isinstance(st, dict) else {"ok": False}
    st["ui"] = ui
    st["config"] = ui  # alias
    return st


async def poll_host_for_track_changes() -> dict[str, Any] | None:
    """
    Llamado por el loop en background del backend.
    Detecta cambio de canción aunque no haya panel admin abierto.
    """
    st = await _req("GET", "/status")
    if not st.get("ok"):
        return None
    await maybe_broadcast(st)
    return st


async def get_library(folder: str | None = None) -> dict[str, Any]:
    q = f"?folder={folder}" if folder else ""
    return await _req("GET", f"/library{q}")


async def play(folder: str | None = None, track_id: int | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if folder is not None:
        body["folder"] = folder
    if track_id is not None:
        body["track_id"] = track_id
    st = await _req("POST", "/play", body)
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


async def pause() -> dict[str, Any]:
    st = await _req("POST", "/pause", {})
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


async def resume() -> dict[str, Any]:
    st = await _req("POST", "/resume", {})
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


async def stop() -> dict[str, Any]:
    st = await _req("POST", "/stop", {})
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


async def next_track() -> dict[str, Any]:
    st = await _req("POST", "/next", {})
    if st.get("ok"):
        # Re-leer status por si el worker aún asentaba la pista
        st2 = await _req("GET", "/status")
        if st2.get("ok") and st2.get("current"):
            st = st2
        await broadcast_now_playing(st)
    return st


async def prev_track() -> dict[str, Any]:
    st = await _req("POST", "/prev", {})
    if st.get("ok"):
        st2 = await _req("GET", "/status")
        if st2.get("ok") and st2.get("current"):
            st = st2
        await broadcast_now_playing(st)
    return st


async def set_shuffle(on: bool) -> dict[str, Any]:
    return await _req("POST", "/shuffle", {"on": on})


async def set_volume(volume: int) -> dict[str, Any]:
    return await _req("POST", "/volume", {"volume": volume})


async def set_pause_on_event(on: bool) -> dict[str, Any]:
    return await _req("POST", "/pause_on_event", {"on": on})


async def event_hook(modo_evento: bool) -> dict[str, Any]:
    st = await _req("POST", "/event_hook", {"modo_evento": modo_evento})
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


async def scan() -> dict[str, Any]:
    return await _req("POST", "/scan", {})


def _track_key(cur: dict | None) -> str:
    if not cur:
        return ""
    return str(cur.get("rel") or cur.get("id") or f"{cur.get('artist')}|{cur.get('title')}")


async def broadcast_now_playing(
    st: dict[str, Any] | None = None, *, force: bool = False
) -> None:
    global _last_broadcast, _last_status
    if st is None:
        # Evitar recursión: leer host sin maybe_broadcast
        st = await _req("GET", "/status")
    if not st.get("ok"):
        return
    # No anunciar pistas si no está sonando de verdad
    if not st.get("playing") or st.get("paused"):
        _last_status = st
        return
    cur = st.get("current") or {}
    if not (cur.get("title") or cur.get("rel")):
        _last_status = st
        return
    # No rebroadcast de pistas ya avanzadas (evitar toast de canción vieja)
    elapsed = int(st.get("elapsed_s") or 0)
    if not force and elapsed > 20:
        _last_status = st
        return
    _last_status = st
    payload = {
        "t": "now_playing",
        "playing": True,
        "paused": False,
        "track_id": cur.get("id"),
        "rel": cur.get("rel") or "",
        "title": cur.get("title") or "",
        "artist": cur.get("artist") or "",
        "album": cur.get("album") or "",
        "folder": cur.get("folder") or "",
        "started_at": cur.get("started_at") or st.get("started_at"),
        "elapsed_s": elapsed,
        "volume": st.get("volume"),
        "ts": int(time.time()),
        "tvs": [3, 4, 5, 6],
    }
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)
    _last_broadcast = time.time()


async def maybe_broadcast(st: dict[str, Any]) -> None:
    """Solo al cambiar de pista (inicio de canción), no de forma recurrente."""
    global _last_status
    if not st.get("ok"):
        return
    cur = (st or {}).get("current") or {}
    prev = (_last_status or {}).get("current") or {}
    prev_key = _track_key(prev)
    cur_key = _track_key(cur)
    track_changed = bool(cur_key) and cur_key != prev_key
    was_playing = bool((_last_status or {}).get("playing")) and not bool(
        (_last_status or {}).get("paused")
    )
    is_playing = bool(st.get("playing")) and not bool(st.get("paused"))
    started = is_playing and not was_playing
    if (track_changed or started) and is_playing:
        await broadcast_now_playing(st, force=True)
    else:
        _last_status = st


def cached_status() -> dict[str, Any]:
    return dict(_last_status) if _last_status else {"ok": False, "playing": False}
