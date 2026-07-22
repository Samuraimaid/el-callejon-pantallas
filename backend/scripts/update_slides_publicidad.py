"""Actualiza slides de campañas con fotos reales del restaurante (UTF-8)."""
from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text
from app.db import AsyncSessionLocal

# Textos en español UTF-8 correcto. Imágenes clasificadas por tema.
SLIDES = {
    "BARRA_BEBIDAS": [
        {
            "id": "s1",
            "imagen_url": "/images/slides/slide-costilla-bbq.jpg",
            "texto_principal": "Costilla BBQ",
            "texto_secundario": "Sabor ahumado que se recuerda",
        },
        {
            "id": "s2",
            "imagen_url": "/images/slides/slide-camarones.jpg",
            "texto_principal": "Camarones al ajillo",
            "texto_secundario": "Porción generosa de la casa",
        },
        {
            "id": "s3",
            "imagen_url": "/images/slides/slide-picada-fritura.jpg",
            "texto_principal": "Picada para compartir",
            "texto_secundario": "Frituras, salsas y el toque del Callejón",
        },
        {
            "id": "s4",
            "imagen_url": "/images/bebidas/jugos-naturales.jpg",
            "texto_principal": "Bebidas naturales",
            "texto_secundario": "Jugos frescos elaborados al instante",
        },
        {
            "id": "s5",
            "imagen_url": "/images/slides/slide8-barra.jpg",
            "texto_principal": "Barra de licores",
            "texto_secundario": "Cócteles, cerveza y premium",
        },
        {
            "id": "s6",
            "imagen_url": "/images/publicidad/asados-parrilla-1.jpg",
            "texto_principal": "A la parrilla",
            "texto_secundario": "Asados y brochetas con sazón de León",
        },
        {
            "id": "s7",
            "imagen_url": "/images/slides/slide-asados-2.jpg",
            "texto_principal": "El sabor de la casa",
            "texto_secundario": "Platillos calientes recién preparados",
        },
        {
            "id": "s8",
            "imagen_url": "/images/slides/slide5-bienvenidos.jpg",
            "texto_principal": "¡Bienvenidos!",
            "texto_secundario": "El sabor que forma parte de tu historia",
        },
        {
            "id": "s9",
            "imagen_url": "/images/publicidad/platillo-casa-1.jpg",
            "texto_principal": "Especialidades del día",
            "texto_secundario": "Pregunta por las recomendaciones del chef",
        },
    ],
    "SALON_VIP": [
        {
            "id": "v1",
            "imagen_url": "/images/slides/slide-platos-mixtos.jpg",
            "texto_principal": "Disfruta tu almuerzo",
            "texto_secundario": "en nuestro ambiente climatizado VIP",
        },
        {
            "id": "v2",
            "imagen_url": "/images/slides/slide-pescado.jpg",
            "texto_principal": "Pescado fresco",
            "texto_secundario": "Preparado al momento, para llevar o disfrutar aquí",
        },
        {
            "id": "v3",
            "imagen_url": "/images/slides/slide-pollo-salsa.jpg",
            "texto_principal": "Pollo en salsa",
            "texto_secundario": "Tradición de la casa en cada bocado",
        },
        {
            "id": "v4",
            "imagen_url": "/images/slides/slide-ambiente-salon-1.jpg",
            "texto_principal": "Salón VIP",
            "texto_secundario": "Espacio íntimo para reuniones y celebraciones",
        },
        {
            "id": "v5",
            "imagen_url": "/images/publicidad/buffet-platos.jpg",
            "texto_principal": "Buffet y porciones",
            "texto_secundario": "Variedad para toda la familia",
        },
        {
            "id": "v6",
            "imagen_url": "/images/slides/slide-costilla-bbq.jpg",
            "texto_principal": "Cada detalle importa",
            "texto_secundario": "cada sabor permanece",
        },
        {
            "id": "v7",
            "imagen_url": "/images/slides/slide-ambiente-luz-1.jpg",
            "texto_principal": "Tu lugar favorito en León",
            "texto_secundario": "Ambiente cómodo y servicio de calidad",
        },
        {
            "id": "v8",
            "imagen_url": "/images/publicidad/platillo-casa-2.jpg",
            "texto_principal": "Platillos de la casa",
            "texto_secundario": "Hechos al momento con el sazón de El Callejón",
        },
        {
            "id": "v9",
            "imagen_url": "/images/slides/slide5-bienvenidos.jpg",
            "texto_principal": "El Callejón VIP",
            "texto_secundario": "León, Nicaragua",
        },
    ],
}


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for zona, slides in SLIDES.items():
            await db.execute(
                text(
                    """
                    UPDATE campanas_publicidad
                    SET slides = CAST(:s AS jsonb),
                        actualizado_en = NOW()
                    WHERE zona = CAST(:zona AS zona_publicidad)
                    """
                ),
                {
                    "s": json.dumps(slides, ensure_ascii=False),
                    "zona": zona,
                },
            )
        await db.commit()
    print("slides actualizados OK")


if __name__ == "__main__":
    asyncio.run(main())
