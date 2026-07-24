"""Estado, telemetría y control remoto de las 6 Smart TVs."""

from __future__ import annotations

import json
import time
from copy import deepcopy
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

HEARTBEAT_INTERVAL = 4.0
WEAK_LATENCY_MS = 1500
OFFLINE_AFTER_S = 8.0

DEFAULT_TVS: dict[int, dict[str, Any]] = {
    1: {"id": 1, "etiqueta": "TV #1 · Menú Comidas", "ruta": "/tv/1"},
    2: {"id": 2, "etiqueta": "TV #2 · Complementos", "ruta": "/tv/2"},
    3: {"id": 3, "etiqueta": "TV #3 · Publicidad Barra", "ruta": "/tv/3"},
    4: {"id": 4, "etiqueta": "TV #4 · Publicidad Parrilla", "ruta": "/tv/4"},
    5: {"id": 5, "etiqueta": "TV #5 · VIP Ambiente", "ruta": "/tv/5"},
    6: {"id": 6, "etiqueta": "TV #6 · VIP Platillos", "ruta": "/tv/6"},
}

_state: dict[int, dict[str, Any]] = {}
_master_power: bool = True


def _now() -> float:
    return time.time()


def _blank_tv(i: int) -> dict[str, Any]:
    base = DEFAULT_TVS.get(i, {"id": i, "etiqueta": f"TV #{i}", "ruta": f"/tv/{i}"})
    return {
        **base,
        "en_linea": False,
        "ultimo_ping": None,
        "ultimo_ping_ts": None,
        "latencia_ms": None,
        "estado": "offline",
        "power_on": True,
        "volumen": 25,
        "modo_evento": False,
        "error_msg": None,
        "snapshot": {},
        "actualizado_en": None,
    }


def _ensure() -> None:
    global _state
    if not _state:
        _state = {i: _blank_tv(i) for i in range(1, 7)}


def _compute_estado(tv: dict[str, Any]) -> str:
    if tv.get("error_msg"):
        return "error"
    if not tv.get("power_on", True) or not _master_power:
        return "standby"
    last = tv.get("ultimo_ping_ts")
    if last is None:
        return "offline"
    age = _now() - float(last)
    if age > OFFLINE_AFTER_S:
        return "offline"
    lat = tv.get("latencia_ms")
    if lat is not None and int(lat) > WEAK_LATENCY_MS:
        return "weak"
    return "online"


def refresh_statuses() -> None:
    _ensure()
    for tv in _state.values():
        tv["estado"] = _compute_estado(tv)
        tv["en_linea"] = tv["estado"] in ("online", "weak", "standby", "error")


def get_all_estado() -> dict[str, Any]:
    _ensure()
    refresh_statuses()
    return {
        "master_power": _master_power,
        "pantallas": [deepcopy(_state[i]) for i in range(1, 7)],
        "ts": int(_now()),
    }


