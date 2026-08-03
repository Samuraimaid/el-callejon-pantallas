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

# Autoplay solo si config autoplay_on_boot=true (default false)
_need_autoplay: bool = False
_last_ensure_ts: float = 0.0
_ENSURE_COOLDOWN_S = 20.0
_AUTOPLAY_MODE = (os.environ.get("AMBIENT_AUTOPLAY") or "default").strip() or "default"


def _autoplay_on_boot_enabled() -> bool:
    try:
        from app.services import ambient_config as amb_cfg

        return bool(amb_cfg.get_ui_config().get("autoplay_on_boot"))
    except Exception:
        return False


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
                "El vigilante del PC lo reintentara en segundos "
                "(Watch-AmbientHost / Start-AmbientHost). "
                "Si persiste: ejecute scripts\\Start-AmbientHost.ps1"
            ),
            "detail": str(e),
            "host": host_url(),
            "recovering": True,
        }


async def ensure_playing_if_needed(
    st: dict[str, Any] | None = None,
    *,
    force: bool = False,
) -> dict[str, Any] | None:
    """
    Si el host esta online y no suena (y no esta en pausa), pide autoplay.

    - force=True: panel admin / ensure-play (siempre intenta).
    - force=False: solo si autoplay_on_boot=true en /api/ambient/config
      (por defecto NO arranca musica sola).
    No pelea con pausa manual del operador.
    """
    global _need_autoplay, _last_ensure_ts

    if st is None:
        st = await _req("GET", "/status")

    boot_ok = _autoplay_on_boot_enabled()

    if not st or st.get("offline") or not st.get("ok"):
        # Host caido: solo reintentar autoplay al volver si esta habilitado
        _need_autoplay = bool(boot_ok or force)
        return st

    if st.get("playing"):
        _need_autoplay = False
        return st

    if st.get("paused"):
        # Operador en pausa: no forzar
        _need_autoplay = False
        return st

    # Sin force: solo si el flag de arranque/recuperacion esta activo
    # (no re-lanzar musica cada poll si el operador la detuvo a mano)
    if not force:
        if not boot_ok:
            _need_autoplay = False
            return st
        if not _need_autoplay:
            return st

    now = time.time()
    if not force and (now - _last_ensure_ts) < _ENSURE_COOLDOWN_S:
        return st

    _last_ensure_ts = now
    mode = _AUTOPLAY_MODE
    # Preferir endpoint unificado del host
    res = await _req("POST", "/ensure-play", {"mode": mode}, timeout=12.0)
    if res.get("offline") or (
        not res.get("ok") and res.get("error", "").startswith("host HTTP")
    ):
        # Host viejo sin /ensure-play → fallback
        likes_pl = await _req("GET", "/playlists", timeout=5.0)
        likes = likes_pl.get("likes") if isinstance(likes_pl, dict) else None
        if likes:
            res = await _req(
                "POST",
                "/playlist/play",
                {"name": "likes", "shuffle": True},
                timeout=12.0,
            )
        else:
            await _req("POST", "/mode", {"mode": "all_shuffle"}, timeout=8.0)
            res = await _req("POST", "/play", {"folder": ""}, timeout=8.0)

    if res.get("ok") and res.get("playing"):
        _need_autoplay = False
        # Fuerza banner "Ahora suena" al arrancar / recuperar host
        try:
            await broadcast_now_playing(res, force=True)
        except Exception:
            try:
                await maybe_broadcast(res)
            except Exception:
                pass
        return res

    # Si respondio ok pero aun no playing (buffer), no spamear
    if res.get("ok"):
        _need_autoplay = False
        return res

    return st


async def get_status() -> dict[str, Any]:
    from app.services import album_art
    from app.services import ambient_config as amb_cfg

    st = await _req("GET", "/status")
    # Tras offline o arranque: intentar autoplay sin que el operador pulse Play
    try:
        ensured = await ensure_playing_if_needed(st)
        if ensured and ensured.get("ok"):
            st = ensured
    except Exception:
        pass

    # Importante: NO tocar _last_status aquí antes de maybe_broadcast.
    if st.get("ok"):
        await maybe_broadcast(st)
    st = dict(st) if isinstance(st, dict) else {"ok": False}
    # Limpiar título/artista + carátula (cache local)
    if st.get("current"):
        try:
            st["current"] = await album_art.enrich_track(st.get("current"))
        except Exception:
            pass
    ui = amb_cfg.get_ui_config()
    st["ui"] = ui
    st["config"] = ui
    if st.get("offline"):
        st["recovering"] = True
    return st


