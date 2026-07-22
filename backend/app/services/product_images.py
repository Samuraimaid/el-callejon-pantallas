"""
Procesamiento de imágenes de producto:
  - Hero 1:1 → {CODIGO}.jpg
  - Tarjeta ancha → {CODIGO}-card.jpg
  - rembg opcional + filtros ya aplicados en cliente
"""

from __future__ import annotations

import io
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.config import get_settings

BEBIDAS_TIPOS = frozenset({"bebida_jugo", "bebida_soda", "cafe", "licor"})
EXTRA_TIPOS = frozenset({"extra"})


def image_subdir(tipo: str) -> str:
    if tipo in BEBIDAS_TIPOS:
        return "bebidas"
    if tipo in EXTRA_TIPOS:
        return "extras"
    return "platillos"


def image_filename(codigo: str, role: str = "hero") -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in codigo.upper())
    if role == "card":
        return f"{safe}-card.jpg"
    return f"{safe}.jpg"


def public_url(tipo: str, codigo: str, version: int | None = None, role: str = "hero") -> str:
    path = f"/images/{image_subdir(tipo)}/{image_filename(codigo, role)}"
    if version is not None:
        return f"{path}?v={version}"
    return path


def absolute_path(tipo: str, codigo: str, role: str = "hero") -> Path:
    settings = get_settings()
    root = Path(settings.image_root)
    folder = root / image_subdir(tipo)
    folder.mkdir(parents=True, exist_ok=True)
    return folder / image_filename(codigo, role)


def process_image(raw: bytes, *, remove_bg: bool = False, max_side: int = 1200) -> bytes:
    """
    Opcionalmente rembg; redimensiona; JPEG.
    Si remove_bg: pega sobre blanco. Si no: conserva la foto completa.
    """
    from PIL import Image

    if remove_bg:
        try:
            from rembg import remove as rembg_remove

            cut = rembg_remove(raw)
            fg = Image.open(io.BytesIO(cut)).convert("RGBA")
            w, h = fg.size
            scale = min(1.0, max_side / max(w, h))
            if scale < 1.0:
                fg = fg.resize(
                    (int(w * scale), int(h * scale)), Image.Resampling.LANCZOS
                )
            canvas = Image.new("RGB", fg.size, (255, 255, 255))
            canvas.paste(fg, mask=fg.split()[3])
            out = io.BytesIO()
            canvas.save(out, format="JPEG", quality=88, optimize=True)
            return out.getvalue()
        except Exception:
            pass

    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


# Compat nombre antiguo
def process_to_white_background(raw: bytes, max_side: int = 900) -> bytes:
    return process_image(raw, remove_bg=True, max_side=max_side)


async def save_product_image(
    upload: UploadFile,
    *,
    codigo: str,
    tipo: str,
    remove_bg: bool = False,
    role: str = "hero",
) -> dict[str, Any]:
    if upload.content_type and not upload.content_type.startswith("image/"):
        raise HTTPException(400, "El archivo debe ser una imagen")

    raw = await upload.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(400, "Imagen demasiado grande (máx. 12 MB)")

    try:
        jpeg = process_image(raw, remove_bg=remove_bg)
    except Exception as e:
        raise HTTPException(422, f"No se pudo procesar la imagen: {e}") from e

    dest = absolute_path(tipo, codigo, role=role)
    dest.write_bytes(jpeg)

    version = int(time.time())
    url = public_url(tipo, codigo, version, role=role)
    return {
        "ok": True,
        "codigo": codigo,
        "tipo": tipo,
        "role": role,
        "path": str(dest),
        "url": url,
        "v": version,
        "bytes": len(jpeg),
    }