async def heartbeat(
    db: AsyncSession,
    tv_id: int,
    *,
    latencia_ms: int | None = None,
    snapshot: dict | None = None,
    error_msg: str | None = None,
    clear_error: bool = False,
) -> dict[str, Any]:
    _ensure()
    if tv_id not in _state:
        raise ValueError("tv_id inválido (1-6)")

    tv = _state[tv_id]
    tv["ultimo_ping_ts"] = _now()
    tv["ultimo_ping"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if latencia_ms is not None:
        tv["latencia_ms"] = max(0, int(latencia_ms))
    if snapshot is not None:
        snap = dict(snapshot)
        thumb = snap.get("thumb")
        if isinstance(thumb, str) and len(thumb) > 120_000:
            snap["thumb"] = thumb[:120_000]
        tv["snapshot"] = snap
    if clear_error:
        tv["error_msg"] = None
    if error_msg:
        tv["error_msg"] = str(error_msg)[:500]
    tv["actualizado_en"] = tv["ultimo_ping"]
    tv["estado"] = _compute_estado(tv)
    tv["en_linea"] = True

    try:
        await db.execute(
            text(
                """
                INSERT INTO pantallas_estado (
                    id, en_linea, ultimo_ping, latencia_ms, estado, error_msg,
                    snapshot_json, actualizado_en
                ) VALUES (
                    :id, TRUE, CAST(:ultimo_ping AS timestamptz), :latencia_ms, :estado,
                    :error_msg, CAST(:snapshot AS jsonb), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    en_linea = TRUE,
                    ultimo_ping = EXCLUDED.ultimo_ping,
                    latencia_ms = EXCLUDED.latencia_ms,
                    estado = EXCLUDED.estado,
                    error_msg = EXCLUDED.error_msg,
                    snapshot_json = EXCLUDED.snapshot_json,
                    actualizado_en = NOW()
                """
            ),
            {
                "id": tv_id,
                "ultimo_ping": tv["ultimo_ping"],
                "latencia_ms": tv.get("latencia_ms"),
                "estado": tv["estado"],
                "error_msg": tv.get("error_msg"),
                "snapshot": json.dumps(tv.get("snapshot") or {}, ensure_ascii=False),
            },
        )
        await db.commit()
    except Exception:
        await db.rollback()

    await ws_manager.publish(
        CHANNEL_ADMIN,
        {
            "t": "hb",
            "tv": tv_id,
            "estado": tv["estado"],
            "lat": tv.get("latencia_ms"),
            "snap": tv.get("snapshot") or {},
            "power_on": tv.get("power_on", True) and _master_power,
            "volumen": tv.get("volumen", 25),
            "modo_evento": tv.get("modo_evento", False),
        },
    )
    return deepcopy(tv)


async def apply_control(
    db: AsyncSession,
    *,
    master_power: bool | None = None,
    tv_id: int | None = None,
    power_on: bool | None = None,
    volumen: int | None = None,
    modo_evento: bool | None = None,
    all_tvs: bool = False,
) -> dict[str, Any]:
    global _master_power
    _ensure()

    if all_tvs or tv_id is None:
        targets = list(range(1, 7))
    else:
        if tv_id not in _state:
            raise ValueError("tv_id inválido")
        targets = [tv_id]

    if master_power is not None:
        _master_power = bool(master_power)

    for i in targets:
        tv = _state[i]
        if power_on is not None:
            tv["power_on"] = bool(power_on)
        if volumen is not None:
            tv["volumen"] = max(0, min(100, int(volumen)))
        if modo_evento is not None:
            tv["modo_evento"] = bool(modo_evento)
        tv["estado"] = _compute_estado(tv)
        try:
            await db.execute(
                text(
                    """
                    UPDATE pantallas_estado
                    SET power_on = :power_on,
                        volumen = :volumen,
                        modo_evento = :modo_evento,
                        estado = :estado,
                        actualizado_en = NOW()
                    WHERE id = :id
                    """
                ),
                {
                    "id": i,
                    "power_on": tv["power_on"],
                    "volumen": tv["volumen"],
                    "modo_evento": tv["modo_evento"],
                    "estado": tv["estado"],
                },
            )
        except Exception:
            pass
    try:
        await db.commit()
    except Exception:
        await db.rollback()

    payload = {
        "t": "ctrl",
        "master_power": _master_power,
        "tvs": {
            str(i): {
                "power_on": bool(_state[i]["power_on"] and _master_power),
                "volumen": _state[i]["volumen"],
                "modo_evento": _state[i]["modo_evento"],
            }
            for i in range(1, 7)
        },
        "scope": "all" if all_tvs or tv_id is None else tv_id,
    }
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)
    return get_all_estado()


async def load_from_db(db: AsyncSession) -> None:
    _ensure()
    try:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT id, power_on, volumen, modo_evento, etiqueta, ruta
                    FROM pantallas_estado ORDER BY id
                    """
                )
            )
        ).mappings().all()
        for r in rows:
            i = int(r["id"])
            if i in _state:
                _state[i]["power_on"] = bool(r["power_on"])
                _state[i]["volumen"] = int(r["volumen"] if r["volumen"] is not None else 25)
                _state[i]["modo_evento"] = bool(r["modo_evento"])
                if r.get("etiqueta"):
                    _state[i]["etiqueta"] = r["etiqueta"]
                if r.get("ruta"):
                    _state[i]["ruta"] = r["ruta"]
    except Exception:
        pass
