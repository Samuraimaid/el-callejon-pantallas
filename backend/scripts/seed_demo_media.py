#!/usr/bin/env python3
"""
Asegura slides de muestra (fotos + 2 videos seed) en TV3/TV4 para presentar el proyecto.

Requiere:
  - Imágenes en frontend/public/images (slides/publicidad) — versionadas en Git
  - Videos seed-demo-*.mp4 en frontend/public/images/videos/ — versionados en Git

Uso (en contenedor backend):
  python /tmp/seed_demo_media.py
  # o con el app montado:
  python -m scripts no;  python /app/... no
  docker exec el_callejon_backend python /tmp/seed_demo_media.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db import AsyncSessionLocal
from app.config import get_settings

# Slides de foto (ya en repo) + videos seed
DEMO = {
    "TV3": {
        "duracion_slide": 7000,
        "efecto_visual": "fade",
        "slides": [
            {
                "id": "demo-v-barra",
                "media_tipo": "video",
                "imagen_url": "/images/videos/seed-demo-barra.jpg",
                "video_url": "/images/videos/seed-demo-barra.mp4",
                "texto_principal": "Barra de El Callejón",
                "texto_secundario": "Video de muestra · León, Nicaragua",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t3-1",
                "media_tipo": "image",
                "imagen_url": "/images/slides/slide8-barra.jpg",
                "video_url": "",
                "texto_principal": "Barra de El Callejón",
                "texto_secundario": "Cócteles, cerveza y el toque de la casa",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t3-2",
                "media_tipo": "image",
                "imagen_url": "/images/bebidas/jugos-naturales.jpg",
                "video_url": "",
                "texto_principal": "Bebidas naturales",
                "texto_secundario": "Jugos frescos elaborados al instante",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t3-3",
                "media_tipo": "image",
                "imagen_url": "/images/slides/slide-camarones.jpg",
                "video_url": "",
                "texto_principal": "Camarones al ajillo",
                "texto_secundario": "Porción generosa de la casa",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t3-4",
                "media_tipo": "image",
                "imagen_url": "/images/slides/slide5-bienvenidos.jpg",
                "video_url": "",
                "texto_principal": "¡Bienvenidos a El Callejón!",
                "texto_secundario": "Buffet y restaurante · León, Nicaragua",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
        ],
        "mensajes": [
            {
                "id": "demo-m1",
                "categoria": "chef",
                "texto": "Prueba nuestros jugos naturales 100% frescos elaborados al instante",
            },
            {
                "id": "demo-m2",
                "categoria": "sabias",
                "texto": "También para llevar: el mismo sabor de El Callejón · WhatsApp 8512-1494",
            },
        ],
    },
    "TV4": {
        "duracion_slide": 6500,
        "efecto_visual": "zoom-in",
        "slides": [
            {
                "id": "demo-v-parrilla",
                "media_tipo": "video",
                "imagen_url": "/images/videos/seed-demo-parrilla.jpg",
                "video_url": "/images/videos/seed-demo-parrilla.mp4",
                "texto_principal": "A la parrilla",
                "texto_secundario": "Video de muestra · sazón de León",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t4-1",
                "media_tipo": "image",
                "imagen_url": "/images/slides/slide-costilla-bbq.jpg",
                "video_url": "",
                "texto_principal": "Costilla BBQ",
                "texto_secundario": "Sabor ahumado que se recuerda",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t4-2",
                "media_tipo": "image",
                "imagen_url": "/images/publicidad/asados-parrilla-1.jpg",
                "video_url": "",
                "texto_principal": "Asados de la casa",
                "texto_secundario": "Cortes jugosos listos para compartir",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
            {
                "id": "demo-t4-3",
                "media_tipo": "image",
                "imagen_url": "/images/slides/slide1-buffet.jpg",
                "video_url": "",
                "texto_principal": "Buffet y porciones",
                "texto_secundario": "Sabor, variedad y buena atención",
                "animacion_texto": "fade-in-up",
                "tamano_texto": "mediano",
            },
        ],
        "mensajes": [
            {
                "id": "demo-m4",
                "categoria": "chef",
                "texto": "Costilla BBQ, camarones y pescado fresco: el sabor de la casa",
            },
        ],
    },
}


def _files_ok() -> list[str]:
    root = Path(get_settings().image_root)
    missing = []
    for rel in (
        "videos/seed-demo-barra.mp4",
        "videos/seed-demo-parrilla.mp4",
        "slides/slide8-barra.jpg",
        "slides/slide-costilla-bbq.jpg",
        "slides/slide1-buffet.jpg",
        "bebidas/jugos-naturales.jpg",
    ):
        if not (root / rel).is_file():
            missing.append(str(root / rel))
    return missing


async def main() -> None:
    missing = _files_ok()
    if missing:
        print("WARN archivos faltantes (el seed de DB igual se escribe):")
        for m in missing:
            print(" ", m)

    async with AsyncSessionLocal() as db:
        for zona, cfg in DEMO.items():
            await db.execute(
                text(
                    """
                    UPDATE campanas_publicidad
                    SET slides = CAST(:slides AS jsonb),
                        mensajes = CAST(:mensajes AS jsonb),
                        duracion_slide = :dur,
                        efecto_visual = CAST(:ef AS efecto_visual_publicidad),
                        activo = TRUE,
                        actualizado_en = NOW()
                    WHERE zona = CAST(:zona AS zona_publicidad)
                    """
                ),
                {
                    "slides": json.dumps(cfg["slides"], ensure_ascii=False),
                    "mensajes": json.dumps(cfg["mensajes"], ensure_ascii=False),
                    "dur": cfg["duracion_slide"],
                    "ef": cfg["efecto_visual"],
                    "zona": zona,
                },
            )
            print(f"OK {zona}: {len(cfg['slides'])} slides demo")
        await db.commit()
    print("Seed demo media aplicado. Abra /tv/3 y /tv/4 para presentar.")


if __name__ == "__main__":
    asyncio.run(main())
