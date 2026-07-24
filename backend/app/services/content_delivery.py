"""
Entrega de contenido industrial:
- 1 transferencia a la vez (todo el ancho de banda)
- Prioridad TV1 y TV2 (menú / complementos)
- Manifiestos con versión para reutilizar caché entre días
- Turno de video: 1 TV a la vez
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

# Prioridad de cola: menor número = más prioridad
TV_PRIORITY = {1: 0, 2: 1, 3: 10, 4: 11, 5: 12, 6: 13}

ZONA_BY_TV = {3: "TV3", 4: "TV4", 5: "TV5", 6: "TV6"}

# Estado en memoria
_lease: dict[str, Any] | None = None  # transferencia activa
_wait_queue: list[dict[str, Any]] = []  # {tv_id, reason, ts, request_id}
_tv_state: dict[int, dict[str, Any]] = {}  # ack/cache por TV
_video_turn: dict[str, Any] | None = None  # {tv_id, video_url, started, token}
_video_rr: list[int] = []  # round-robin TVs con video


def _now() -> float:
    return time.time()


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


def _purge_stale_lease() -> None:
    global _lease
    if not _lease:
        return
    # lease max 3 min
    if _now() - float(_lease.get("granted_at") or 0) > 180:
        _lease = None


def request_lease(tv_id: int, *, reason: str = "sync") -> dict[str, Any]:
    """
    Solicita el canal exclusivo de descarga.
    Prioridad: TV1, TV2, luego el resto por orden de llegada.
    """
    global _lease, _wait_queue
    _purge_stale_lease()
    res = get_resources()
    policy = res["policy"]

    if not policy.get("allow_transfer"):
        return {
            "granted": False,
            "reason": "transfer_paused",
            "message": policy.get("message"),
            "resources": res,
            "retry_after_s": 5,
        }

    if policy.get("priority_only_menus") and tv_id not in (1, 2):
        # En hot, publicidad espera
        return {
            "granted": False,
            "reason": "priority_menus_only",
            "message": "Servidor ocupado: primero TV1–2 (menús)",
            "resources": res,
            "retry_after_s": 8,
        }

    if _lease and int(_lease.get("tv_id")) == tv_id:
        return {
            "granted": True,
            "lease_id": _lease["lease_id"],
            "tv_id": tv_id,
            "exclusive": True,
            "expires_in_s": max(
                1, 180 - int(_now() - float(_lease["granted_at"]))
            ),
            "resources": res,
            "policy": policy,
            "message": "Ya tiene el canal de descarga",
        }

    if _lease:
        # encolar si no está
        if not any(int(x.get("tv_id")) == tv_id for x in _wait_queue):
            _wait_queue.append(
                {
                    "tv_id": tv_id,
                    "reason": reason,
                    "ts": _now(),
                    "request_id": uuid.uuid4().hex[:8],
                }
            )
            _wait_queue.sort(
                key=lambda x: (TV_PRIORITY.get(int(x["tv_id"]), 50), x["ts"])
            )
        pos = next(
            (
                i
                for i, x in enumerate(_wait_queue)
                if int(x["tv_id"]) == tv_id
            ),
            0,
        )
        holder = int(_lease["tv_id"])
        return {
            "granted": False,
            "reason": "busy",
            "holder_tv_id": holder,
            "queue_position": pos + 1,
            "queue_len": len(_wait_queue),
            "message": (
                f"TV #{holder} está descargando. "
                f"Usted es #{pos + 1} en cola "
                f"(prioridad menús TV1–2)."
            ),
            "resources": res,
            "retry_after_s": 2 if tv_id in (1, 2) else 4,
        }

    # Otorgar: si hay cola, el primero (ya ordenado por prioridad)
    if _wait_queue:
        # Si este tv_id es el primero o de mayor prioridad que el head y es 1/2
        head = _wait_queue[0]
        if int(head["tv_id"]) != tv_id:
            # insertar/actualizar y reordenar
            if not any(int(x.get("tv_id")) == tv_id for x in _wait_queue):
                _wait_queue.append(
                    {"tv_id": tv_id, "reason": reason, "ts": _now(), "request_id": uuid.uuid4().hex[:8]}
                )
            _wait_queue.sort(
                key=lambda x: (TV_PRIORITY.get(int(x["tv_id"]), 50), x["ts"])
            )
            if int(_wait_queue[0]["tv_id"]) != tv_id:
                pos = next(
                    i
                    for i, x in enumerate(_wait_queue)
                    if int(x["tv_id"]) == tv_id
                )
                return {
                    "granted": False,
                    "reason": "queued",
                    "queue_position": pos + 1,
                    "queue_len": len(_wait_queue),
                    "message": f"En cola de descarga posición {pos + 1}",
                    "resources": res,
                    "retry_after_s": 2,
                }
        # pop this tv
        _wait_queue = [x for x in _wait_queue if int(x["tv_id"]) != tv_id]

    lease_id = uuid.uuid4().hex
    _lease = {
        "lease_id": lease_id,
        "tv_id": tv_id,
        "granted_at": _now(),
        "reason": reason,
    }
    return {
        "granted": True,
        "lease_id": lease_id,
        "tv_id": tv_id,
        "exclusive": True,
        "expires_in_s": 180,
        "resources": res,
        "policy": policy,
        "message": "Canal exclusivo concedido — use todo el ancho de banda",
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
) -> dict[str, Any]:
    _tv_state[tv_id] = {
        "version": version,
        "cached_bytes": cached_bytes,
        "assets_ok": assets_ok,
        "assets_fail": assets_fail,
        "acked_at": _now(),
    }
    return {"ok": True, "tv_id": tv_id, "version": version}


def get_delivery_status() -> dict[str, Any]:
    _purge_stale_lease()
    res = get_resources()
    return {
        "resources": res,
        "lease": _lease,
        "queue": list(_wait_queue),
        "tv_cache": {str(k): v for k, v in _tv_state.items()},
        "video_turn": _video_turn,
        "policy": res.get("policy"),
    }


async def _broadcast_video(payload: dict) -> None:
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)


async def tick_video_turn(db: AsyncSession) -> dict[str, Any] | None:
    """
    Asigna turno de video a una sola TV (si la política lo permite).
    """
    global _video_turn, _video_rr
    res = get_resources()
    policy = res["policy"]
    if not policy.get("allow_video_play"):
        if _video_turn:
            _video_turn = None
        return None

    # Si hay turno activo y no expiró (max 8 min), mantener
    if _video_turn:
        age = _now() - float(_video_turn.get("started") or 0)
        if age < 480:
            return _video_turn
        _video_turn = None

    gap = float(policy.get("video_min_gap_s") or 45)
    # Construir candidatos TV3-6 con al menos un video
    candidates = []
    for tid, zona in ZONA_BY_TV.items():
        man = await build_manifest(db, tid)
        vids = man.get("videos") or []
        if vids:
            candidates.append((tid, vids))

    if not candidates:
        return None

    # Round-robin
    order = [c[0] for c in candidates]
    if not _video_rr:
        _video_rr = order[:]
    # avanzar al siguiente
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


def video_done(tv_id: int, token: str | None = None) -> dict[str, Any]:
    global _video_turn
    if _video_turn and int(_video_turn.get("tv_id")) == tv_id:
        if token and _video_turn.get("token") != token:
            return {"ok": False, "error": "token inválido"}
        _video_turn = None
        return {"ok": True, "cleared": True}
    return {"ok": True, "cleared": False}


def get_video_turn_for(tv_id: int) -> dict[str, Any] | None:
    if _video_turn and int(_video_turn.get("tv_id")) == tv_id:
        return dict(_video_turn)
    return None
