"""
Entrega de contenido industrial:
- 1 transferencia a la vez (todo el ancho de banda)
- Prioridad TV1 y TV2 (menú / complementos) SOLO si están en línea
- Si TV1/2 (u otra) está offline, pierde prioridad y no bloquea la cola
- Modo solo-publicidad: el servidor opera con 1 sola TV de publicidad
  aunque TV1 y TV2 no existan / no respondan
- Al volver en línea, las faltantes descargan campañas del servidor
- Manifiestos con versión para reutilizar caché entre días
- Turno de video: 1 TV a la vez (también con una sola candidata)
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.resources import get_resources
from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

# Prioridad base de cola: menor número = más prioridad (solo aplica si está en línea)
TV_PRIORITY = {1: 0, 2: 1, 3: 10, 4: 11, 5: 12, 6: 13}
# Offline: se relega al final (no cuello de botella para las que sí responden)
OFFLINE_PRIORITY_BASE = 1000

# Sin heartbeat reciente → offline para prioridad de descarga
ONLINE_GRACE_S = 10.0
# Alineado con pantallas.IDLE_OFF_AFTER_S: tras 3 min no compiten
IDLE_OFF_S = 180.0
# Lease de TV offline se libera en ~6s (no 45–90s) para no frenar al resto
LEASE_OFFLINE_RELEASE_S = 6.0
# IDs menú vs publicidad
MENU_TV_IDS = (1, 2)
AD_TV_IDS = (3, 4, 5, 6)

ZONA_BY_TV = {3: "TV3", 4: "TV4", 5: "TV5", 6: "TV6"}

# Estado en memoria
_lease: dict[str, Any] | None = None  # transferencia activa
_wait_queue: list[dict[str, Any]] = []  # {tv_id, reason, ts, request_id}
_tv_state: dict[int, dict[str, Any]] = {}  # ack/cache por TV
_video_turn: dict[str, Any] | None = None  # {tv_id, video_url, started, token}
_video_rr: list[int] = []  # round-robin TVs con video
_last_video_ended_at: float = 0.0  # para video_min_gap_s
_video_candidates_cache: tuple[float, list[tuple[int, list]]] | None = None


def _now() -> float:
    return time.time()


def is_tv_online(tv_id: int) -> bool:
    """
    True si la TV responde y no está en standby/apagada.
    Offline / standby no compiten por prioridad ni bloquean la cola.
    """
    tid = int(tv_id)
    now = _now()

    # Primero pantallas: standby / power_off ganan sobre last_seen de lease
    try:
        from app.services import pantallas as pant

        pant._ensure()
        pant.refresh_statuses()
        tv = pant._state.get(tid)
        if tv is not None:
            # Forzar actualizacion de off por inactividad
            try:
                pant.refresh_statuses()
                tv = pant._state.get(tid) or tv
            except Exception:
                pass
            estado = tv.get("estado") or "offline"
            if estado in ("standby", "offline", "off") or tv.get("server_off"):
                return False
            if tv.get("power_on") is False:
                return False
            if estado in ("online", "weak", "error"):
                return True
            last = tv.get("ultimo_ping_ts")
            if last is not None and (now - float(last)) <= ONLINE_GRACE_S:
                return True
            if last is not None and (now - float(last)) > IDLE_OFF_S:
                return False
    except Exception:
        pass

    # Respaldo: actividad de contenido reciente (lease/ack)
    st = _tv_state.get(tid) or {}
    last_cd = st.get("last_seen")
    if last_cd is not None and (now - float(last_cd)) <= ONLINE_GRACE_S:
        return True
    if last_cd is not None and (now - float(last_cd)) > IDLE_OFF_S:
        return False

    return False


def effective_priority(tv_id: int) -> int:
    """
    Prioridad efectiva para la cola de descarga.
    TV1/2 solo tienen prioridad alta si están en línea; si no, pasan al final.
    """
    tid = int(tv_id)
    base = TV_PRIORITY.get(tid, 50)
    if not is_tv_online(tid):
        return OFFLINE_PRIORITY_BASE + base
    return base


def online_tv_ids() -> list[int]:
    return [i for i in range(1, 7) if is_tv_online(i)]


def any_online_menu_tvs() -> bool:
    return any(is_tv_online(i) for i in MENU_TV_IDS)


def any_online_ad_tvs() -> bool:
    return any(is_tv_online(i) for i in AD_TV_IDS)


def solo_publicidad_mode() -> bool:
    """
    True cuando no hay menús en línea y sí hay al menos una publicidad.
    El servidor debe operar con esa(s) pantalla(s) sin esperar TV1/TV2.
    """
    return (not any_online_menu_tvs()) and any_online_ad_tvs()


def _sort_wait_queue() -> None:
    """Ordena cola: en línea primero (TV1/2 > resto), offline al final."""
    global _wait_queue
    _wait_queue.sort(
        key=lambda x: (effective_priority(int(x["tv_id"])), float(x.get("ts") or 0))
    )


def _purge_offline_from_queue() -> list[int]:
    """Quita de la cola TVs offline (no deben bloquear a las en línea)."""
    global _wait_queue
    dropped: list[int] = []
    kept: list[dict[str, Any]] = []
    for x in _wait_queue:
        tid = int(x["tv_id"])
        if is_tv_online(tid):
            kept.append(x)
        else:
            dropped.append(tid)
    _wait_queue = kept
    return dropped


def _image_root() -> Path:
    return Path(get_settings().image_root)


def _file_meta(rel_url: str) -> dict[str, Any] | None:
    """rel_url como /images/... → tamaño + etag simple."""
    if not rel_url or not rel_url.startswith("/images/"):
        return None
    path = _image_root() / rel_url[len("/images/") :]
    if not path.is_file():
        return None
    st = path.stat()
    etag = hashlib.md5(f"{path.name}:{st.st_size}:{int(st.st_mtime)}".encode()).hexdigest()[:12]
    return {
        "url": rel_url,
        "bytes": int(st.st_size),
        "etag": etag,
        "mtime": int(st.st_mtime),
    }


def _version_of(parts: list[str]) -> str:
    h = hashlib.sha1()
    for p in parts:
        h.update((p or "").encode("utf-8", errors="replace"))
        h.update(b"|")
    return h.hexdigest()[:16]


async def build_manifest(db: AsyncSession, tv_id: int) -> dict[str, Any]:
    """Manifiesto de assets que la TV debe tener en caché local."""
    if tv_id < 1 or tv_id > 6:
        raise ValueError("tv_id 1-6")

    resources = get_resources()
    policy = resources["policy"]
    budget_mb = int((policy.get("cache_budget_mb") or {}).get(tv_id, 80))
    budget_bytes = budget_mb * 1024 * 1024

    assets: list[dict[str, Any]] = []
    kind = "menu" if tv_id in (1, 2) else "publicidad"
    version_parts: list[str] = [f"tv{tv_id}", kind]

    if tv_id in (1, 2):
        # Menú: rutas de imagen derivadas de código/tipo (product_images)
        from app.services.product_images import absolute_path, public_url

        result = await db.execute(
            text(
                """
                SELECT codigo, tipo::text AS tipo, actualizado_en
                FROM productos_menu
                WHERE activo = TRUE
                ORDER BY tipo, numero_combo NULLS LAST, nombre
                """
            )
        )
        rows = result.mappings().all()
        role = "hero" if tv_id == 1 else "card"
        for row in rows:
            codigo = row.get("codigo") or ""
            tipo = row.get("tipo") or "plato_preestablecido"
            # prefer card/hero si existe en disco; si no, el otro
            roles = [role, "hero" if role == "card" else "card"]
            for r in roles:
                path = absolute_path(tipo, codigo, role=r)
                if not path.is_file():
                    continue
                u = public_url(tipo, codigo, role=r).split("?")[0]
                meta = _file_meta(u)
                if not meta:
                    continue
                assets.append(
                    {
                        **meta,
                        "type": "image",
                        "priority": 1 if tv_id == 1 else 2,
                        "group": "menu",
                        "code": codigo,
                        "role": r,
                    }
                )
                version_parts.append(f"{meta['url']}:{meta['etag']}")
                break
            version_parts.append(f"{codigo}:{row.get('actualizado_en')}")
    else:
        zona = ZONA_BY_TV[tv_id]
        result = await db.execute(
            text(
                """
                SELECT slides, mensajes, actualizado_en, duracion_slide, efecto_visual
                FROM campanas_publicidad
                WHERE zona = CAST(:z AS zona_publicidad)
                LIMIT 1
                """
            ),
            {"z": zona},
        )
        row = result.mappings().first()
        slides = []
        if row:
            slides = row["slides"]
            if isinstance(slides, str):
                slides = json.loads(slides)
            version_parts.append(str(row.get("actualizado_en") or ""))
            version_parts.append(str(row.get("duracion_slide") or ""))
            version_parts.append(str(row.get("efecto_visual") or ""))
        for i, s in enumerate(slides or []):
            if not isinstance(s, dict):
                continue
            img = (s.get("imagen_url") or "").strip()
            vid = (s.get("video_url") or "").strip()
            if img:
                meta = _file_meta(img)
                if meta:
                    assets.append(
                        {
                            **meta,
                            "type": "image",
                            "priority": 10 + i,
                            "group": "campana",
                            "slide_id": s.get("id"),
                        }
                    )
                    version_parts.append(f"{meta['url']}:{meta['etag']}")
            if vid:
                meta = _file_meta(vid)
                if meta:
                    # Videos NO se pre-cargan todos: solo metadata; descarga bajo turno
                    assets.append(
                        {
                            **meta,
                            "type": "video",
                            "priority": 100 + i,
                            "group": "campana",
                            "slide_id": s.get("id"),
                            "preload": False,  # no entra en descarga bulk
                        }
                    )
                    version_parts.append(f"v:{meta['url']}:{meta['etag']}")

    # Orden: imágenes primero, por prioridad
    images = [a for a in assets if a["type"] == "image"]
    videos = [a for a in assets if a["type"] == "video"]
    images.sort(key=lambda a: a.get("priority", 99))

    # Recortar al presupuesto (solo imágenes en bulk)
    selected: list[dict[str, Any]] = []
    used = 0
    for a in images:
        if used + a["bytes"] > budget_bytes:
            continue
        selected.append(a)
        used += a["bytes"]

    version = _version_of(version_parts + [str(budget_mb)])

    return {
        "tv_id": tv_id,
        "kind": kind,
        "version": version,
        "generated_at": int(_now()),
        "budget_bytes": budget_bytes,
        "budget_mb": budget_mb,
        "assets": selected,
        "videos": videos,  # disponibles para turno, no bulk
        "asset_count": len(selected),
        "video_count": len(videos),
        "total_bytes": used,
        "policy_level": policy.get("level"),
        "transfer_chunk_pause_ms": policy.get("transfer_chunk_pause_ms", 0),
        "reuse_if_version_match": True,
        "message": (
            "Si la versión no cambió, reutilice caché local (reinicios / cortes de luz)."
        ),
    }


LEASE_MAX_S = 90.0  # liberar canal si la TV no terminó / se fue


def _purge_stale_lease() -> None:
    """Libera lease caducado o de TV offline (evita cuello de botella)."""
    global _lease
    if not _lease:
        return
    age = _now() - float(_lease.get("granted_at") or 0)
    last_beat = float(_lease.get("last_beat") or _lease.get("granted_at") or 0)
    holder = int(_lease.get("tv_id") or 0)
    # sin actividad 45s o total > LEASE_MAX_S
    if age > LEASE_MAX_S or (_now() - last_beat) > 45:
        _lease = None
        return
    # TV titular offline → liberar pronto para la siguiente en línea
    if holder and not is_tv_online(holder):
        if (_now() - last_beat) >= LEASE_OFFLINE_RELEASE_S or age >= LEASE_OFFLINE_RELEASE_S:
            _lease = None


def _menu_tvs_blocking() -> tuple[bool, str]:
    """
    ¿Hay menús (TV1/2) EN LÍNEA que aún ocupan prioridad de descarga?
    Si TV1 o TV2 están offline, NO bloquean: pierden prioridad.
    En modo solo-publicidad (ningún menú en línea) → nunca bloquea.
    """
    if not any_online_menu_tvs():
        return False, "modo_solo_publicidad(TV1–2 offline)"

    details: list[str] = []
    blocking = False

    for mid in MENU_TV_IDS:
        online = is_tv_online(mid)
        st = _tv_state.get(mid) or {}
        holding = bool(_lease and int(_lease.get("tv_id") or 0) == mid)
        hb_ready = bool(st.get("display_ready"))
        acked = float(st.get("acked_at") or 0)
        assets_ok = int(st.get("assets_ok") or 0)
        recent_ack = bool(acked and (_now() - acked) < 7200 and assets_ok > 0)

        if not online:
            details.append(f"TV{mid}=offline(sin prioridad)")
            continue

        if holding:
            blocking = True
            details.append(f"TV{mid}=descargando")
        elif hb_ready or recent_ack:
            details.append(f"TV{mid}=ok")
        else:
            # En línea pero aún no lista; solo bloquea si está en cola pidiendo menú
            in_q = any(int(x.get("tv_id")) == mid for x in _wait_queue)
            if in_q:
                blocking = True
                details.append(f"TV{mid}=en_cola")
            else:
                details.append(f"TV{mid}=en_linea")

    detail = ", ".join(details) if details else "sin menús en línea"
    return blocking, detail


def request_lease(tv_id: int, *, reason: str = "sync") -> dict[str, Any]:
    """
    Solicita el canal exclusivo de descarga.

    Política de prioridad (dinámica por presencia):
    - TV1 y TV2 tienen prioridad solo si están en línea.
    - Offline → pierden prioridad y salen de la cola (no bloquean).
    - Con solo 1 TV de publicidad en línea (TV1/2 ausentes), opera normal.
    - Al reconectar, las faltantes piden lease y descargan del servidor.
    """
    global _lease, _wait_queue
    _purge_stale_lease()
    _purge_offline_from_queue()
    _sort_wait_queue()

    res = get_resources()
    policy = res["policy"]
    tv_id = int(tv_id)

    if not policy.get("allow_transfer"):
        return {
            "granted": False,
            "reason": "transfer_paused",
            "message": policy.get("message"),
            "resources": res,
            "retry_after_s": 5,
        }

    # Marcar presencia ANTES de evaluar online/prioridad (quien pide lease está vivo)
    prev = _tv_state.get(tv_id) or {}
    _tv_state[tv_id] = {**prev, "last_seen": _now()}
    solo_ads = solo_publicidad_mode() or (
        tv_id in AD_TV_IDS and not any_online_menu_tvs()
    )

    # En hot: NO bloquear publicidad si no hay menús en línea (modo solo-publicidad)
    # Solo bloquear si un menú EN LÍNEA sigue ocupando el canal
    if (
        policy.get("priority_only_menus")
        and tv_id not in MENU_TV_IDS
        and not solo_ads
        and any_online_menu_tvs()
    ):
        menus_blocking, detail = _menu_tvs_blocking()
        if menus_blocking:
            return {
                "granted": False,
                "reason": "priority_menus_only",
                "message": (
                    "Carga alta: priorizando menús en línea (TV1–2). "
                    f"({detail})"
                ),
                "menus_status": detail,
                "resources": res,
                "retry_after_s": 4,
                "solo_publicidad": False,
            }
        # menús offline o listos → no hay cuello de botella artificial

    if _lease and int(_lease.get("tv_id")) == tv_id:
        _lease["last_beat"] = _now()
        return {
            "granted": True,
            "lease_id": _lease["lease_id"],
            "tv_id": tv_id,
            "exclusive": True,
            "expires_in_s": max(
                1, int(LEASE_MAX_S - (_now() - float(_lease["granted_at"])))
            ),
            "resources": res,
            "policy": policy,
            "message": "Ya tiene el canal de descarga",
            "priority": effective_priority(tv_id),
            "solo_publicidad": solo_ads,
        }

    if _lease:
        holder = int(_lease["tv_id"])
        # Titular offline → liberar (gracia 6s; menús offline liberan al instante
        # si hay publicidad esperando, para no frenar modo solo-publicidad)
        if not is_tv_online(holder):
            last_beat = float(_lease.get("last_beat") or _lease.get("granted_at") or 0)
            age_idle = _now() - last_beat
            release_now = (
                age_idle >= LEASE_OFFLINE_RELEASE_S
                or (holder in MENU_TV_IDS and tv_id in AD_TV_IDS)
                or solo_ads
            )
            if release_now:
                _lease = None
            else:
                if not any(int(x.get("tv_id")) == tv_id for x in _wait_queue):
                    _wait_queue.append(
                        {
                            "tv_id": tv_id,
                            "reason": reason,
                            "ts": _now(),
                            "request_id": uuid.uuid4().hex[:8],
                        }
                    )
                _sort_wait_queue()
                pos = next(
                    (
                        i
                        for i, x in enumerate(_wait_queue)
                        if int(x["tv_id"]) == tv_id
                    ),
                    0,
                )
                return {
                    "granted": False,
                    "reason": "holder_going_offline",
                    "holder_tv_id": holder,
                    "queue_position": pos + 1,
                    "queue_len": len(_wait_queue),
                    "message": (
                        f"TV #{holder} dejó de responder; liberando canal (~"
                        f"{LEASE_OFFLINE_RELEASE_S:.0f}s). "
                        f"Posición en cola: {pos + 1}."
                    ),
                    "resources": res,
                    "retry_after_s": 1,
                    "solo_publicidad": solo_ads,
                }

    if _lease:
        if not any(int(x.get("tv_id")) == tv_id for x in _wait_queue):
            _wait_queue.append(
                {
                    "tv_id": tv_id,
                    "reason": reason,
                    "ts": _now(),
                    "request_id": uuid.uuid4().hex[:8],
                }
            )
        _sort_wait_queue()
        pos = next(
            (
                i
                for i, x in enumerate(_wait_queue)
                if int(x["tv_id"]) == tv_id
            ),
            0,
        )
        holder = int(_lease["tv_id"])
        holder_label = {1: "Menú comidas", 2: "Complementos"}.get(
            holder, f"TV #{holder}"
        )
        holder_note = ""
        if holder in (1, 2) and not is_tv_online(holder):
            holder_note = " (sin prioridad: offline)"
        return {
            "granted": False,
            "reason": "busy",
            "holder_tv_id": holder,
            "queue_position": pos + 1,
            "queue_len": len(_wait_queue),
            "message": (
                f"{holder_label} (TV #{holder}){holder_note} usa el canal de red. "
                f"Esta pantalla es #{pos + 1} en cola "
                f"(prioridad: en línea primero; TV1–2 solo si están conectadas)."
            ),
            "resources": res,
            "retry_after_s": 2 if effective_priority(tv_id) < 10 else 3,
            "priority": effective_priority(tv_id),
            "solo_publicidad": solo_ads,
        }

    # Canal libre: si hay cola, solo la cabeza (en línea) obtiene el lease
    if _wait_queue:
        _purge_offline_from_queue()
        _sort_wait_queue()
        # Modo solo-publicidad + esta TV es la única en cola de ads: saltar
        # entradas fantasma y otorgar de inmediato
        if solo_ads and tv_id in AD_TV_IDS:
            _wait_queue = [
                x
                for x in _wait_queue
                if int(x["tv_id"]) == tv_id or is_tv_online(int(x["tv_id"]))
            ]
        if _wait_queue and int(_wait_queue[0]["tv_id"]) != tv_id:
            if not any(int(x.get("tv_id")) == tv_id for x in _wait_queue):
                _wait_queue.append(
                    {
                        "tv_id": tv_id,
                        "reason": reason,
                        "ts": _now(),
                        "request_id": uuid.uuid4().hex[:8],
                    }
                )
            _sort_wait_queue()
            if int(_wait_queue[0]["tv_id"]) != tv_id:
                pos = next(
                    i
                    for i, x in enumerate(_wait_queue)
                    if int(x["tv_id"]) == tv_id
                )
                head = int(_wait_queue[0]["tv_id"])
                return {
                    "granted": False,
                    "reason": "queued",
                    "queue_position": pos + 1,
                    "queue_len": len(_wait_queue),
                    "next_tv_id": head,
                    "message": (
                        f"En cola de descarga posición {pos + 1} "
                        f"(siguiente: TV #{head}; solo pantallas en línea)."
                    ),
                    "resources": res,
                    "retry_after_s": 2,
                    "priority": effective_priority(tv_id),
                    "solo_publicidad": solo_ads,
                }
        # esta TV es la cabeza → salir de cola y otorgar
        _wait_queue = [x for x in _wait_queue if int(x["tv_id"]) != tv_id]

    lease_id = uuid.uuid4().hex
    _lease = {
        "lease_id": lease_id,
        "tv_id": tv_id,
        "granted_at": _now(),
        "last_beat": _now(),
        "reason": reason,
    }
    msg = "Canal exclusivo concedido — use todo el ancho de banda"
    if solo_ads:
        msg = (
            "Canal concedido (modo solo publicidad: TV1–2 no disponibles; "
            "esta pantalla opera con normalidad)."
        )
    return {
        "granted": True,
        "lease_id": lease_id,
        "tv_id": tv_id,
        "exclusive": True,
        "expires_in_s": int(LEASE_MAX_S),
        "resources": res,
        "policy": policy,
        "priority": effective_priority(tv_id),
        "solo_publicidad": solo_ads,
        "message": msg,
    }



def release_lease(tv_id: int, lease_id: str | None = None) -> dict[str, Any]:
    global _lease
    if _lease and int(_lease.get("tv_id")) == tv_id:
        if lease_id and _lease.get("lease_id") != lease_id:
            return {"ok": False, "error": "lease_id no coincide"}
        _lease = None
        return {"ok": True, "released": True, "next_hint": _peek_queue()}
    return {"ok": True, "released": False, "next_hint": _peek_queue()}


def _peek_queue() -> dict | None:
    if not _wait_queue:
        return None
    return {
        "tv_id": _wait_queue[0]["tv_id"],
        "queue_len": len(_wait_queue),
    }


def ack_cache(
    tv_id: int,
    *,
    version: str,
    cached_bytes: int = 0,
    assets_ok: int = 0,
    assets_fail: int = 0,
    display_ready: bool = True,
) -> dict[str, Any]:
    prev = _tv_state.get(tv_id) or {}
    _tv_state[tv_id] = {
        **prev,
        "version": version,
        "cached_bytes": cached_bytes,
        "assets_ok": assets_ok,
        "assets_fail": assets_fail,
        "acked_at": _now(),
        "display_ready": bool(display_ready),
    }
    # Liberar canal para la siguiente TV (p. ej. TV3 tras TV1/2)
    release_lease(tv_id)
    return {"ok": True, "tv_id": tv_id, "version": version}


def mark_display_ready(tv_id: int, *, ready: bool = True, screen: str = "") -> None:
    """Heartbeat: la TV ya muestra contenido (aunque no haya re-descargado)."""
    if tv_id < 1 or tv_id > 6:
        return
    prev = _tv_state.get(tv_id) or {}
    _tv_state[tv_id] = {
        **prev,
        "display_ready": bool(ready),
        "screen": screen or prev.get("screen"),
        "last_seen": _now(),
    }
    # NO liberar el lease solo por display_ready: la TV puede estar descargando
    # aún con la campaña visible. El lease se renueva con request_lease o
    # se libera en ack_cache / timeout / offline.


def get_delivery_status() -> dict[str, Any]:
    _purge_stale_lease()
    _purge_offline_from_queue()
    _sort_wait_queue()
    res = get_resources()
    online_map = {i: is_tv_online(i) for i in range(1, 7)}
    online_list = [i for i in range(1, 7) if online_map.get(i)]
    solo_ads = solo_publicidad_mode()
    return {
        "resources": res,
        "lease": _lease,
        "queue": list(_wait_queue),
        "tv_cache": {str(k): v for k, v in _tv_state.items()},
        "tv_online": online_map,
        "online_tvs": online_list,
        "solo_publicidad": solo_ads,
        "priority_online_only": True,
        "min_screens_required": 1,
        "priority_order": [
            i
            for i in sorted(range(1, 7), key=lambda t: effective_priority(t))
            if online_map.get(i)
        ],
        "video_turn": _video_turn,
        "policy": res.get("policy"),
        "message": (
            "Modo solo publicidad activo: opera con las pantallas en línea "
            "sin esperar TV1–2."
            if solo_ads
            else (
                "Prioridad: TV1–2 solo si están en línea; "
                "1 sola publicidad basta; offline no bloquea; "
                "al reconectar descargan del servidor."
            )
        ),
    }



async def _broadcast_video(payload: dict) -> None:
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)


async def _get_video_candidates(
    db: AsyncSession, *, force: bool = False
) -> list[tuple[int, list]]:
    """Cachea candidatos de video ~45s (evita 4 manifests por cada poll)."""
    global _video_candidates_cache
    now = _now()
    if (
        not force
        and _video_candidates_cache
        and (now - float(_video_candidates_cache[0])) < 45
    ):
        return list(_video_candidates_cache[1])
    candidates: list[tuple[int, list]] = []
    for tid, _zona in ZONA_BY_TV.items():
        man = await build_manifest(db, tid)
        vids = man.get("videos") or []
        if vids:
            candidates.append((tid, vids))
    _video_candidates_cache = (now, candidates)
    return list(candidates)


async def tick_video_turn(db: AsyncSession) -> dict[str, Any] | None:
    """
    Asigna turno de video a una sola TV (si la política lo permite).
    Respeta video_min_gap_s entre turnos y notifica parada por WS.
    """
    global _video_turn, _video_rr, _last_video_ended_at
    res = get_resources()
    policy = res["policy"]
    if not policy.get("allow_video_play"):
        if _video_turn:
            prev = dict(_video_turn)
            _video_turn = None
            _last_video_ended_at = _now()
            await _broadcast_video(
                {
                    "t": "vidturn",
                    "tv_id": None,
                    "stop": True,
                    "reason": "policy_deny",
                    "prev_tv_id": prev.get("tv_id"),
                    "message": "Video pausado por política de carga",
                }
            )
        return None

    # Si hay turno activo y no expiró (max 8 min), mantener
    if _video_turn:
        age = _now() - float(_video_turn.get("started") or 0)
        if age < 480:
            return _video_turn
        # Expiró por tiempo
        prev = dict(_video_turn)
        _video_turn = None
        _last_video_ended_at = _now()
        await _broadcast_video(
            {
                "t": "vidturn",
                "tv_id": None,
                "stop": True,
                "reason": "expired",
                "prev_tv_id": prev.get("tv_id"),
            }
        )

    gap = float(policy.get("video_min_gap_s") or 45)
    # Respetar espacio mínimo entre videos
    if _last_video_ended_at and (_now() - _last_video_ended_at) < gap:
        return None

    candidates = await _get_video_candidates(db)
    if not candidates:
        return None

    # Round-robin
    order = [c[0] for c in candidates]
    if not _video_rr:
        _video_rr = order[:]
    next_tv = None
    for _ in range(len(order) + 1):
        if not _video_rr:
            _video_rr = order[:]
        cand = _video_rr.pop(0)
        _video_rr.append(cand)
        if cand in order:
            next_tv = cand
            break
    if next_tv is None:
        return None

    vids = dict(candidates)[next_tv]
    pick = vids[int(_now()) % len(vids)]
    token = uuid.uuid4().hex[:10]
    _video_turn = {
        "tv_id": next_tv,
        "video_url": pick["url"],
        "etag": pick.get("etag"),
        "bytes": pick.get("bytes"),
        "token": token,
        "started": _now(),
        "min_gap_s": gap,
    }
    await _broadcast_video(
        {
            "t": "vidturn",
            "tv_id": next_tv,
            "video_url": pick["url"],
            "token": token,
            "message": f"Turno de video → TV #{next_tv}",
        }
    )
    return _video_turn


async def video_done(tv_id: int, token: str | None = None) -> dict[str, Any]:
    global _video_turn, _last_video_ended_at
    if _video_turn and int(_video_turn.get("tv_id")) == tv_id:
        if token and _video_turn.get("token") != token:
            return {"ok": False, "error": "token inválido"}
        prev = dict(_video_turn)
        _video_turn = None
        _last_video_ended_at = _now()
        await _broadcast_video(
            {
                "t": "vidturn",
                "tv_id": None,
                "stop": True,
                "reason": "done",
                "prev_tv_id": prev.get("tv_id"),
                "token": prev.get("token"),
            }
        )
        return {"ok": True, "cleared": True}
    return {"ok": True, "cleared": False}


def get_video_turn_for(tv_id: int) -> dict[str, Any] | None:
    if _video_turn and int(_video_turn.get("tv_id")) == tv_id:
        return dict(_video_turn)
    return None
