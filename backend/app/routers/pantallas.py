"""API telemetría + control remoto de Smart TVs."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_caja
from app.services import pantallas as pant_svc
from app.ws_manager import CHANNEL_ADMIN, CHANNEL_PANTALLAS, ws_manager

router = APIRouter(prefix="/api/pantallas", tags=["pantallas"])


class HeartbeatIn(BaseModel):
    latencia_ms: int | None = Field(default=None, ge=0, le=60000)
    snapshot: dict[str, Any] | None = None
    error_msg: str | None = None
    clear_error: bool = False


class ControlIn(BaseModel):
    master_power: bool | None = None
    tv_id: int | None = Field(default=None, ge=1, le=6)
    power_on: bool | None = None
    volumen: int | None = Field(default=None, ge=0, le=100)
    modo_evento: bool | None = None
    all_tvs: bool = False


@router.get("/estado")
async def estado_pantallas(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    await pant_svc.load_from_db(db)
    return pant_svc.get_all_estado()


@router.get("/estado/public")
async def estado_public() -> dict[str, Any]:
    """Estado ligero sin auth (para TVs que leen power/volumen al boot)."""
    data = pant_svc.get_all_estado()
    # No exponer thumbs enormes
    for p in data["pantallas"]:
        snap = p.get("snapshot") or {}
        if "thumb" in snap:
            snap = {k: v for k, v in snap.items() if k != "thumb"}
            p["snapshot"] = snap
    return data


@router.post("/{tv_id}/heartbeat")
async def heartbeat(
    tv_id: int,
    body: HeartbeatIn,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if tv_id < 1 or tv_id > 6:
        raise HTTPException(400, "tv_id debe ser 1-6")
    try:
        tv = await pant_svc.heartbeat(
            db,
            tv_id,
            latencia_ms=body.latencia_ms,
            snapshot=body.snapshot,
            error_msg=body.error_msg,
            clear_error=body.clear_error,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True, "pantalla": tv}


@router.post("/control")
async def control(
    body: ControlIn,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    try:
        return await pant_svc.apply_control(
            db,
            master_power=body.master_power,
            tv_id=body.tv_id,
            power_on=body.power_on,
            volumen=body.volumen,
            modo_evento=body.modo_evento,
            all_tvs=body.all_tvs,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/evento/media")
async def list_evento_media(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    from sqlalchemy import text

    try:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT id::text, titulo, media_url, media_tipo, orientacion, activo, orden
                    FROM evento_media
                    WHERE activo
                    ORDER BY orden, creado_en DESC
                    """
                )
            )
        ).mappings().all()
        return {"items": [dict(r) for r in rows]}
    except Exception:
        return {"items": []}


@router.post("/evento/media")
async def upload_evento_media(
    file: UploadFile = File(...),
    titulo: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    """Sube foto/video de evento privado (cumpleaños, etc.)."""
    import time
    import uuid
    from pathlib import Path

    from app.config import get_settings
    from sqlalchemy import text

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")
    if len(raw) > 80 * 1024 * 1024:
        raise HTTPException(400, "Archivo demasiado grande (máx. 80 MB)")

    ctype = (file.content_type or "").lower()
    is_video = ctype.startswith("video/")
    is_image = ctype.startswith("image/")
    if not is_video and not is_image:
        raise HTTPException(400, "Solo imagen o video")

    settings = get_settings()
    root = Path(settings.image_root)
    sub = "eventos"
    folder = root / sub
    folder.mkdir(parents=True, exist_ok=True)

    ext = ".mp4" if is_video else ".jpg"
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower()[:8]
    fname = f"evt-{uuid.uuid4().hex[:12]}{ext}"
    (folder / fname).write_bytes(raw)
    url = f"/images/{sub}/{fname}"

    # Orientación aproximada para imágenes
    orient = "horizontal"
    if is_image:
        try:
            from PIL import Image
            import io

            im = Image.open(io.BytesIO(raw))
            w, h = im.size
            if h > w * 1.15:
                orient = "vertical"
            elif abs(w - h) < min(w, h) * 0.1:
                orient = "square"
        except Exception:
            pass

    media_tipo = "video" if is_video else "image"
    try:
        row = (
            await db.execute(
                text(
                    """
                    INSERT INTO evento_media (titulo, media_url, media_tipo, orientacion, activo, orden)
                    VALUES (:titulo, :url, :media_tipo, :orientacion, TRUE, 0)
                    RETURNING id::text, titulo, media_url, media_tipo, orientacion, activo, orden
                    """
                ),
                {
                    "titulo": (titulo or file.filename or "Evento")[:160],
                    "url": url,
                    "media_tipo": media_tipo,
                    "orientacion": orient,
                },
            )
        ).mappings().first()
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"No se pudo guardar media: {e}") from e

    item = dict(row) if row else {"media_url": url, "media_tipo": media_tipo}
    await ws_manager.publish(
        CHANNEL_PANTALLAS, {"t": "evt", "v": int(time.time()), "item": item}
    )
    await ws_manager.publish(CHANNEL_ADMIN, {"t": "evt", "v": int(time.time())})
    return {"ok": True, "item": item}
