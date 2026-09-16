"""Servicio de gestión y configuración de la Landing Page turística multilingüe.

Almacena y recupera los contenidos y secciones desde la tabla config_sistema
(clave='landing_page') en PostgreSQL Neon, con fallback a valores por defecto oficiales.
"""

from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

CLAVE_LANDING = "landing_page"

DEFAULT_LANDING_CONFIG: dict[str, Any] = {
    "info_general": {
        "nombre": "Buffet y Restaurante El Callejón",
        "nombre_corto": "El Callejón",
        "eslogan": "¡En la variedad está el sazón!",
        "anios_experiencia": 25,
        "telefono": "+505 8512 1494",
        "whatsapp": "+505 8512 1494",
        "whatsapp_raw": "50585121494",
        "email": "reservaciones.elcallejon@gmail.com",
        "direccion": "Supermercado La Colonia, 2 ½ C abajo, León 21000, Nicaragua",
        "ciudad": "León, Nicaragua",
        "horarios_texto": "Martes a Domingo: 8:00 a. m. – 3:00 p. m. (Atención a eventos privados en horario extendido)",
        "google_maps_url": "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99",
        "google_maps_embed_url": "https://maps.google.com/maps?q=12.4361505,-86.8858488+(Buffet+y+Restaurante+El+Callej%C3%B3n)&t=&z=17&ie=UTF8&iwloc=&output=embed",
        "waze_url": "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon",
        "facebook_url": "https://www.facebook.com/search/top?q=Buffet%20y%20Restaurante%20El%20Callej%C3%B3n",
        "logo_url": "/logo-el-callejon.png",
        "mostrar_precios": True,
        "descripcion_larga": (
            "Somos un negocio con más de 25 años de experiencia, siendo los pioneros en la industria "
            "de la gastronomía Leonesa estilo Buffet de alto perfil. Ofrecemos servicio de catering para "
            "cumpleaños, bodas, bautizos, despedidas de soltero y eventos corporativos, en un local acogedor "
            "climatizado y decorado con estilo."
        ),
    },
    "visibilidad_secciones": {
        "hero": True,
        "sobre_nosotros": True,
        "menu_destacado": True,
        "cotizador_eventos": True,
        "galeria": True,
        "testimonios": True,
        "ubicacion_contacto": True,
    },
    "hero": {
        "badge": "25 años de tradición gastronómica",
        "titulo": "Sabor Tradicional & Buffet de Alto Nivel",
        "subtitulo": "La mejor experiencia culinaria en León, Nicaragua. Desayunos típicos, almuerzos buffet, asados a la parrilla y el espacio ideal para tus eventos privados.",
        "imagen_fondo": "/images/slides/slide-ambiente-salon-1.jpg",
        "boton_menu_texto": "Ver Menú & Precios",
        "boton_cotizar_texto": "Cotizar Evento Privado",
        "boton_como_llegar_texto": "Cómo Llegar (Maps)",
    },
    "sobre_nosotros": {
        "titulo": "Tradición, Calidad y Calidez en el Corazón de León",
        "subtitulo": "Pioneros del estilo buffet y servicio de banquetes",
        "parrafo_1": (
            "Desde hace más de dos décadas y media, Buffet y Restaurante El Callejón ha sido el punto "
            "de encuentro preferido de familias locales, viajeros y comensales que buscan comida nicaragüense "
            "auténtica, fresca y con el toque casero que nos distingue."
        ),
        "parrafo_2": (
            "Contamos con instalaciones climatizadas, mesas amplias para compartir en familia y un salón de eventos "
            "equipado para celebrar momentos inolvidables con atención personalizada y banquete buffet."
        ),
        "destacados": [
            {"icono": "🏆", "titulo": "25+ Años", "desc": "Pioneros en buffet en León"},
            {"icono": "🥩", "titulo": "Asados & Grill", "desc": "Cortes al carbón y sazón criollo"},
            {"icono": "❄️", "titulo": "Ambiente Confortable", "desc": "Salón climatizado y música ambiental"},
            {"icono": "🎉", "titulo": "Catering Completo", "desc": "Atención a bodas, 15 años y reuniones"},
        ],
        "imagen_secundaria": "/images/publicidad/buffet-platos.jpg",
    },
    "eventos": [
        {
            "id": "bodas",
            "titulo": "Bodas & Recepciones",
            "descripcion": "Paquetes de banquete, decoración elegante, barra de bebidas y salón reservado para tu gran día.",
            "icono": "💍",
            "imagen": "/images/slides/slide-ambiente-luz-1.jpg",
        },
        {
            "id": "quinceanos",
            "titulo": "Fiestas de 15 Años",
            "descripcion": "El espacio perfecto con sonido, iluminación cálida y menús buffet variados para consentir a la quinceañera.",
            "icono": "👑",
            "imagen": "/images/slides/slide-ambiente-salon-2.jpg",
        },
        {
            "id": "cumpleanos",
            "titulo": "Cumpleaños & Aniversarios",
            "descripcion": "Celebra la vida con familiares y amigos degustando parrilladas, picadas y bebidas típicas refrescantes.",
            "icono": "🎂",
            "imagen": "/images/publicidad/mesa-compartir-1.jpg",
        },
        {
            "id": "corporativo",
            "titulo": "Reuniones & Eventos Empresariales",
            "descripcion": "Almuerzos ejecutivos, coffee breaks y conferencias en un ambiente privado y con Wi-Fi de alta velocidad.",
            "icono": "💼",
            "imagen": "/images/slides/slide-ambiente-salon-3.jpg",
        },
        {
            "id": "bautizos",
            "titulo": "Bautizos & Primeras Comuniones",
            "descripcion": "Ambiente tranquilo, acogedor y menús adaptados para niños y adultos.",
            "icono": "🕊️",
            "imagen": "/images/slides/slide-mesa-1.jpg",
        },
        {
            "id": "despedidas",
            "titulo": "Despedidas & Festejos Especiales",
            "descripcion": "Cenas con asados, cortes selectos, cerveza nacional y coctelería.",
            "icono": "🥂",
            "imagen": "/images/slides/slide8-barra.jpg",
        },
    ],
    "menu_items": [
        {
            "id": "plt-cordon",
            "codigo": "PLT-CORDON",
            "nombre": "Cordon Bleu",
            "categoria": "Especialidades",
            "precio_nio": 400.0,
            "precio_usd": 10.90,
            "descripcion": "Pechuga de pollo rellena de jamón y queso fundido, empanizada y dorada, con guarnición de la casa.",
            "imagen": "/images/platillos/cordon-bleu.jpg",
            "destacado": True,
        },
        {
            "id": "plt-canelon",
            "codigo": "PLT-CANELON",
            "nombre": "Canelones de carne",
            "categoria": "Especialidades",
            "precio_nio": 170.0,
            "precio_usd": 4.65,
            "descripcion": "Canelones horneados rellenos de carne sazonada con la receta especial de la casa y salsa gratinada.",
            "imagen": "/images/platillos/canelones.jpg",
            "destacado": True,
        },
        {
            "id": "plt-lasana",
            "codigo": "PLT-LASANA",
            "nombre": "Lasaña mixta",
            "categoria": "Especialidades",
            "precio_nio": 160.0,
            "precio_usd": 4.35,
            "descripcion": "Capas de pasta artesanal con carne, pollo, queso derretido y salsa boloñesa casera.",
            "imagen": "/images/platillos/relleno.jpg",
            "destacado": True,
        },
        {
            "id": "plt-carne-asa",
            "codigo": "PLT-CARNE-ASA",
            "nombre": "Carne asada",
            "categoria": "Carnes & Parrilla",
            "precio_nio": 190.0,
            "precio_usd": 5.20,
            "descripcion": "Jugosa carne de res marinada con sazón criollo al carbón, acompañada de gallo pinto y tajadas crujientes.",
            "imagen": "/images/platillos/carne-asada.jpg",
            "destacado": False,
        },
        {
            "id": "plt-pollo-plan",
            "codigo": "PLT-POLLO-PLAN",
            "nombre": "Pollo a la plancha",
            "categoria": "Platos Fuertes",
            "precio_nio": 160.0,
            "precio_usd": 4.35,
            "descripcion": "Filete de pechuga tierno cocinado a la plancha con hierbas aromáticas y vegetales salteados.",
            "imagen": "/images/platillos/PLT-POLLO-PLAN.jpg",
            "destacado": False,
        },
        {
            "id": "plt-chuleta",
            "codigo": "PLT-CHULETA",
            "nombre": "Chuleta de cerdo",
            "categoria": "Carnes & Parrilla",
            "precio_nio": 170.0,
            "precio_usd": 4.65,
            "descripcion": "Corte de cerdo ahumado dorado a punto con ensalada fresca y guarniciones típicas.",
            "imagen": "/images/platillos/lomo-cerdo.jpg",
            "destacado": False,
        },
        {
            "id": "plt-pescado",
            "codigo": "PLT-PESCADO",
            "nombre": "Filete de pescado",
            "categoria": "Mariscos",
            "precio_nio": 185.0,
            "precio_usd": 5.05,
            "descripcion": "Filete fresco del día empanizado crujiente o al ajillo con arroz blanco y ensalada.",
            "imagen": "/images/platillos/PLT-PESCADO.jpg",
            "destacado": False,
        },
        {
            "id": "plt-bistec",
            "codigo": "PLT-BISTEC",
            "nombre": "Bistec encebollado",
            "categoria": "Carnes & Parrilla",
            "precio_nio": 175.0,
            "precio_usd": 4.75,
            "descripcion": "Corte suave de res cocinado lentamente con abundantes aros de cebolla caramelizada, arroz y frijoles.",
            "imagen": "/images/platillos/churrasco.jpg",
            "destacado": False,
        },
        {
            "id": "plt-camarones",
            "codigo": "PLT-CAMARONES",
            "nombre": "Camarones al ajillo",
            "categoria": "Mariscos",
            "precio_nio": 220.0,
            "precio_usd": 6.00,
            "descripcion": "Generosa porción de camarones salteados en ajo dorado, mantequilla criolla y tostones de plátano.",
            "imagen": "/images/platillos/PLT-CAMARONES.jpg",
            "destacado": False,
        },
        {
            "id": "plt-costilla",
            "codigo": "PLT-COSTILLA",
            "nombre": "Costilla BBQ",
            "categoria": "Carnes & Parrilla",
            "precio_nio": 200.0,
            "precio_usd": 5.45,
            "descripcion": "Costillas tiernas y jugosas bañadas en deliciosa salsa BBQ casera, servidas con papas fritas doradas.",
            "imagen": "/images/platillos/PLT-COSTILLA.jpg",
            "destacado": False,
        },
        {
            "id": "plt-buffet-a",
            "codigo": "PLT-BUFFET-A",
            "nombre": "Buffet adulto",
            "categoria": "Buffet Libre",
            "precio_nio": 220.0,
            "precio_usd": 6.00,
            "descripcion": "Acceso ilimitado a nuestra barra de buffet diario: carnes, arroces, ensaladas, pastas y complementos.",
            "imagen": "/images/slides/slide-platos-mixtos.jpg",
            "destacado": True,
        },
        {
            "id": "plt-buffet-n",
            "codigo": "PLT-BUFFET-N",
            "nombre": "Buffet niño",
            "categoria": "Buffet Libre",
            "precio_nio": 140.0,
            "precio_usd": 3.80,
            "descripcion": "Acceso completo a la barra de buffet infantil para niños hasta 10 años.",
            "imagen": "/images/slides/slide1-buffet.jpg",
            "destacado": False,
        },
        {
            "id": "plt-verduras-salteadas",
            "codigo": "PLT-VERDURAS-SALT",
            "nombre": "Verduras Salteadas al Vapor",
            "categoria": "Verduras & Saludable",
            "precio_nio": 120.0,
            "precio_usd": 3.25,
            "descripcion": "Mezcla fresca de brócoli, coliflor, zanahorias baby, ejotes tiernos y maíz salteados en mantequilla criolla y finas hierbas.",
            "imagen": "/images/platillos/verduras-salteadas.jpg",
            "destacado": True,
        },
        {
            "id": "plt-ensalada-campesina",
            "codigo": "PLT-ENSALADA-CAMP",
            "nombre": "Ensalada Campesina con Aguacate",
            "categoria": "Verduras & Saludable",
            "precio_nio": 110.0,
            "precio_usd": 3.00,
            "descripcion": "Hojas de lechuga crujiente, tomates frescos de huerta, pepino, cebolla morada y suaves rodajas de aguacate con vinagreta artesanal.",
            "imagen": "/images/platillos/ensalada-campesina.jpg",
            "destacado": True,
        },
        {
            "id": "plt-buffet-vegetales",
            "codigo": "PLT-BUFFET-VEG",
            "nombre": "Barra Buffet de Vegetales & Legumbres",
            "categoria": "Verduras & Saludable",
            "precio_nio": 130.0,
            "precio_usd": 3.55,
            "descripcion": "Acceso a la variedad de vegetales cocidos, ensaladas frías, remolacha glaseada, chayote y aderezos caseros.",
            "imagen": "/images/publicidad/buffet-platos.jpg",
            "destacado": False,
        },
        {
            "id": "plt-ensalada-rusa",
            "codigo": "PLT-ENSALADA-RUSA",
            "nombre": "Ensalada Rusa Tradicional",
            "categoria": "Verduras & Saludable",
            "precio_nio": 115.0,
            "precio_usd": 3.15,
            "descripcion": "Papas en dados, zanahoria tierna, guisantes dulces y aderezo cremoso tradicional con el toque de la casa.",
            "imagen": "/images/platillos/ensalada-campesina.jpg",
            "destacado": False,
        },
    ],
    "galeria_fotos": [
        {"url": "/images/slides/slide-ambiente-salon-1.jpg", "titulo": "Salón Climatizado"},
        {"url": "/images/slides/slide-ambiente-luz-1.jpg", "titulo": "Ambiente Acogedor"},
        {"url": "/images/slides/slide-mesa-1.jpg", "titulo": "Mesas para Eventos"},
        {"url": "/images/publicidad/buffet-platos.jpg", "titulo": "Barra de Buffet Fresca"},
        {"url": "/images/publicidad/asados-parrilla-1.jpg", "titulo": "Asados a la Parrilla"},
        {"url": "/images/slides/slide8-barra.jpg", "titulo": "Barra de Bebidas & Cocteles"},
    ],
}


