"""
Configuración de UI / banners del modo ambiente.
Persistida en disco y expuesta en /api/ambient/config y /status.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any

from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

_lock = threading.RLock()
_config: dict[str, Any] | None = None

# Defaults (TVs y panel admin)
DEFAULTS: dict[str, Any] = {
    # Toast "Ahora suena" (ms)
    "now_playing_show_ms": 5000,
    # Solo anunciar si la pista lleva menos de N segundos
    "now_playing_max_elapsed_s": 12,
    "now_playing_enabled": True,
    # Banner Chef / ¿Sabías qué? (ms por mensaje)
    "mensajes_duracion_ms": 9000,
    # Marquesina cuando el texto no cabe
    "banner_marquee_enabled": True,
    # px/s aprox. para calcular duración de la marquesina
    "banner_marquee_speed_px_s": 42,
    # Pausar música en modo evento (espejo de host; también se controla ahí)
    "pause_on_event": True,
    # Metadatos
    "updated_at": None,
}

# Claves editables vía API
EDITABLE = {
    "now_playing_show_ms",
    "now_playing_max_elapsed_s",
    "now_playing_enabled",
    "mensajes_duracion_ms",
    "banner_marquee_enabled",
    "banner_marquee_speed_px_s",
    "pause_on_event",
}


def _config_path() -> Path:
    # Montado en Docker como ./backend/app → /app/app
    return Path(__file__).resolve().parent.parent / "data" / "ambient_ui_config.json"


def _clamp_int(v: Any, lo: int, hi: int, default: int) -> int:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _clamp_bool(v: Any, default: bool) -> bool:
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "on", "si", "sí"):
        return True
    if s in ("0", "false", "no", "off"):
        return False
    return default


def sanitize(raw: dict[str, Any] | None) -> dict[str, Any]:
    base = dict(DEFAULTS)
    if not isinstance(raw, dict):
        return base
    base["now_playing_show_ms"] = _clamp_int(
        raw.get("now_playing_show_ms"), 2000, 60000, DEFAULTS["now_playing_show_ms"]
    )
    base["now_playing_max_elapsed_s"] = _clamp_int(
        raw.get("now_playing_max_elapsed_s"),
        3,
        120,
        DEFAULTS["now_playing_max_elapsed_s"],
    )
    base["now_playing_enabled"] = _clamp_bool(
        raw.get("now_playing_enabled"), DEFAULTS["now_playing_enabled"]
    )
    base["mensajes_duracion_ms"] = _clamp_int(
        raw.get("mensajes_duracion_ms"), 3000, 120000, DEFAULTS["mensajes_duracion_ms"]
    )
    base["banner_marquee_enabled"] = _clamp_bool(
        raw.get("banner_marquee_enabled"), DEFAULTS["banner_marquee_enabled"]
    )
    base["banner_marquee_speed_px_s"] = _clamp_int(
        raw.get("banner_marquee_speed_px_s"),
        15,
        120,
        DEFAULTS["banner_marquee_speed_px_s"],
    )
    base["pause_on_event"] = _clamp_bool(
        raw.get("pause_on_event"), DEFAULTS["pause_on_event"]
    )
    if raw.get("updated_at") is not None:
        base["updated_at"] = raw.get("updated_at")
    return base


def _load() -> dict[str, Any]:
    global _config
    with _lock:
        if _config is not None:
            return dict(_config)
        path = _config_path()
        data: dict[str, Any] = {}
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                data = {}
        _config = sanitize(data)
        return dict(_config)


def _save(cfg: dict[str, Any]) -> None:
    path = _config_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(cfg, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def get_ui_config() -> dict[str, Any]:
    """Config de banners/UI del modo ambiente (pública para TVs)."""
    return _load()


def update_ui_config(patch: dict[str, Any] | None) -> dict[str, Any]:
    global _config
    with _lock:
        cur = _load()
        if isinstance(patch, dict):
            for k in EDITABLE:
                if k in patch:
                    cur[k] = patch[k]
        cur = sanitize(cur)
        cur["updated_at"] = int(time.time())
        _config = cur
        _save(cur)
        return dict(cur)


async def broadcast_ui_config(cfg: dict[str, Any] | None = None) -> None:
    payload = {
        "t": "ambient_cfg",
        "config": cfg or get_ui_config(),
        "ts": int(time.time()),
    }
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)
