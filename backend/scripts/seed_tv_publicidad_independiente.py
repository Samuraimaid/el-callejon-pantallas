"""Semilla presentaciones distintas para TV3–TV6 (UTF-8)."""
from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text
from app.db import AsyncSessionLocal

# Presentaciones independientes por televisor
CAMPANAS = {
    "TV3": {
        "duracion_slide": 7000,
        "efecto_visual": "zoom-in",
        "efectos_aleatorios": False,
        "tamano_fuente": "mediano",
        "duracion_mensaje": 9000,
        "mensajes": [
            {
                "id": "t3-1",
                "categoria": "chef",
                "texto": "Prueba nuestros jugos naturales 100% frescos elaborados al instante",
            },
            {
                "id": "t3-2",
                "categoria": "sabias",
                "texto": "Desde 1990 servimos el sabor de León con la calma de lo bien hecho",
            },
            {
                "id": "t3-3",
                "categoria": "chef",
                "texto": "Pregunta por el cóctel de la casa y la cerveza bien fría de la barra",
            },
            {
                "id": "t3-4",
                "categoria": "sabias",
                "texto": "También para llevar: el mismo sabor de El Callejón en tu mesa de casa",
            },
        ],
        "slides": [
            {
                "id": "t3s1",
                "imagen_url": "/images/slides/slide8-barra.jpg",
                "texto_principal": "Barra de licores",
                "texto_secundario": "Cócteles, cerveza y premium",
            },
            {
                "id": "t3s2",
                "imagen_url": "/images/bebidas/jugos-naturales.jpg",
                "texto_principal": "Bebidas naturales",
                "texto_secundario": "Jugos frescos elaborados al instante",
            },
            {
                "id": "t3s3",
                "imagen_url": "/images/slides/slide-picada-fritura.jpg",
                "texto_principal": "Picada para compartir",
                "texto_secundario": "Frituras, salsas y el toque del Callejón",
            },
            {
                "id": "t3s4",
                "imagen_url": "/images/slides/slide-camarones.jpg",
                "texto_principal": "Camarones al ajillo",
                "texto_secundario": "Porción generosa de la casa",
            },
            {
                "id": "t3s5",
                "imagen_url": "/images/slides/slide5-bienvenidos.jpg",
                "texto_principal": "¡Bienvenidos!",
                "texto_secundario": "El sabor que forma parte de tu historia",
            },
            {
                "id": "t3s6",
                "imagen_url": "/images/publicidad/platillo-casa-1.jpg",
                "texto_principal": "Especialidades del día",
                "texto_secundario": "Pregunta por las recomendaciones del chef",
            },
        ],
    },
    "TV4": {
        "duracion_slide": 6500,
        "efecto_visual": "slide-left",
        "efectos_aleatorios": True,
        "tamano_fuente": "mediano",
        "duracion_mensaje": 8500,
        "mensajes": [
            {
                "id": "t4-1",
                "categoria": "chef",
                "texto": "Costilla BBQ, camarones y pescado fresco: el sabor de la casa",
            },
            {
                "id": "t4-2",
                "categoria": "sabias",
                "texto": "Nuestros asados se preparan al momento con sazón de León",
            },
            {
                "id": "t4-3",
                "categoria": "chef",
                "texto": "Prueba la parrilla: brochetas y carnes con el toque del Callejón",
            },
            {
                "id": "t4-4",
                "categoria": "sabias",
                "texto": "Ideal para compartir en familia o con amigos",
            },
        ],
        "slides": [
            {
                "id": "t4s1",
                "imagen_url": "/images/slides/slide-costilla-bbq.jpg",
                "texto_principal": "Costilla BBQ",
                "texto_secundario": "Sabor ahumado que se recuerda",
            },
            {
                "id": "t4s2",
                "imagen_url": "/images/publicidad/asados-parrilla-1.jpg",
                "texto_principal": "A la parrilla",
                "texto_secundario": "Asados con sazón de León",
            },
            {
                "id": "t4s3",
                "imagen_url": "/images/slides/slide-asados-2.jpg",
                "texto_principal": "El sabor de la casa",
                "texto_secundario": "Platillos calientes recién preparados",
            },
            {
                "id": "t4s4",
                "imagen_url": "/images/publicidad/brochetas-parrilla.jpg",
                "texto_principal": "Brochetas",
                "texto_secundario": "Parrilla y buena compañía",
            },
            {
                "id": "t4s5",
                "imagen_url": "/images/publicidad/platillo-casa-3.jpg",
                "texto_principal": "Platos generosos",
                "texto_secundario": "Hechos al momento",
            },
            {
                "id": "t4s6",
                "imagen_url": "/images/publicidad/mesa-compartir-1.jpg",
                "texto_principal": "Para compartir",
                "texto_secundario": "Variedad que convence",
            },
            {
                "id": "t4s7",
                "imagen_url": "/images/slides/slide-pollo-salsa.jpg",
                "texto_principal": "Pollo en salsa",
                "texto_secundario": "Tradición de la casa en cada bocado",
            },
        ],
    },
    "TV5": {
        "duracion_slide": 8000,
        "efecto_visual": "fade",
        "efectos_aleatorios": False,
        "tamano_fuente": "grande",
        "duracion_mensaje": 10000,
        "mensajes": [
            {
                "id": "t5-1",
                "categoria": "sabias",
                "texto": "Disfruta de nuestro salón VIP climatizado para tus eventos privados",
            },
            {
                "id": "t5-2",
                "categoria": "chef",
                "texto": "Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente",
            },
            {
                "id": "t5-3",
                "categoria": "sabias",
                "texto": "El Callejón VIP es ideal para reuniones de familia y celebraciones",
            },
            {
                "id": "t5-4",
                "categoria": "chef",
                "texto": "Combina tu buffet favorito con un jugo natural en el rincón más fresco del restaurante",
            },
        ],
        "slides": [
            {
                "id": "t5s1",
                "imagen_url": "/images/slides/slide-ambiente-salon-1.jpg",
                "texto_principal": "Salón VIP",
                "texto_secundario": "Espacio íntimo para reuniones y celebraciones",
            },
            {
                "id": "t5s2",
                "imagen_url": "/images/slides/slide-ambiente-luz-1.jpg",
                "texto_principal": "Tu lugar favorito en León",
                "texto_secundario": "Ambiente cómodo y servicio de calidad",
            },
            {
                "id": "t5s3",
                "imagen_url": "/images/publicidad/buffet-platos.jpg",
                "texto_principal": "Buffet y porciones",
                "texto_secundario": "Variedad para toda la familia",
            },
            {
                "id": "t5s4",
                "imagen_url": "/images/slides/slide3-salon.jpg",
                "texto_principal": "Disfruta tu almuerzo",
                "texto_secundario": "en nuestro ambiente climatizado VIP",
            },
            {
                "id": "t5s5",
                "imagen_url": "/images/slides/slide-ambiente-salon-3.jpg",
                "texto_principal": "Cada detalle importa",
                "texto_secundario": "cada sabor permanece",
            },
            {
                "id": "t5s6",
                "imagen_url": "/images/slides/slide5-bienvenidos.jpg",
                "texto_principal": "El Callejón VIP",
                "texto_secundario": "León, Nicaragua",
            },
        ],
    },
    "TV6": {
        "duracion_slide": 7500,
        "efecto_visual": "scale-soft",
        "efectos_aleatorios": True,
        "tamano_fuente": "grande",
        "duracion_mensaje": 9000,
        "mensajes": [
            {
                "id": "t6-1",
                "categoria": "chef",
                "texto": "Pescado fresco, pollo en salsa y costilla BBQ: lo mejor del menú VIP",
            },
            {
                "id": "t6-2",
                "categoria": "sabias",
                "texto": "Cada platillo cuenta una historia de sabor desde 1990 en León",
            },
            {
                "id": "t6-3",
                "categoria": "chef",
                "texto": "Pregunta por las especialidades del día en el salón VIP",
            },
            {
                "id": "t6-4",
                "categoria": "sabias",
                "texto": "Servicio preferente y ambiente pensado para disfrutar sin prisa",
            },
        ],
        "slides": [
            {
                "id": "t6s1",
                "imagen_url": "/images/slides/slide-pescado.jpg",
                "texto_principal": "Pescado fresco",
                "texto_secundario": "Preparado al momento, para llevar o disfrutar aquí",
            },
            {
                "id": "t6s2",
                "imagen_url": "/images/slides/slide-pollo-salsa.jpg",
                "texto_principal": "Pollo en salsa",
                "texto_secundario": "Tradición de la casa en cada bocado",
            },
            {
                "id": "t6s3",
                "imagen_url": "/images/slides/slide-costilla-bbq.jpg",
                "texto_principal": "Costilla BBQ",
                "texto_secundario": "El favorito de la casa",
            },
            {
                "id": "t6s4",
                "imagen_url": "/images/publicidad/platillo-casa-2.jpg",
                "texto_principal": "Platillos de la casa",
                "texto_secundario": "Hechos al momento con el sazón de El Callejón",
            },
            {
                "id": "t6s5",
                "imagen_url": "/images/slides/slide-platos-mixtos.jpg",
                "texto_principal": "Variedad VIP",
                "texto_secundario": "Para todos los gustos",
            },
            {
                "id": "t6s6",
                "imagen_url": "/images/publicidad/platillo-casa-10.jpg",
                "texto_principal": "Especial del chef",
                "texto_secundario": "Siempre algo nuevo que probar",
            },
            {
                "id": "t6s7",
                "imagen_url": "/images/slides/slide-ambiente-luz-2.jpg",
                "texto_principal": "El Callejón VIP",
                "texto_secundario": "León, Nicaragua",
            },
        ],
    },
}


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for zona, cfg in CAMPANAS.items():
            await db.execute(
                text(
                    """
                    UPDATE campanas_publicidad
                    SET activo = TRUE,
                        duracion_slide = :duracion_slide,
                        efecto_visual = :efecto_visual,
                        efectos_aleatorios = :efectos_aleatorios,
                        tamano_fuente = :tamano_fuente,
                        duracion_mensaje = :duracion_mensaje,
                        mensajes = CAST(:mensajes AS jsonb),
                        slides = CAST(:slides AS jsonb),
                        actualizado_en = NOW()
                    WHERE zona = CAST(:zona AS zona_publicidad)
                    """
                ),
                {
                    "zona": zona,
                    "duracion_slide": cfg["duracion_slide"],
                    "efecto_visual": cfg["efecto_visual"],
                    "efectos_aleatorios": cfg["efectos_aleatorios"],
                    "tamano_fuente": cfg["tamano_fuente"],
                    "duracion_mensaje": cfg["duracion_mensaje"],
                    "mensajes": json.dumps(cfg["mensajes"], ensure_ascii=False),
                    "slides": json.dumps(cfg["slides"], ensure_ascii=False),
                },
            )
        await db.commit()
    print("TV3–TV6 presentaciones independientes OK")


if __name__ == "__main__":
    asyncio.run(main())