async def get_landing_config(db: AsyncSession) -> dict[str, Any]:
    """Obtiene la configuración de la Landing Page desde PostgreSQL con fallback."""
    result = await db.execute(
        text("SELECT valor FROM config_sistema WHERE clave = :c"),
        {"c": CLAVE_LANDING},
    )
    row = result.fetchone()
    if not row or not row[0]:
        return deepcopy(DEFAULT_LANDING_CONFIG)

    stored = row[0]
    if isinstance(stored, str):
        try:
            stored = json.loads(stored)
        except Exception:
            stored = {}

    merged = deepcopy(DEFAULT_LANDING_CONFIG)
    # Merge recursivo de secciones principales
    for key, val in stored.items():
        if isinstance(val, dict) and key in merged and isinstance(merged[key], dict):
            merged[key].update(val)
        else:
            merged[key] = val

    return merged


async def update_landing_config(db: AsyncSession, data: dict[str, Any]) -> dict[str, Any]:
    """Guarda la configuración actualizada en PostgreSQL."""
    # Validación básica
    if not isinstance(data, dict):
        data = {}

    current = await get_landing_config(db)
    merged = deepcopy(current)
    for k, v in data.items():
        if isinstance(v, dict) and k in merged and isinstance(merged[k], dict):
            merged[k].update(v)
        else:
            merged[k] = v

    json_str = json.dumps(merged, ensure_ascii=False)
    await db.execute(
        text(
            """
            INSERT INTO config_sistema (clave, valor, actualizado_en)
            VALUES (:c, CAST(:v AS jsonb), NOW())
            ON CONFLICT (clave) DO UPDATE SET
                valor = EXCLUDED.valor,
                actualizado_en = NOW()
            """
        ),
        {"c": CLAVE_LANDING, "v": json_str},
    )
    await db.commit()
    return merged


def list_available_images() -> list[dict[str, str]]:
    """Lista las imágenes de la biblioteca unificada para selector en backoffice."""
    settings = get_settings()
    root = Path(settings.image_root)
    # Si estamos en dev local y /app/static/images no existe, usar frontend/public/images
    if not root.exists():
        dev_root = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "images"
        if dev_root.exists():
            root = dev_root

    images: list[dict[str, str]] = []
    if not root.exists():
        return images

    subfolders = ["platillos", "slides", "publicidad", "landing", "covers"]
    valid_exts = {".jpg", ".jpeg", ".png", ".webp"}

    for sf in subfolders:
        dir_path = root / sf
        if not dir_path.exists():
            continue
        for p in dir_path.iterdir():
            if p.is_file() and p.suffix.lower() in valid_exts:
                rel_url = f"/images/{sf}/{p.name}"
                images.append({
                    "url": rel_url,
                    "nombre": p.name,
                    "categoria": sf,
                })

    return images
