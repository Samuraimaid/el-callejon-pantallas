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
        "google_maps_embed_url": "https://maps.google.com/maps?cid=9352514101869817184&output=embed",
        "waze_url": "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon",
        "facebook_url": "https://www.facebook.com/search/top?q=Buffet%20y%20Restaurante%20El%20Callej%C3%B3n",
        "logo_url": "/images/logo_callejon_catalog.jpg",
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
            "id": "variado-tipico",
            "nombre": "Variado Típico",
            "categoria": "Especialidades",
            "precio_nio": 450.0,
            "precio_usd": 12.25,
            "descripcion": "Banquete nicaragüense completo: carnes asadas, gallo pinto criollo, queso frito, tajadas crujientes y ensalada.",
            "imagen": "/images/platillos/asados-casa-card.jpg",
            "destacado": True,
        },
        {
            "id": "cordon-bleu",
            "nombre": "Cordon Bleu de Pollo",
            "categoria": "Platos Fuertes",
            "precio_nio": 180.0,
            "precio_usd": 5.0,
            "descripcion": "Pechuga empanizada rellena de jamón y queso derretido, con guarniciones de la casa.",
            "imagen": "/images/platillos/cordon-bleu-card.jpg",
            "destacado": True,
        },
        {
            "id": "canelones-carne",
            "nombre": "Canelones de Carne",
            "categoria": "Especialidades",
            "precio_nio": 150.0,
            "precio_usd": 4.10,
            "descripcion": "Receta tradicional de la casa rellenos de carne sazonada y gratinados con salsa especial.",
            "imagen": "/images/platillos/canelones-card.jpg",
            "destacado": True,
        },
        {
            "id": "camarones-ajillo",
            "nombre": "Camarones al Ajillo",
            "categoria": "Mariscos",
            "precio_nio": 220.0,
            "precio_usd": 6.0,
            "descripcion": "Camarones frescos salteados al ajillo con mantequilla dorada, arroz y tostones.",
            "imagen": "/images/platillos/camarones-ajillo-card.jpg",
            "destacado": True,
        },
        {
            "id": "costilla-bbq",
            "nombre": "Costilla BBQ a la Parrilla",
            "categoria": "Parrilladas",
            "precio_nio": 200.0,
            "precio_usd": 5.50,
            "descripcion": "Costillas tiernas glaseadas con salsa barbacoa de la casa y papas fritas doradas.",
            "imagen": "/images/platillos/costilla-bbq-card.jpg",
            "destacado": True,
        },
        {
            "id": "desayuno-tradicional",
            "nombre": "Desayuno Tradicional Nica",
            "categoria": "Desayunos",
            "precio_nio": 150.0,
            "precio_usd": 4.10,
            "descripcion": "Huevos al gusto, gallo pinto bien frito, tajada de queso frito, maduro y tortillas calientes.",
            "imagen": "/images/platillos/PLT-POLLO-PLAN-card.jpg",
            "destacado": False,
        },
        {
            "id": "pancakes",
            "nombre": "Pancakes con Frutas 🥞",
            "categoria": "Desayunos",
            "precio_nio": 175.0,
            "precio_usd": 4.75,
            "descripcion": "Torre de panqueques esponjosos con miel de maple, fresas frescas y mantequilla.",
            "imagen": "/images/platillos/PLT-CANELON-card.jpg",
            "destacado": False,
        },
        {
            "id": "pescado-curry",
            "nombre": "Pescado en Salsa Curry",
            "categoria": "Mariscos",
            "precio_nio": 310.0,
            "precio_usd": 8.50,
            "descripcion": "Filete tierno bañado en salsa curry aromatizada con hierbas, acompañado de arroz y puré de papas.",
            "imagen": "/images/platillos/pescado-frito-card.jpg",
            "destacado": True,
        },
        {
            "id": "cacao-natural",
            "nombre": "Cacao Nica Tradicional",
            "categoria": "Bebidas",
            "precio_nio": 35.0,
            "precio_usd": 1.0,
            "descripcion": "Bebida típica elaborada con granos de cacao seleccionados, leche fresca y canela bien fría.",
            "imagen": "/images/publicidad/picada-fritura.jpg",
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
