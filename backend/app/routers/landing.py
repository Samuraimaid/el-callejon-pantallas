"""Router para la Landing Page pública y su Backoffice CMS."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.deps import CurrentUser, require_caja
from app.services import landing_page as lp_svc

router = APIRouter(prefix="/api/landing", tags=["landing-page"])


class LandingUpdateIn(BaseModel):
    info_general: dict[str, Any] | None = None
    visibilidad_secciones: dict[str, Any] | None = None
    hero: dict[str, Any] | None = None
    sobre_nosotros: dict[str, Any] | None = None
    eventos: list[dict[str, Any]] | None = None
    menu_items: list[dict[str, Any]] | None = None
    galeria_fotos: list[dict[str, Any]] | None = None


@router.get("")
async def obtener_landing_config(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Endpoint público: configuración completa de la Landing Page."""
    return await lp_svc.get_landing_config(db)


@router.put("")
async def actualizar_landing_config(
    body: LandingUpdateIn,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
) -> dict[str, Any]:
    """Endpoint administrativo: guarda cambios desde el CMS en ControlCenter."""
    data = body.model_dump(exclude_unset=True)
    return await lp_svc.update_landing_config(db, data)


@router.get("/imagenes")
async def listar_imagenes_biblioteca(
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
) -> dict[str, Any]:
    """Lista las imágenes existentes en la base unificada para selector rápido."""
    return {"imagenes": lp_svc.list_available_images()}


@router.post("/upload-image")
async def subir_imagen_landing(
    file: UploadFile = File(..., description="Foto para el sitio web"),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
) -> dict[str, Any]:
    """Sube una imagen al repositorio compartido (/images/landing/)."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(400, "El archivo debe ser una imagen válida")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(400, "La imagen no debe superar los 15 MB")

    settings = get_settings()
    root = Path(settings.image_root)
    # Soporte dev local
    if not root.exists():
        dev_root = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "images"
        if dev_root.exists():
            root = dev_root

    landing_dir = root / "landing"
    landing_dir.mkdir(parents=True, exist_ok=True)

    orig_name = Path(file.filename or "imagen.jpg").stem
    clean_name = "".join(c for c in orig_name if c.isalnum() or c in ("-", "_")).lower()[:30]
    filename = f"{clean_name}_{int(time.time())}.jpg"
    target_path = landing_dir / filename

    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(raw))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        # Limitar resolución a máx 1920px de ancho/alto manteniendo proporción
        img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
        img.save(str(target_path), "JPEG", quality=88, optimize=True)
    except Exception:
        # Fallback guardado directo
        target_path.write_bytes(raw)

    public_url = f"/images/landing/{filename}"
    return {
        "ok": True,
        "url": public_url,
        "filename": filename,
    }
