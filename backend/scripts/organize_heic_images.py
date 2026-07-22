"""
Clasifica y copia fotos HEIC convertidas a carpetas del frontend.

Ejecutar en el host (PowerShell) o copiar al contenedor:
  python backend/scripts/organize_heic_images.py
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "frontend" / "public" / "images" / "_raw_convert"
IMG = ROOT / "frontend" / "public" / "images"

# Clasificación por análisis de color + uso previsto
# ambiente_* = salón / iluminación / local
# asados_*  = tonos naranja/rojo fuertes (parrilla, fritura, BBQ)
# platillo_* = comida general
# buffet_*  = landscape / variedad de platos
MAP = {
    # --- Ambiente / publicidad de local ---
    "heic-03.jpg": ("slides", "slide-ambiente-luz-1.jpg"),
    "heic-08.jpg": ("slides", "slide-ambiente-luz-2.jpg"),
    "heic-12.jpg": ("slides", "slide-ambiente-salon-1.jpg"),
    "heic-16.jpg": ("slides", "slide-ambiente-salon-2.jpg"),
    # --- Asados / tonos muy cálidos ---
    "heic-10.jpg": ("publicidad", "asados-parrilla-1.jpg"),
    "heic-14.jpg": ("slides", "slide-asados-2.jpg"),
    "heic-15.jpg": ("publicidad", "asados-parrilla-2.jpg"),
    # --- Platillos de la casa ---
    "heic-01.jpg": ("publicidad", "platillo-casa-1.jpg"),
    "heic-04.jpg": ("publicidad", "platillo-casa-2.jpg"),
    "heic-05.jpg": ("publicidad", "platillo-casa-3.jpg"),
    "heic-07.jpg": ("publicidad", "platillo-casa-4.jpg"),
    "heic-09.jpg": ("publicidad", "platillo-casa-5.jpg"),
    "heic-11.jpg": ("publicidad", "platillo-casa-6.jpg"),
    "heic-13.jpg": ("publicidad", "platillo-casa-7.jpg"),
    "heic-17.jpg": ("publicidad", "platillo-casa-8.jpg"),
    "heic-18.jpg": ("publicidad", "platillo-casa-9.jpg"),
    # --- Landscape / mesa compartida ---
    "heic-02.jpg": ("publicidad", "mesa-compartir-1.jpg"),
    "heic-06.jpg": ("publicidad", "mesa-compartir-2.jpg"),
}

# También copias a slides/ con nombres de campaña
SLIDE_ALIASES = {
    "asados-parrilla-1.jpg": "slide-asados-1.jpg",
    "platillo-casa-1.jpg": "slide-platillo-casa-1.jpg",
    "platillo-casa-2.jpg": "slide-platillo-casa-2.jpg",
    "mesa-compartir-1.jpg": "slide-mesa-1.jpg",
    "mesa-compartir-2.jpg": "slide-mesa-2.jpg",
}


def main() -> None:
    if not RAW.exists():
        raise SystemExit(f"No existe {RAW}")

    copied = 0
    for src_name, (folder, dest_name) in MAP.items():
        src = RAW / src_name
        if not src.exists():
            print(f"SKIP missing {src_name}")
            continue
        dest_dir = IMG / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / dest_name
        shutil.copy2(src, dest)
        print(f"OK {src_name} -> {folder}/{dest_name}")
        copied += 1

        if dest_name in SLIDE_ALIASES:
            alias = IMG / "slides" / SLIDE_ALIASES[dest_name]
            shutil.copy2(src, alias)
            print(f"   + slides/{alias.name}")

    # Mantener slide-local-* sincronizados con los mismos heic originales
    local_map = {
        "heic-04.jpg": "slide-local-1.jpg",
        "heic-05.jpg": "slide-local-2.jpg",
        "heic-02.jpg": "slide-local-3.jpg",
        "heic-01.jpg": "slide-local-4.jpg",
        "heic-18.jpg": "slide-local-5.jpg",
        "heic-07.jpg": "slide-local-6.jpg",
    }
    for src_name, dest_name in local_map.items():
        src = RAW / src_name
        if src.exists():
            shutil.copy2(src, IMG / "slides" / dest_name)

    print(f"Listo: {copied} archivos clasificados")


if __name__ == "__main__":
    main()
