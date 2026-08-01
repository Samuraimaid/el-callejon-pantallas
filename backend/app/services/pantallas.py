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
# Tras 3 min sin heartbeat: modo off (ahorro CPU, sin previews)
IDLE_OFF_AFTER_S = 180.0

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
    if tv.get("server_off"):
        return "off"
    if tv.get("error_msg"):
        return "error"
    if not tv.get("power_on", True) or not _master_power:
        return "standby"
    last = tv.get("ultimo_ping_ts")
    if last is None:
        return "offline"
    age = _now() - float(last)
    if age > IDLE_OFF_AFTER_S:
        return "off"
    if age > OFFLINE_AFTER_S:
        return "offline"
    lat = tv.get("latencia_ms")
    if lat is not None and int(lat) > WEAK_LATENCY_MS:
        return "weak"
    return "online"


def _apply_idle_off(tv: dict[str, Any]) -> None:
    """
    Si lleva >3 min sin heartbeat: modo off, limpia snapshot/thumb
    para no procesar ni enviar previews al admin (ahorro CPU).
    """
    last = tv.get("ultimo_ping_ts")
    if last is None:
        # Nunca conecto: no ocupar recursos de preview
        tv["server_off"] = True
        tv["snapshot"] = {}
        return
    age = _now() - float(last)
    if age > IDLE_OFF_AFTER_S:
        tv["server_off"] = True
        # Liberar memoria de capturas / thumbs
        tv["snapshot"] = {}
        tv["en_linea"] = False
    else:
        # Si volvio a responder, heartbeat limpia server_off
        pass


def refresh_statuses() -> None:
    _ensure()
    for tv in _state.values():
        _apply_idle_off(tv)
        tv["estado"] = _compute_estado(tv)
        tv["en_linea"] = tv["estado"] in ("online", "weak", "error")
        # standby cuenta como presente pero apagada a proposito
        if tv["estado"] == "standby":
            tv["en_linea"] = False


