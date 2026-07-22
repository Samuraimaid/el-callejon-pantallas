"""
Procesamiento de imágenes de producto:
  recorte del cliente → rembg (sin fondo) → lienzo blanco → JPEG optimizado.
"""

from __future__ import annotations

import io
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.config import get_settings

# Carpetas por tipo (relativas a IMAGE_ROOT)
BEBIDAS_TIPOS = frozenset({"bebida_jugo", "bebida_soda", "cafe", "licor"})


def image_subdir(tipo: str) -> str:
    return "bebidas" if tipo in BEBIDAS_TIPOS else "platillos"


def image_filename(codigo: str) -> str:
    # Código único del producto (ej. PLT-CORDON.jpg)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in codigo.upper())
    return f"{safe}.jpg"


def public_url(tipo: str, codigo: str, version: int | None = None) -> str:
    path = f"/images/{image_subdir(tipo)}/{image_filename(codigo)}"
    if version is not None:
        return f"{path}?v={version}"
    return path


def absolute_path(tipo: str, codigo: str) -> Path:
    settings = get_settings()
    root = Path(settings.image_root)
    folder = root / image_subdir(tipo)
    folder.mkdir(parents=True, exist_ok=True)
    return folder / image_filename(codigo)


def process_to_white_background(raw: bytes, max_side: int = 900) -> bytes:
    """
    rembg.remove → RGBA → pegar sobre fondo blanco → JPEG optimizado.
    Si rembg no está disponible, redimensiona y aplana sobre blanco.
    """
    from PIL import Image

    try:
        from rembg import remove as rembg_remove

        cut = rembg_remove(raw)
        fg = Image.open(io.BytesIO(cut)).convert("RGBA")
    except Exception:
        # Fallback local: sin rembg, solo normalizar sobre blanco
        fg = Image.open(io.BytesIO(raw)).convert("RGBA")

    # Limitar tamaño (pantallas 70" no necesitan 4K en card)
    w, h = fg.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        fg = fg.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", fg.size, (255, 255, 255))
    canvas.paste(fg, mask=fg.split()[3] if fg.mode == "RGBA" else None)

    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()


async def save_product_image(
    upload: UploadFile,
    *,
    codigo: str,
    tipo: str,
) -> dict[str, Any]:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(400, "El archivo debe ser una imagen")

    raw = await upload.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(400, "Imagen demasiado grande (máx. 12 MB)")

    try:
        jpeg = process_to_white_background(raw)
    except Exception as e:
        raise HTTPException(422, f"No se pudo procesar la imagen: {e}") from e

    dest = absolute_path(tipo, codigo)
    dest.write_bytes(jpeg)

    version = int(time.time())
    url = public_url(tipo, codigo, version)
    return {
        "ok": True,
        "codigo": codigo,
        "tipo": tipo,
        "path": str(dest),
        "url": url,
        "v": version,
        "bytes": len(jpeg),
    }