async def poll_host_for_track_changes() -> dict[str, Any] | None:
    """
    Llamado por el loop en background del backend.
    Detecta cambio de canción aunque no haya panel admin abierto.
    Tambien reintenta autoplay tras caida del host.
    """
    st = await _req("GET", "/status")
    try:
        st2 = await ensure_playing_if_needed(st)
        if st2 and st2.get("ok"):
            st = st2
    except Exception:
        pass
    if not st or not st.get("ok"):
        return None
    await maybe_broadcast(st)
    return st


async def get_library(folder: str | None = None) -> dict[str, Any]:
    from app.services import album_art

    q = f"?folder={folder}" if folder else ""
    lib = await _req("GET", f"/library{q}")
    if not lib.get("ok"):
        return lib
    items = []
    for t in lib.get("items") or []:
        cleaned = album_art.clean_title_artist(
            t.get("title") or "", t.get("artist") or ""
        )
        row = {**t, **cleaned}
        # cover si ya esta en cache disco
        key_art = None
        try:
            # no bloquear: solo ruta si existe
            from pathlib import Path
            from app.config import get_settings
            import hashlib

            raw = f"{cleaned['artist']}|{cleaned['title']}".lower().encode()
            k = hashlib.sha1(raw).hexdigest()[:16]
            p = Path(get_settings().image_root) / "covers" / f"{k}.jpg"
            if p.is_file():
                key_art = f"/images/covers/{k}.jpg"
        except Exception:
            pass
        if key_art:
            row["cover_url"] = key_art
        items.append(row)
    lib["items"] = items
    return lib


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
    """
    Rescanea la biblioteca del host y normaliza archivos DEFINITIVAMENTE:
    renombra MP3, escribe ID3 y embebe caratula (en el host).
    Solo reprocesa archivos que aun no estan normalizados.
    """
    # Timeout alto: iTunes + rename de muchos archivos
    st = await _req("POST", "/scan", {}, timeout=600.0)
    if isinstance(st, dict):
        st.setdefault(
            "message",
            "Scan + normalizacion (nombres, ID3, caratulas) completados",
        )
    return st


async def normalize_library(force: bool = False) -> dict[str, Any]:
    """Solo normalizacion (sin rescan previo)."""
    return await _req(
        "POST", "/normalize", {"force": force}, timeout=600.0
    )


async def set_play_mode(mode: str, folder: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"mode": mode}
    if folder is not None:
        body["folder"] = folder
    st = await _req("POST", "/mode", body)
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


async def like_track(
    rel: str | None = None, liked: bool | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if rel is not None:
        body["rel"] = rel
    if liked is not None:
        body["liked"] = liked
    return await _req("POST", "/like", body)


async def get_playlists() -> dict[str, Any]:
    return await _req("GET", "/playlists")


async def create_playlist(name: str) -> dict[str, Any]:
    return await _req("POST", "/playlist/create", {"name": name})


async def delete_playlist(name: str) -> dict[str, Any]:
    return await _req("POST", "/playlist/delete", {"name": name})


async def playlist_add(name: str, rel: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"name": name}
    if rel is not None:
        body["rel"] = rel
    return await _req("POST", "/playlist/add", body)


async def playlist_remove(name: str, rel: str) -> dict[str, Any]:
    return await _req("POST", "/playlist/remove", {"name": name, "rel": rel})


async def playlist_play(name: str, shuffle: bool = True) -> dict[str, Any]:
    st = await _req(
        "POST", "/playlist/play", {"name": name, "shuffle": shuffle}
    )
    if st.get("ok"):
        await broadcast_now_playing(st)
    return st


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
    # Enriquecer con nombres limpios + carátula
    try:
        from app.services import album_art

        cur = await album_art.enrich_track(cur) or cur
    except Exception:
        pass

    _last_status = {**(st or {}), "current": cur}
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
        "cover_url": cur.get("cover_url") or cur.get("album_art") or "",
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
    # Primera vez que vemos una pista en esta sesion de backend
    first_track = is_playing and bool(cur_key) and not prev_key
    if (track_changed or started or first_track) and is_playing:
        await broadcast_now_playing(st, force=True)
    else:
        _last_status = st


def cached_status() -> dict[str, Any]:
    return dict(_last_status) if _last_status else {"ok": False, "playing": False}
