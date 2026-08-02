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


class EventoScheduleIn(BaseModel):
    enabled: bool | None = None
    titulo: str | None = None
    starts_at: str | None = Field(
        default=None, description="ISO-8601 inicio (local o con offset)"
    )
    ends_at: str | None = Field(default=None, description="ISO-8601 fin")
    clear: bool = False


@router.get("/estado")
async def estado_pantallas(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    await pant_svc.load_from_db(db)
    try:
        await pant_svc.tick_evento_schedule(db)
    except Exception:
        pass
    data = pant_svc.get_all_estado()
    data["evento_schedule"] = await pant_svc.get_evento_schedule(db)
    return data


@router.get("/estado/public")
async def estado_public(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Estado ligero sin auth (para TVs que leen power/volumen al boot)."""
    try:
        await pant_svc.tick_evento_schedule(db)
    except Exception:
        pass
    data = pant_svc.get_all_estado()
    # No exponer thumbs enormes
    for p in data["pantallas"]:
        snap = p.get("snapshot") or {}
        if "thumb" in snap:
            snap = {k: v for k, v in snap.items() if k != "thumb"}
            p["snapshot"] = snap
    data["evento_schedule"] = await pant_svc.get_evento_schedule(db)
    return data


@router.get("/evento/schedule")
async def get_evento_schedule(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await pant_svc.get_evento_schedule(db)


@router.put("/evento/schedule")
async def put_evento_schedule(
    body: EventoScheduleIn,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await pant_svc.set_evento_schedule(
        db,
        enabled=body.enabled,
        titulo=body.titulo,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        clear=body.clear,
    )


@router.post("/{tv_id}/heartbeat")
async def heartbeat(
    tv_id: int,
    body: HeartbeatIn,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if tv_id < 1 or tv_id > 6:
        raise HTTPException(400, "tv_id debe ser 1-6")
    try:
        # Aplicar ventana de evento programado (ligero)
        try:
            await pant_svc.tick_evento_schedule(db)
        except Exception:
            pass
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
    # La TV debe re-sincronizar control desde el servidor (autoridad),
    # no desde su propio snapshot (evita quedar atrapada en modo evento).
    st = pant_svc.get_all_estado()
    master = st.get("master_power", True)
    p = next((x for x in st.get("pantallas") or [] if x.get("id") == tv_id), None) or tv
    # power_on = flag individual de la TV (sin master); la TV combina powerOn && masterPower
    return {
        "ok": True,
        "pantalla": p,
        "control": {
            "master_power": bool(master),
            "power_on": bool(p.get("power_on", True)),
            "volumen": int(p.get("volumen") if p.get("volumen") is not None else 25),
            "modo_evento": bool(p.get("modo_evento")),
        },
    }


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


@router.get("/evento/plantillas")
async def list_evento_plantillas() -> dict[str, Any]:
    from app.services import evento_templates as et

    return {"plantillas": et.list_templates()}


@router.get("/evento/plantillas/activa")
async def get_plantilla_activa(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    from app.services import evento_templates as et

    return {"template": await et.get_active_template(db)}


class AplicarPlantillaIn(BaseModel):
    template_id: str
    activar_modo_evento: bool = True
    musica_activa: bool = True
    titulo: str | None = None
    subtitulo: str | None = None


@router.post("/evento/plantillas/aplicar")
async def aplicar_plantilla(
    body: AplicarPlantillaIn,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    from app.services import evento_templates as et

    textos = {}
    if body.titulo:
        textos["titulo"] = body.titulo
    if body.subtitulo:
        textos["subtitulo"] = body.subtitulo
    try:
        return await et.apply_template(
            db,
            body.template_id,
            activar_modo_evento=body.activar_modo_evento,
            musica_activa=body.musica_activa,
            textos=textos or None,
        )
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.delete("/evento/plantillas/activa")
async def clear_plantilla(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    from app.services import evento_templates as et

    return await et.clear_active_template(db)


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
