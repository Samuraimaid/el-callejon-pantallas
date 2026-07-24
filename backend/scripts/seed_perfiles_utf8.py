#!/usr/bin/env python3
"""Re-siembra perfiles y reaplica textos con UTF-8 correcto (evita pipe PowerShell)."""
from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db import AsyncSessionLocal
from app.services.perfiles import apply_perfil_to_zonas

PERFILES = [
    {
        "clave": "restaurante_diario",
        "nombre": "Restaurante · Diario",
        "tipo": "diario",
        "descripcion": "Uso diario del local. Editable. Ideal para almuerzo y operación normal.",
        "modo_evento": False,
        "orden": 10,
        "plantillas": {
            "TV3": [
                {"principal": "Barra de El Callejón", "secundario": "Cócteles, cerveza y el toque de la casa"},
                {"principal": "Bebidas naturales", "secundario": "Jugos frescos elaborados al instante"},
                {"principal": "Para compartir", "secundario": "Picada, salsas y el sabor que une la mesa"},
                {"principal": "¡Bienvenidos a El Callejón!", "secundario": "Buffet y restaurante · León, Nicaragua"},
            ],
            "TV4": [
                {"principal": "A la parrilla", "secundario": "Cortes jugosos con sazón de León"},
                {"principal": "Costilla BBQ", "secundario": "Sabor ahumado que se recuerda"},
                {"principal": "El sabor de la casa", "secundario": "Platillos calientes recién preparados"},
                {"principal": "Buffet y porciones", "secundario": "Sabor, variedad y buena atención"},
            ],
            "TV5": [
                {"principal": "Salón VIP", "secundario": "Espacio íntimo para reuniones y celebraciones"},
                {"principal": "Tu lugar favorito en León", "secundario": "Ambiente cómodo para disfrutar sin prisa"},
                {"principal": "El Callejón VIP", "secundario": "León, Nicaragua · desde 1990"},
                {"principal": "Como en casa", "secundario": "Donde cada plato se siente especial"},
            ],
            "TV6": [
                {"principal": "Especial del chef", "secundario": "Siempre algo nuevo que probar"},
                {"principal": "Pescado fresco", "secundario": "Preparado al momento, aquí o para llevar"},
                {"principal": "Variedad VIP", "secundario": "Para todos los gustos en la mesa"},
                {"principal": "El Callejón · León", "secundario": "La Colonia, 2½ cuadras abajo · 11 a.m. – 3 p.m."},
            ],
        },
        "mensajes": {
            "TV3": [
                {"id": "rd-t3-1", "categoria": "chef", "texto": "Prueba nuestros jugos naturales 100% frescos elaborados al instante"},
                {"id": "rd-t3-2", "categoria": "sabias", "texto": "También para llevar: el mismo sabor de El Callejón en tu mesa de casa · WhatsApp 8512-1494"},
            ],
            "TV4": [
                {"id": "rd-t4-1", "categoria": "chef", "texto": "Costilla BBQ, camarones y pescado fresco: el sabor de la casa"},
                {"id": "rd-t4-2", "categoria": "sabias", "texto": "Nuestros asados se preparan al momento con sazón de León"},
            ],
            "TV5": [
                {"id": "rd-t5-1", "categoria": "sabias", "texto": "Disfruta de nuestro salón VIP climatizado para tus eventos privados"},
                {"id": "rd-t5-2", "categoria": "chef", "texto": "Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente"},
            ],
            "TV6": [
                {"id": "rd-t6-1", "categoria": "chef", "texto": "Pregunta por las recomendaciones del chef del día"},
                {"id": "rd-t6-2", "categoria": "sabias", "texto": "Cada platillo cuenta una historia de sabor desde 1990 en León"},
            ],
        },
    },
    {
        "clave": "modo_evento",
        "nombre": "Modo Evento",
        "tipo": "evento",
        "descripcion": "Perfil para cumpleaños y eventos privados. Activa modo evento en TVs seleccionadas.",
        "modo_evento": True,
        "orden": 20,
        "plantillas": {
            "TV3": [{"principal": "Celebramos contigo", "secundario": "Evento privado · El Callejón"}],
            "TV4": [{"principal": "¡Felicidades!", "secundario": "La mesa está lista para tu celebración"}],
            "TV5": [{"principal": "Salón VIP · Evento", "secundario": "Un espacio solo para ustedes"}],
            "TV6": [{"principal": "Buen provecho", "secundario": "El sabor de la casa en tu día especial"}],
        },
        "mensajes": {
            "TV3": [{"id": "ev-1", "categoria": "sabias", "texto": "Gracias por celebrar con nosotros en El Callejón"}],
            "TV4": [{"id": "ev-2", "categoria": "chef", "texto": "Menú especial del evento · pregunta a tu mesero"}],
            "TV5": [{"id": "ev-3", "categoria": "sabias", "texto": "Salón VIP reservado para su celebración"}],
            "TV6": [{"id": "ev-4", "categoria": "chef", "texto": "Brindemos por los momentos que unen la mesa"}],
        },
    },
    {
        "clave": "semana_santa_leon",
        "nombre": "Semana Santa · León",
        "tipo": "festivo",
        "descripcion": "Sugerencia festiva León: procesiones y almuerzos en familia.",
        "modo_evento": False,
        "orden": 30,
        "plantillas": {
            "TV3": [{"principal": "Semana Santa en León", "secundario": "Almuerza con la familia en El Callejón"}],
            "TV4": [{"principal": "Tradición y buen sabor", "secundario": "Platillos de la casa para estos días"}],
            "TV5": [{"principal": "Reuniones en familia", "secundario": "Salón VIP disponible para reservar"}],
            "TV6": [{"principal": "El Callejón te espera", "secundario": "Horario de almuerzo · León, Nicaragua"}],
        },
        "mensajes": {},
    },
    {
        "clave": "purisima",
        "nombre": "La Gritería / Purísima",
        "tipo": "festivo",
        "descripcion": "Temporada de La Purísima y Gritería en León.",
        "modo_evento": False,
        "orden": 40,
        "plantillas": {
            "TV3": [{"principal": "¡Quién causa tanta alegría!", "secundario": "La Purísima se celebra también en la mesa"}],
            "TV4": [{"principal": "Sabor de temporada", "secundario": "Comparte en familia en El Callejón"}],
            "TV5": [{"principal": "Gritería con los tuyos", "secundario": "Reserva tu mesa VIP"}],
            "TV6": [{"principal": "Tradición nicaragüense", "secundario": "El Callejón · León"}],
        },
        "mensajes": {},
    },
    {
        "clave": "independencia",
        "nombre": "Fiestas Patrias",
        "tipo": "festivo",
        "descripcion": "14–15 de septiembre y ambiente patriótico.",
        "modo_evento": False,
        "orden": 50,
        "plantillas": {
            "TV3": [{"principal": "¡Viva Nicaragua!", "secundario": "Celebra las fiestas patrias con nosotros"}],
            "TV4": [{"principal": "Sabor nica de verdad", "secundario": "Asados y platillos de la casa"}],
            "TV5": [{"principal": "Patria y buena mesa", "secundario": "Salón VIP para tu grupo"}],
            "TV6": [{"principal": "El Callejón · León", "secundario": "Orgullo de comer en casa"}],
        },
        "mensajes": {},
    },
    {
        "clave": "navidad_fin_ano",
        "nombre": "Navidad y Fin de Año",
        "tipo": "festivo",
        "descripcion": "Cena de empresa, familia y brindis de año nuevo.",
        "modo_evento": False,
        "orden": 60,
        "plantillas": {
            "TV3": [{"principal": "Felices fiestas", "secundario": "Brinda con nosotros esta temporada"}],
            "TV4": [{"principal": "Mesa de celebración", "secundario": "Lo mejor de la casa para tu reunión"}],
            "TV5": [{"principal": "Cena de fin de año", "secundario": "Reserva el salón VIP"}],
            "TV6": [{"principal": "Gracias por un año juntos", "secundario": "El Callejón · León, Nicaragua"}],
        },
        "mensajes": {},
    },
    {
        "clave": "dia_madre_padre",
        "nombre": "Día de la Madre / Padre",
        "tipo": "festivo",
        "descripcion": "Almuerzos especiales para mamá y papá.",
        "modo_evento": False,
        "orden": 70,
        "plantillas": {
            "TV3": [{"principal": "Hoy se celebra en familia", "secundario": "Mesa lista en El Callejón"}],
            "TV4": [{"principal": "Un almuerzo para recordar", "secundario": "Platillos favoritos de la casa"}],
            "TV5": [{"principal": "Mesa VIP familiar", "secundario": "Ambiente especial para los tuyos"}],
            "TV6": [{"principal": "Gracias, mamá · Gracias, papá", "secundario": "El Callejón te acompaña"}],
        },
        "mensajes": {},
    },
]


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for p in PERFILES:
            await db.execute(
                text(
                    """
                    INSERT INTO perfiles_campana
                        (clave, nombre, tipo, descripcion, editable, modo_evento, zonas,
                         plantillas, mensajes, orden, activo)
                    VALUES
                        (:clave, :nombre, :tipo, :descripcion, TRUE, :modo_evento,
                         CAST(:zonas AS jsonb), CAST(:plantillas AS jsonb),
                         CAST(:mensajes AS jsonb), :orden, TRUE)
                    ON CONFLICT (clave) DO UPDATE SET
                        nombre = EXCLUDED.nombre,
                        tipo = EXCLUDED.tipo,
                        descripcion = EXCLUDED.descripcion,
                        modo_evento = EXCLUDED.modo_evento,
                        plantillas = EXCLUDED.plantillas,
                        mensajes = EXCLUDED.mensajes,
                        orden = EXCLUDED.orden,
                        actualizado_en = NOW()
                    """
                ),
                {
                    "clave": p["clave"],
                    "nombre": p["nombre"],
                    "tipo": p["tipo"],
                    "descripcion": p["descripcion"],
                    "modo_evento": p["modo_evento"],
                    "zonas": json.dumps(["TV3", "TV4", "TV5", "TV6"], ensure_ascii=False),
                    "plantillas": json.dumps(p["plantillas"], ensure_ascii=False),
                    "mensajes": json.dumps(p.get("mensajes") or {}, ensure_ascii=False),
                    "orden": p["orden"],
                },
            )
            print("perfil", p["clave"], p["plantillas"]["TV3"][0]["principal"].encode("unicode_escape"))
        await db.commit()

        r = await apply_perfil_to_zonas(
            db,
            "restaurante_diario",
            ["TV3", "TV4", "TV5", "TV6"],
            replace_slides=True,
            apply_mensajes=True,
        )
        print("applied", r)

    # verify
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text(
                    "SELECT slides FROM campanas_publicidad WHERE zona::text='TV3' LIMIT 1"
                )
            )
        ).first()
        slides = row[0]
        if isinstance(slides, str):
            slides = json.loads(slides)
        t = slides[0].get("texto_principal", "")
        print("verify", t.encode("unicode_escape"))


if __name__ == "__main__":
    asyncio.run(main())
