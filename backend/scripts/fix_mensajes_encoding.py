"""Corrige textos de mensajes dinámicos con acentos UTF-8."""
from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text
from app.db import AsyncSessionLocal


MENSAJES = {
    "BARRA_BEBIDAS": [
        {
            "id": "b1",
            "categoria": "chef",
            "texto": "Prueba nuestros jugos naturales 100% frescos elaborados al instante",
        },
        {
            "id": "b2",
            "categoria": "sabias",
            "texto": "Desde 1990 servimos el sabor de León con la calma de lo bien hecho",
        },
        {
            "id": "b3",
            "categoria": "chef",
            "texto": "Pregunta por el cóctel de la casa y la cerveza bien fría de la barra",
        },
        {
            "id": "b4",
            "categoria": "sabias",
            "texto": "También para llevar: el mismo sabor de El Callejón en tu mesa de casa",
        },
        {
            "id": "b5",
            "categoria": "chef",
            "texto": "Costilla BBQ, camarones y pescado fresco: el sabor de la casa",
        },
    ],
    "SALON_VIP": [
        {
            "id": "v1",
            "categoria": "sabias",
            "texto": "Disfruta de nuestro salón VIP climatizado para tus eventos privados",
        },
        {
            "id": "v2",
            "categoria": "chef",
            "texto": "Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente",
        },
        {
            "id": "v3",
            "categoria": "sabias",
            "texto": "El Callejón VIP es ideal para reuniones de familia y celebraciones",
        },
        {
            "id": "v4",
            "categoria": "chef",
            "texto": "Combina tu buffet favorito con un jugo natural en el rincón más fresco del restaurante",
        },
        {
            "id": "v5",
            "categoria": "sabias",
            "texto": "Cada platillo cuenta una historia de sabor desde 1990 en León",
        },
    ],
}


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for zona, mensajes in MENSAJES.items():
            await db.execute(
                text(
                    """
                    UPDATE campanas_publicidad
                    SET mensajes = CAST(:m AS jsonb),
                        actualizado_en = NOW()
                    WHERE zona = CAST(:zona AS zona_publicidad)
                    """
                ),
                {
                    "m": json.dumps(mensajes, ensure_ascii=False),
                    "zona": zona,
                },
            )
        await db.commit()
    print("mensajes UTF-8 actualizados OK")


if __name__ == "__main__":
    asyncio.run(main())
