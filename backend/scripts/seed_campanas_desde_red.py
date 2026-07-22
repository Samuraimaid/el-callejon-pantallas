"""
Campañas enriquecidas con datos públicos del restaurante:
- Facebook: Buffet y Restaurante El Callejón
- Instagram: @elcallejon_buffet
- Ubicación, horarios, tono de marca y mensajes de redes

Ejecutar en el contenedor:
  python /app/seed_campanas_desde_red.py
"""
from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text
from app.db import AsyncSessionLocal

# Datos verificados (redes / fichas públicas)
# Dirección: Del supermercado La Colonia, 2½ cuadras abajo — León
# Horario: 11:00 a.m. – 3:00 p.m.
# Tel: +505 2319 9070 · WhatsApp/IG: 8512-1494
# IG: @elcallejon_buffet · Catering desde 1990

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
                "texto": "Jugos naturales y barra lista: el complemento perfecto de tu almuerzo en El Callejón",
            },
            {
                "id": "t3-2",
                "categoria": "sabias",
                "texto": "Horario de atención: 11:00 a.m. a 3:00 p.m. · Del supermercado La Colonia, 2½ cuadras abajo",
            },
            {
                "id": "t3-3",
                "categoria": "chef",
                "texto": "Pregunta por el cóctel de la casa, cerveza bien fría y bebidas naturales al instante",
            },
            {
                "id": "t3-4",
                "categoria": "sabias",
                "texto": "También para llevar: el mismo sabor de El Callejón en tu mesa de casa · WhatsApp 8512-1494",
            },
            {
                "id": "t3-5",
                "categoria": "chef",
                "texto": "Picada para compartir y platillos de la casa: sabor nica con buena atención",
            },
        ],
        "slides": [
            {
                "id": "t3s1",
                "imagen_url": "/images/slides/slide8-barra.jpg",
                "texto_principal": "Barra de El Callejón",
                "texto_secundario": "Cócteles, cerveza y el toque de la casa",
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
                "texto_principal": "Para compartir",
                "texto_secundario": "Picada, salsas y el sabor que une la mesa",
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
                "texto_principal": "¡Bienvenidos a El Callejón!",
                "texto_secundario": "Buffet y restaurante · León, Nicaragua",
            },
            {
                "id": "t3s6",
                "imagen_url": "/images/publicidad/platillo-casa-1.jpg",
                "texto_principal": "Cada platillo cuenta una historia",
                "texto_secundario": "Ingredientes de calidad y cariño de nuestra cocina",
            },
            {
                "id": "t3s7",
                "imagen_url": "/images/slides/slide6-para-llevar.jpg",
                "texto_principal": "También para llevar",
                "texto_secundario": "Llama o escribe: 2319-9070 · 8512-1494",
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
                "texto": "Déjate conquistar por un corte jugoso con los complementos perfectos de la casa",
            },
            {
                "id": "t4-2",
                "categoria": "sabias",
                "texto": "Costilla BBQ, parrilla y asados: sabor ahumado que se recuerda en León",
            },
            {
                "id": "t4-3",
                "categoria": "chef",
                "texto": "Ven con la familia y disfruta un almuerzo diferente: variedad y buena atención",
            },
            {
                "id": "t4-4",
                "categoria": "sabias",
                "texto": "Catering y restaurante desde 1990 · Síguenos en Instagram @elcallejon_buffet",
            },
            {
                "id": "t4-5",
                "categoria": "chef",
                "texto": "Brochetas, pollo en salsa y platos generosos hechos al momento",
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
                "texto_secundario": "Cortes jugosos con sazón de León",
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
                "texto_principal": "Brochetas y parrilla",
                "texto_secundario": "Para compartir con amigos",
            },
            {
                "id": "t4s5",
                "imagen_url": "/images/publicidad/platillo-casa-3.jpg",
                "texto_principal": "Sabor nica, buena mesa",
                "texto_secundario": "Ambiente ideal para la familia",
            },
            {
                "id": "t4s6",
                "imagen_url": "/images/publicidad/mesa-compartir-1.jpg",
                "texto_principal": "Comer es un verdadero placer",
                "texto_secundario": "Almuerzos con variedad y atención",
            },
            {
                "id": "t4s7",
                "imagen_url": "/images/slides/slide-pollo-salsa.jpg",
                "texto_principal": "Pollo en salsa",
                "texto_secundario": "Tradición de la casa en cada bocado",
            },
            {
                "id": "t4s8",
                "imagen_url": "/images/slides/slide1-buffet.jpg",
                "texto_principal": "Buffet y porciones",
                "texto_secundario": "Sabor, variedad y buena atención",
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
                "texto": "Salón VIP climatizado: ideal para reuniones de familia, amigos y celebraciones",
            },
            {
                "id": "t5-2",
                "categoria": "chef",
                "texto": "Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente",
            },
            {
                "id": "t5-3",
                "categoria": "sabias",
                "texto": "Estamos en León: del supermercado La Colonia, 2½ cuadras abajo · 11:00 a.m. – 3:00 p.m.",
            },
            {
                "id": "t5-4",
                "categoria": "chef",
                "texto": "El lugar perfecto para compartir y disfrutar en familia en El Callejón",
            },
            {
                "id": "t5-5",
                "categoria": "sabias",
                "texto": "Uno de los restaurantes más aclamados de León por su sabor y variedad",
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
                "texto_secundario": "Ambiente cómodo para disfrutar sin prisa",
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
                "texto_principal": "Compartir en familia",
                "texto_secundario": "El lugar perfecto para reunirse",
            },
            {
                "id": "t5s6",
                "imagen_url": "/images/slides/slide5-bienvenidos.jpg",
                "texto_principal": "El Callejón VIP",
                "texto_secundario": "León, Nicaragua · desde 1990",
            },
            {
                "id": "t5s7",
                "imagen_url": "/images/slides/slide7-familia.jpg",
                "texto_principal": "Como en casa",
                "texto_secundario": "Donde cada plato se siente especial",
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
                "texto": "Cada platillo tiene una historia: calidad, sabor auténtico y el cariño de nuestra cocina",
            },
            {
                "id": "t6-2",
                "categoria": "sabias",
                "texto": "Pescado fresco, pollo en salsa y costilla BBQ: lo mejor del menú en el salón VIP",
            },
            {
                "id": "t6-3",
                "categoria": "chef",
                "texto": "Pregunta por las especialidades del día y el buffet de El Callejón",
            },
            {
                "id": "t6-4",
                "categoria": "sabias",
                "texto": "Catering desde 1990 · Restaurante El Callejón · León · @elcallejon_buffet",
            },
            {
                "id": "t6-5",
                "categoria": "chef",
                "texto": "Una experiencia llena de sabor nica: almuerzos que querrás repetir",
            },
        ],
        "slides": [
            {
                "id": "t6s1",
                "imagen_url": "/images/slides/slide-pescado.jpg",
                "texto_principal": "Pescado fresco",
                "texto_secundario": "Preparado al momento, aquí o para llevar",
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
                "texto_secundario": "El favorito que se pide una y otra vez",
            },
            {
                "id": "t6s4",
                "imagen_url": "/images/publicidad/platillo-casa-2.jpg",
                "texto_principal": "Cada platillo cuenta una historia de sabor",
                "texto_secundario": "Buffet y Restaurante El Callejón",
            },
            {
                "id": "t6s5",
                "imagen_url": "/images/slides/slide-platos-mixtos.jpg",
                "texto_principal": "Variedad VIP",
                "texto_secundario": "Para todos los gustos en la mesa",
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
                "texto_principal": "El Callejón · León",
                "texto_secundario": "La Colonia, 2½ cuadras abajo · 11 a.m. – 3 p.m.",
            },
            {
                "id": "t6s8",
                "imagen_url": "/images/slides/slide-camarones.jpg",
                "texto_principal": "Mariscos de la casa",
                "texto_secundario": "Sabor que enamora",
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
    print("Campañas enriquecidas con datos de redes OK (TV3–TV6)")


if __name__ == "__main__":
    asyncio.run(main())