def get_all_estado() -> dict[str, Any]:
    _ensure()
    refresh_statuses()
    pantallas = []
    for i in range(1, 7):
        tv = deepcopy(_state[i])
        # No enviar thumbs/snapshots de TVs off/offline (ahorro red/CPU admin)
        if tv.get("estado") in ("off", "offline") or tv.get("server_off"):
            snap = dict(tv.get("snapshot") or {})
            snap.pop("thumb", None)
            # Mantener label minimo si existe
            tv["snapshot"] = {
                k: snap[k]
                for k in ("label", "screen", "display_ready")
                if k in snap
            }
            tv["render_preview"] = False
        else:
            tv["render_preview"] = True
        pantallas.append(tv)
    return {
        "master_power": _master_power,
        "pantallas": pantallas,
        "ts": int(_now()),
        "idle_off_after_s": IDLE_OFF_AFTER_S,
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
    tv["server_off"] = False  # volvio a la vida
    if latencia_ms is not None:
        tv["latencia_ms"] = max(0, int(latencia_ms))
    if snapshot is not None:
        snap = dict(snapshot)
        thumb = snap.get("thumb")
        if isinstance(thumb, str) and len(thumb) > 120_000:
            snap["thumb"] = thumb[:120_000]
        # No guardar thumbs pesados si la TV esta en modo evento (opcional)
        tv["snapshot"] = snap
        # Aviso a la cola de contenido: esta TV ya muestra imagen
        try:
            from app.services import content_delivery as cd

            screen = str(snap.get("screen") or "")
            ready = snap.get("display_ready")
            if ready is None:
                ready = screen in (
                    "comidas",
                    "complementos",
                    "publicidad",
                ) or bool(snap.get("preview_url"))
            cd.mark_display_ready(tv_id, ready=bool(ready), screen=screen)
        except Exception:
            pass
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
        try:
            await _persist_master_power(db, _master_power)
        except Exception:
            pass

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

    # Música ambiente: pausa opcional al entrar en modo evento
    if modo_evento is not None:
        try:
            from app.services import ambient_music as amb

            await amb.event_hook(bool(modo_evento))
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


MASTER_POWER_CLAVE = "master_power"


async def _persist_master_power(db: AsyncSession, on: bool) -> None:
    """Guarda master_power en config_sistema (sobrevive reinicios)."""
    await db.execute(
        text(
            """
            INSERT INTO config_sistema (clave, valor, actualizado_en)
            VALUES (:c, CAST(:v AS jsonb), NOW())
            ON CONFLICT (clave) DO UPDATE SET
                valor = EXCLUDED.valor,
                actualizado_en = NOW()
            """
        ),
        {"c": MASTER_POWER_CLAVE, "v": json.dumps({"on": bool(on)})},
    )


async def load_from_db(db: AsyncSession) -> None:
    global _master_power
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

    # Master power global
    try:
        row = (
            await db.execute(
                text(
                    "SELECT valor FROM config_sistema WHERE clave = :c LIMIT 1"
                ),
                {"c": MASTER_POWER_CLAVE},
            )
        ).mappings().first()
        if row and row.get("valor") is not None:
            val = row["valor"]
            if isinstance(val, str):
                val = json.loads(val)
            if isinstance(val, dict) and "on" in val:
                _master_power = bool(val["on"])
            elif isinstance(val, bool):
                _master_power = val
    except Exception:
        pass

    refresh_statuses()


# —— Programación de modo evento ——

_DEFAULT_SCHEDULE: dict[str, Any] = {
    "enabled": False,
    "titulo": "",
    "starts_at": None,
    "ends_at": None,
    "auto_applied": False,
}


def _parse_schedule_raw(raw: Any) -> dict[str, Any]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return dict(_DEFAULT_SCHEDULE)
    if not isinstance(raw, dict):
        return dict(_DEFAULT_SCHEDULE)
    out = dict(_DEFAULT_SCHEDULE)
    out.update(
        {
            "enabled": bool(raw.get("enabled")),
            "titulo": str(raw.get("titulo") or "")[:160],
            "starts_at": raw.get("starts_at") or None,
            "ends_at": raw.get("ends_at") or None,
            "auto_applied": bool(raw.get("auto_applied")),
        }
    )
    return out


async def get_evento_schedule(db: AsyncSession) -> dict[str, Any]:
    try:
        row = (
            await db.execute(
                text(
                    """
                    SELECT valor FROM config_sistema
                    WHERE clave = 'evento_schedule' LIMIT 1
                    """
                )
            )
        ).mappings().first()
        if not row:
            return dict(_DEFAULT_SCHEDULE)
        return _parse_schedule_raw(row["valor"])
    except Exception:
        return dict(_DEFAULT_SCHEDULE)


async def set_evento_schedule(
    db: AsyncSession,
    *,
    enabled: bool | None = None,
    titulo: str | None = None,
    starts_at: str | None = None,
    ends_at: str | None = None,
    clear: bool = False,
) -> dict[str, Any]:
    """Guarda programación. clear=True desactiva y borra fechas."""
    current = await get_evento_schedule(db)
    if clear:
        current = dict(_DEFAULT_SCHEDULE)
        # apagar evento en TVs al cancelar programación
        try:
            await apply_control(db, all_tvs=True, modo_evento=False)
        except Exception:
            pass
    else:
        if enabled is not None:
            current["enabled"] = bool(enabled)
        if titulo is not None:
            current["titulo"] = str(titulo)[:160]
        if starts_at is not None:
            current["starts_at"] = starts_at or None
        if ends_at is not None:
            current["ends_at"] = ends_at or None
        # nueva programación: permitir re-aplicar
        current["auto_applied"] = False

    await db.execute(
        text(
            """
            INSERT INTO config_sistema (clave, valor, actualizado_en)
            VALUES ('evento_schedule', CAST(:v AS jsonb), NOW())
            ON CONFLICT (clave) DO UPDATE SET
                valor = EXCLUDED.valor,
                actualizado_en = NOW()
            """
        ),
        {"v": json.dumps(current, ensure_ascii=False)},
    )
    await db.commit()
    # aplicar de inmediato si estamos dentro de la ventana
    await tick_evento_schedule(db)
    return await get_evento_schedule(db)


def _parse_iso(ts: str | None):
    if not ts:
        return None
    from datetime import datetime

    s = str(ts).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


async def tick_evento_schedule(db: AsyncSession) -> dict[str, Any] | None:
    """
    Si hay programación activa y ahora ∈ [inicio, fin] → modo_evento ON en todas.
    Si pasó el fin y auto_applied → modo_evento OFF.
    """
    from datetime import datetime, timezone

    sched = await get_evento_schedule(db)
    if not sched.get("enabled"):
        return None

    start = _parse_iso(sched.get("starts_at"))
    end = _parse_iso(sched.get("ends_at"))
    if not start or not end:
        return None

    now = datetime.now(timezone.utc)
    # normalizar aware
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    if end <= start:
        return {"ok": False, "error": "fin debe ser después del inicio"}

    any_on = any(_state.get(i, {}).get("modo_evento") for i in range(1, 7)) if _state else False

    if start <= now <= end:
        if not any_on:
            await apply_control(db, all_tvs=True, modo_evento=True)
            sched["auto_applied"] = True
            await db.execute(
                text(
                    """
                    UPDATE config_sistema
                    SET valor = CAST(:v AS jsonb), actualizado_en = NOW()
                    WHERE clave = 'evento_schedule'
                    """
                ),
                {"v": json.dumps(sched, ensure_ascii=False)},
            )
            await db.commit()
            return {"action": "on", "schedule": sched}
        return {"action": "hold_on", "schedule": sched}

    if now > end and (sched.get("auto_applied") or any_on):
        await apply_control(db, all_tvs=True, modo_evento=False)
        sched["auto_applied"] = False
        # opcional: desactivar enabled al terminar
        sched["enabled"] = False
        await db.execute(
            text(
                """
                UPDATE config_sistema
                SET valor = CAST(:v AS jsonb), actualizado_en = NOW()
                WHERE clave = 'evento_schedule'
                """
            ),
            {"v": json.dumps(sched, ensure_ascii=False)},
        )
        await db.commit()
        return {"action": "off", "schedule": sched}

    return {"action": "wait", "schedule": sched}


def get_all_estado_with_schedule(schedule: dict | None = None) -> dict[str, Any]:
    data = get_all_estado()
    if schedule is not None:
        data["evento_schedule"] = schedule
    return data
