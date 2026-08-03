"""
Configuración de respaldos automáticos (horario, contenido, modo).
Persistida en disco; el script Windows lee el mismo JSON.
"""

from __future__ import annotations

import json
import threading
import time
from copy import deepcopy
from pathlib import Path
from typing import Any

_lock = threading.RLock()
_config: dict[str, Any] | None = None

DEFAULTS: dict[str, Any] = {
    "enabled": True,
    # Hora local HH:MM (24h) — default 15:30
    "time": "15:30",
    # 0=domingo … 6=sábado (como JS / menú)
    "days": [0, 1, 2, 3, 4, 5, 6],
    # Vacío = <proyecto>/snapshots/daily
    "destination": "",
    # content | full | migrate
    # content = sin software (multimedia + BD + config usuario)
    # full    = con software (código + scripts + compose)
    # migrate = full + paquete listo para otro PC (instalador)
    "mode": "content",
    "incremental": True,
    "keep_days": 14,
    "keep_full_count": 3,
    "include": {
        "music": True,
        "images": True,
        "videos": True,
        "postgres": True,
        "env": True,
        "config": True,
        "source_code": False,
        "installer": False,
        "docker_compose": False,
    },
    "migrate_bundle": False,
    "last_run": None,
    "last_status": None,
    "last_path": None,
    "last_error": None,
    "updated_at": None,
}

EDITABLE = {
    "enabled",
    "time",
    "days",
    "destination",
    "mode",
    "incremental",
    "keep_days",
    "keep_full_count",
    "include",
    "migrate_bundle",
}


def _config_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "backup_config.json"


def _request_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "backup_run_request.json"


def _history_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "backup_history.json"


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


def _clamp_int(v: Any, lo: int, hi: int, default: int) -> int:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _sanitize_time(raw: Any) -> str:
    s = str(raw or "15:30").strip()
    parts = s.replace(".", ":").split(":")
    try:
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return "15:30"
    h = max(0, min(23, h))
    m = max(0, min(59, m))
    return f"{h:02d}:{m:02d}"


def _sanitize_days(raw: Any) -> list[int]:
    if raw is None:
        return list(DEFAULTS["days"])
    if not isinstance(raw, (list, tuple)):
        return list(DEFAULTS["days"])
    out: list[int] = []
    for d in raw:
        try:
            n = int(d)
        except (TypeError, ValueError):
            continue
        if 0 <= n <= 6 and n not in out:
            out.append(n)
    out.sort()
    return out if out else list(DEFAULTS["days"])


def _sanitize_mode(raw: Any) -> str:
    m = str(raw or "content").strip().lower()
    aliases = {
        "content": "content",
        "sin_software": "content",
        "sin-software": "content",
        "data": "content",
        "multimedia": "content",
        "full": "full",
        "con_software": "full",
        "con-software": "full",
        "software": "full",
        "migrate": "migrate",
        "migracion": "migrate",
        "migración": "migrate",
        "paquete": "migrate",
        "bundle": "migrate",
    }
    return aliases.get(m, "content")


def sanitize(raw: dict[str, Any] | None) -> dict[str, Any]:
    base = deepcopy(DEFAULTS)
    if not isinstance(raw, dict):
        return base
    base["enabled"] = _clamp_bool(raw.get("enabled"), DEFAULTS["enabled"])
    base["time"] = _sanitize_time(raw.get("time"))
    base["days"] = _sanitize_days(raw.get("days"))
    dest = raw.get("destination")
    base["destination"] = str(dest).strip() if dest is not None else ""
    base["mode"] = _sanitize_mode(raw.get("mode"))
    base["incremental"] = _clamp_bool(raw.get("incremental"), True)
    base["keep_days"] = _clamp_int(raw.get("keep_days"), 1, 365, 14)
    base["keep_full_count"] = _clamp_int(raw.get("keep_full_count"), 1, 30, 3)
    base["migrate_bundle"] = _clamp_bool(raw.get("migrate_bundle"), False)

    inc_in = raw.get("include") if isinstance(raw.get("include"), dict) else {}
    inc = dict(DEFAULTS["include"])
    for k in inc:
        if k in inc_in:
            inc[k] = _clamp_bool(inc_in.get(k), inc[k])
    # Ajustar include según modo (el script también lo aplica)
    if base["mode"] == "full":
        inc["source_code"] = True
        inc["installer"] = True
        inc["docker_compose"] = True
    if base["mode"] == "migrate":
        for k in inc:
            inc[k] = True
        base["migrate_bundle"] = True
    base["include"] = inc

    for k in ("last_run", "last_status", "last_path", "last_error", "updated_at"):
        if k in raw:
            base[k] = raw.get(k)
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


