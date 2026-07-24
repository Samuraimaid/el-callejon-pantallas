"""API de campañas publicitarias por zona (TVs Barra / VIP)."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import CurrentUser, require_caja
from app.services import perfiles as perfiles_svc
from app.services import publicidad as pub_svc
from app.services import video_jobs as vjobs
from app.services.publicidad import EFECTOS

router = APIRouter(prefix="/api/publicidad", tags=["publicidad"])


class SlideIn(BaseModel):
    id: str | None = None
    media_tipo: Literal["image", "video"] | None = None
    imagen_url: str = ""
    video_url: str = ""
    texto_principal: str = ""
    texto_secundario: str = ""
    animacion_texto: str = "fade-in-up"
    tamano_texto: Literal["pequeno", "mediano", "grande"] | None = "mediano"


class MensajeIn(BaseModel):
    id: str | None = None
    categoria: Literal["chef", "sabias"] = "chef"
    texto: str = Field(default="", max_length=280)


class CampanaPut(BaseModel):
    activo: bool | None = None
    duracion_slide: int | None = Field(default=None, ge=2000, le=60000)
    efecto_visual: str | None = Field(
        default=None,
        description="Uno de los 10 efectos, o se ignora si efectos_aleatorios=true",
    )
    slides: list[SlideIn] | None = None
    mostrar_logo: bool | None = None
    tamano_fuente: Literal["pequeno", "mediano", "grande"] | None = None
    efectos_aleatorios: bool | None = None
    mostrar_mensajes: bool | None = None
    duracion_mensaje: int | None = Field(default=None, ge=3000, le=60000)
    mensajes: list[MensajeIn] | None = None


class PerfilPut(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    zonas: list[str] | None = None
    plantillas: dict[str, Any] | None = None
    mensajes: dict[str, Any] | None = None
    config: dict[str, Any] | None = None
    modo_evento: bool | None = None


class PerfilApply(BaseModel):
    zonas: list[str]
    replace_slides: bool = False
    apply_mensajes: bool = True


class PerfilCreate(BaseModel):
    clave: str
    nombre: str
    tipo: Literal["diario", "evento", "festivo", "custom"] = "custom"
    descripcion: str = ""
    plantillas: dict[str, Any] | None = None
    mensajes: dict[str, Any] | None = None
    zonas: list[str] | None = None
    modo_evento: bool = False


@router.get("/efectos")
async def listar_efectos():
    """Catálogo de efectos disponibles (para UI del control)."""
    return {
        "efectos": sorted(EFECTOS),
        "labels": {
            "zoom-in": "Zoom In",
            "fade": "Desvanecer (fade)",
            "slide-left": "Desplazar izquierda",
            "slide-right": "Desplazar derecha",
            "slide-up": "Desplazar arriba",
            "giro-3d": "Giro 3D",
            "persiana": "Efecto persiana",
            "scale-soft": "Escalado suave",
            "blur": "Desenfoque progresivo",
            "flip-h": "Flip horizontal",
        },
        "categorias_mensaje": {
            "chef": "Recomendaciones del Chef",
            "sabias": "¿Sabías qué? de El Callejón",
        },
    }


# —— Perfiles (rutas fijas ANTES de /{zona}) ——


@router.get("/perfiles")
async def listar_perfiles(db: AsyncSession = Depends(get_db)):
    return {"perfiles": await perfiles_svc.list_perfiles(db)}


@router.post("/perfiles")
async def crear_perfil(
    body: PerfilCreate,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    return await perfiles_svc.create_perfil(
        db,
        clave=body.clave,
        nombre=body.nombre,
        tipo=body.tipo,
        descripcion=body.descripcion,
        plantillas=body.plantillas,
        mensajes=body.mensajes,
        zonas=body.zonas,
        modo_evento=body.modo_evento,
    )


@router.get("/perfiles/{clave}")
async def obtener_perfil(clave: str, db: AsyncSession = Depends(get_db)):
    return await perfiles_svc.get_perfil(db, clave)


@router.put("/perfiles/{clave}")
async def actualizar_perfil(
    clave: str,
    body: PerfilPut,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    return await perfiles_svc.update_perfil(
        db,
        clave,
        nombre=body.nombre,
        descripcion=body.descripcion,
        zonas=body.zonas,
        plantillas=body.plantillas,
        mensajes=body.mensajes,
        config=body.config,
        modo_evento=body.modo_evento,
    )


@router.post("/perfiles/{clave}/aplicar")
async def aplicar_perfil(
    clave: str,
    body: PerfilApply,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    return await perfiles_svc.apply_perfil_to_zonas(
        db,
        clave,
        body.zonas,
        replace_slides=body.replace_slides,
        apply_mensajes=body.apply_mensajes,
    )


# —— Video jobs / multi-upload ——


@router.post("/videos/multi")
async def subir_videos_multi(
    files: list[UploadFile] = File(...),
    zonas: str = Form(default="TV3"),
    perfil: str = Form(default="restaurante_diario"),
    append: str = Form(default="true"),
    modo_evento: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """
    Sube varios videos a la vez.
    zonas: CSV o JSON list, ej. TV3,TV4,TV5
    perfil: clave de plantillas auto
    """
    zlist = []
    zraw = (zonas or "").strip()
    if zraw.startswith("["):
        import json

        try:
            zlist = [str(x).upper() for x in json.loads(zraw)]
        except Exception:
            zlist = []
    else:
        zlist = [p.strip().upper() for p in zraw.replace(";", ",").split(",") if p.strip()]

    evt = None
    if modo_evento.lower() in ("1", "true", "yes", "si", "sí"):
        evt = True
    elif modo_evento.lower() in ("0", "false", "no"):
        evt = False

    return await vjobs.create_multi_upload(
        db,
        files,
        zonas=zlist,
        perfil_clave=(perfil or "restaurante_diario").strip(),
        append=str(append).lower() not in ("0", "false", "no"),
        activar_modo_evento=evt,
    )


@router.get("/videos/batch/{batch_id}")
async def estado_batch(batch_id: str, db: AsyncSession = Depends(get_db)):
    return await vjobs.get_batch(db, batch_id)


@router.get("/videos/jobs")
async def listar_batches(
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    return {"batches": await vjobs.list_recent_batches(db)}


@router.post("/repair-encoding")
async def repair_encoding(
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """Re-guarda todas las campañas corrigiendo mojibake en slides y mensajes."""
    from app.services.publicidad import ZONAS_ACTIVAS

    fixed = {}
    for zona in sorted(ZONAS_ACTIVAS):
        c = await pub_svc.get_campana(db, zona)
        updated = await pub_svc.update_campana(
            db,
            zona,
            slides=c.get("slides"),
            mensajes=c.get("mensajes"),
        )
        fixed[zona] = {
            "slides": len(updated.get("slides") or []),
            "mensajes": len(updated.get("mensajes") or []),
            "sample": (updated.get("mensajes") or [{}])[0].get("texto", "")[:80]
            if updated.get("mensajes")
            else "",
        }
    return {"ok": True, "zonas": fixed}


@router.get("/{zona}")
async def obtener_campana(
    zona: str,
    db: AsyncSession = Depends(get_db),
):
    """TV / control: configuración, slides y mensajes de la zona."""
    return await pub_svc.get_campana(db, zona)


@router.put("/{zona}")
async def actualizar_campana(
    zona: str,
    body: CampanaPut,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """Actualiza campaña. Emite WS t=pub a pantallas de la zona."""
    slides: list[dict[str, Any]] | None = None
    if body.slides is not None:
        slides = [s.model_dump() for s in body.slides]
    mensajes: list[dict[str, Any]] | None = None
    if body.mensajes is not None:
        mensajes = [m.model_dump() for m in body.mensajes]
    return await pub_svc.update_campana(
        db,
        zona,
        activo=body.activo,
        duracion_slide=body.duracion_slide,
        efecto_visual=body.efecto_visual,
        slides=slides,
        mostrar_logo=body.mostrar_logo,
        tamano_fuente=body.tamano_fuente,
        efectos_aleatorios=body.efectos_aleatorios,
        mostrar_mensajes=body.mostrar_mensajes,
        duracion_mensaje=body.duracion_mensaje,
        mensajes=mensajes,
    )


@router.post("/{zona}/subir-slide")
async def subir_slide(
    zona: str,
    file: UploadFile = File(...),
    texto_principal: str = Form(default=""),
    texto_secundario: str = Form(default=""),
    animacion_texto: str = Form(default="fade-in-up"),
    tamano_texto: str = Form(default="mediano"),
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """Carga imagen o video (mp4/webm) a la campaña; video se reescala a 1080p."""
    return await pub_svc.add_slide_image(
        db,
        zona,
        file,
        texto_principal=texto_principal,
        texto_secundario=texto_secundario,
        animacion_texto=animacion_texto,
        tamano_texto=tamano_texto,
    )
