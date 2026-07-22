"""API de campañas publicitarias por zona (TVs Barra / VIP)."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import CurrentUser, require_caja
from app.services import publicidad as pub_svc
from app.services.publicidad import EFECTOS

router = APIRouter(prefix="/api/publicidad", tags=["publicidad"])


class SlideIn(BaseModel):
    id: str | None = None
    imagen_url: str = ""
    texto_principal: str = ""
    texto_secundario: str = ""


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
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """Carga imagen publicitaria a public/images/slides/ y la agrega a la campaña."""
    return await pub_svc.add_slide_image(
        db,
        zona,
        file,
        texto_principal=texto_principal,
        texto_secundario=texto_secundario,
    )