def get_config() -> dict[str, Any]:
    return _load()


def update_config(patch: dict[str, Any] | None) -> dict[str, Any]:
    global _config
    with _lock:
        cur = _load()
        if isinstance(patch, dict):
            for k in EDITABLE:
                if k not in patch:
                    continue
                if k == "include" and isinstance(patch["include"], dict):
                    cur_inc = dict(cur.get("include") or {})
                    cur_inc.update(patch["include"])
                    cur["include"] = cur_inc
                else:
                    cur[k] = patch[k]
        cur = sanitize(cur)
        cur["updated_at"] = int(time.time())
        _config = cur
        _save(cur)
        return dict(cur)


def record_run(
    *,
    status: str,
    path: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    global _config
    with _lock:
        cur = _load()
        cur["last_run"] = int(time.time())
        cur["last_status"] = status
        cur["last_path"] = path
        cur["last_error"] = error
        cur["updated_at"] = int(time.time())
        _config = cur
        _save(cur)
        # historial corto
        try:
            hist: list[Any] = []
            hp = _history_path()
            if hp.is_file():
                hist = json.loads(hp.read_text(encoding="utf-8"))
            if not isinstance(hist, list):
                hist = []
            hist.insert(
                0,
                {
                    "ts": cur["last_run"],
                    "status": status,
                    "path": path,
                    "error": error,
                    "mode": cur.get("mode"),
                },
            )
            hist = hist[:40]
            hp.write_text(json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
        return dict(cur)


def get_history(limit: int = 20) -> list[dict[str, Any]]:
    try:
        hp = _history_path()
        if not hp.is_file():
            return []
        hist = json.loads(hp.read_text(encoding="utf-8"))
        if not isinstance(hist, list):
            return []
        return hist[: max(1, min(100, int(limit)))]
    except Exception:
        return []


def request_run(
    *,
    mode: str | None = None,
    destination: str | None = None,
    incremental: bool | None = None,
    migrate_bundle: bool | None = None,
    include: dict | None = None,
) -> dict[str, Any]:
    """
    Escribe petición para el worker Windows (Register-DailyBackup / pulse).
    No ejecuta el backup dentro de Docker.
    """
    cfg = get_config()
    req = {
        "requested_at": int(time.time()),
        "status": "pending",
        "mode": _sanitize_mode(mode or cfg.get("mode")),
        "destination": (destination if destination is not None else cfg.get("destination"))
        or "",
        "incremental": _clamp_bool(
            incremental if incremental is not None else cfg.get("incremental"),
            True,
        ),
        "migrate_bundle": _clamp_bool(
            migrate_bundle
            if migrate_bundle is not None
            else cfg.get("migrate_bundle"),
            False,
        ),
        "include": cfg.get("include"),
    }
    if isinstance(include, dict):
        inc = dict(req["include"] or {})
        for k, v in include.items():
            if k in DEFAULTS["include"]:
                inc[k] = _clamp_bool(v, inc.get(k, True))
        req["include"] = inc
    if req["mode"] == "migrate":
        req["migrate_bundle"] = True
    path = _request_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(req, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "request": req, "path": str(path)}


def peek_request() -> dict[str, Any] | None:
    path = _request_path()
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else None
    except Exception:
        return None


def clear_request() -> None:
    path = _request_path()
    try:
        if path.is_file():
            path.unlink()
    except Exception:
        pass
