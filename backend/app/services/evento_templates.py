"""Plantillas de modo evento: temas, tipografía, animaciones, música e imágenes."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "cumpleanos",
        "nombre": "Cumpleaños",
        "descripcion": "Fiesta colorida para cumpleaños en el salón.",
        "icono": "🎂",
        "tema": {
            "bg_from": "#4a0e2e",
            "bg_to": "#1a050f",
            "accent": "#fbbf24",
            "text": "#fff7ed",
            "overlay": "rgba(74,14,46,0.45)",
        },
        "tipografia": {
            "titulo": "font-display",
            "titulo_size": "text-5xl md:text-7xl",
            "subtitulo": "font-sans",
            "subtitulo_size": "text-xl md:text-3xl",
            "weight": "font-bold",
        },
        "animacion": "bounce-in",
        "animacion_media": "kenburns-soft",
        "musica_url": "/audio/eventos/cumpleanos.mp3",
        "musica_loop": True,
        "duracion_slide_ms": 7000,
        "imagenes": [
            "/images/eventos/templates/cumpleanos.jpg",
            "/images/eventos/templates/cumpleanos-2.jpg",
        ],
        "textos": {
            "titulo": "¡Feliz Cumpleaños!",
            "subtitulo": "Celebramos contigo en El Callejón",
            "pie": "Mesa lista · León, Nicaragua",
        },
    },
    {
        "id": "boda",
        "nombre": "Boda / Compromiso",
        "descripcion": "Elegante y romántico para banquetes nupciales.",
        "icono": "💍",
        "tema": {
            "bg_from": "#1c1917",
            "bg_to": "#0c0a09",
            "accent": "#e7e5e4",
            "text": "#fafaf9",
            "overlay": "rgba(28,25,23,0.5)",
        },
        "tipografia": {
            "titulo": "font-display italic",
            "titulo_size": "text-5xl md:text-7xl",
            "subtitulo": "font-display",
            "subtitulo_size": "text-lg md:text-2xl",
            "weight": "font-medium",
        },
        "animacion": "fade-up",
        "animacion_media": "slow-zoom",
        "musica_url": "/audio/eventos/boda.mp3",
        "musica_loop": True,
        "duracion_slide_ms": 9000,
        "imagenes": [
            "/images/eventos/templates/boda.jpg",
            "/images/eventos/templates/boda-2.jpg",
        ],
        "textos": {
            "titulo": "Nuestra boda",
            "subtitulo": "El comienzo de una historia juntos",
            "pie": "El Callejón · León",
        },
    },
    {
        "id": "corporativo",
        "nombre": "Corporativo",
        "descripcion": "Limpio y profesional para empresas y reuniones.",
        "icono": "🏢",
        "tema": {
            "bg_from": "#0f172a",
            "bg_to": "#020617",
            "accent": "#38bdf8",
            "text": "#f1f5f9",
            "overlay": "rgba(15,23,42,0.55)",
        },
        "tipografia": {
            "titulo": "font-sans",
            "titulo_size": "text-4xl md:text-6xl",
            "subtitulo": "font-sans",
            "subtitulo_size": "text-base md:text-xl",
            "weight": "font-semibold tracking-wide",
        },
        "animacion": "slide-left",
        "animacion_media": "fade",
        "musica_url": "/audio/eventos/corporativo.mp3",
        "musica_loop": True,
        "duracion_slide_ms": 8000,
        "imagenes": [
            "/images/eventos/templates/corporativo.jpg",
            "/images/eventos/templates/corporativo-2.jpg",
        ],
        "textos": {
            "titulo": "Bienvenidos",
            "subtitulo": "Reunión corporativa · El Callejón",
            "pie": "Servicio preferente",
        },
    },
    {
        "id": "graduacion",
        "nombre": "Graduación",
        "descripcion": "Orgullo y celebración académica.",
        "icono": "🎓",
        "tema": {
            "bg_from": "#1e3a5f",
            "bg_to": "#0b1220",
            "accent": "#f59e0b",
            "text": "#fffbeb",
            "overlay": "rgba(30,58,95,0.5)",
        },
        "tipografia": {
            "titulo": "font-display",
            "titulo_size": "text-5xl md:text-7xl",
            "subtitulo": "font-sans",
            "subtitulo_size": "text-xl md:text-2xl",
            "weight": "font-bold",
        },
        "animacion": "zoom-in",
        "animacion_media": "kenburns-soft",
        "musica_url": "/audio/eventos/graduacion.mp3",
        "musica_loop": True,
        "duracion_slide_ms": 7500,
        "imagenes": [
            "/images/eventos/templates/graduacion.jpg",
        ],
        "textos": {
            "titulo": "¡Felicidades, graduado!",
            "subtitulo": "Un logro que se celebra en familia",
            "pie": "El Callejón te acompaña",
        },
    },
    {
        "id": "navidad",
        "nombre": "Navidad / Fin de año",
        "descripcion": "Cálido y festivo para cenas de temporada.",
        "icono": "🎄",
        "tema": {
            "bg_from": "#14532d",
            "bg_to": "#450a0a",
            "accent": "#fde68a",
            "text": "#fefce8",
            "overlay": "rgba(20,83,45,0.4)",
        },
        "tipografia": {
            "titulo": "font-display",
            "titulo_size": "text-5xl md:text-7xl",
            "subtitulo": "font-display italic",
            "subtitulo_size": "text-xl md:text-3xl",
            "weight": "font-bold",
        },
        "animacion": "sparkle-fade",
        "animacion_media": "slow-zoom",
        "musica_url": "/audio/eventos/navidad.mp3",
        "musica_loop": True,
        "duracion_slide_ms": 8000,
        "imagenes": [
            "/images/eventos/templates/navidad.jpg",
            "/images/eventos/templates/navidad-2.jpg",
        ],
        "textos": {
            "titulo": "Felices fiestas",
            "subtitulo": "Cena de temporada en El Callejón",
            "pie": "León · Nicaragua",
        },
    },
]


def list_templates() -> list[dict[str, Any]]:
    return deepcopy(TEMPLATES)


def get_template(template_id: str) -> dict[str, Any] | None:
    tid = (template_id or "").strip().lower()
    for t in TEMPLATES:
        if t["id"] == tid:
            return deepcopy(t)
    return None


async def get_active_template(db: AsyncSession) -> dict[str, Any] | None:
    try:
        row = (
            await db.execute(
                text(
                    """
                    SELECT valor FROM config_sistema
                    WHERE clave = 'evento_plantilla_activa' LIMIT 1
                    """
                )
            )
        ).mappings().first()
        if not row:
            return None
        raw = row["valor"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        if not isinstance(raw, dict):
            return None
        tid = raw.get("template_id")
        tpl = get_template(str(tid or ""))
        if not tpl:
            return None
        # overrides de textos del usuario
        if raw.get("textos"):
            tpl["textos"] = {**tpl.get("textos", {}), **raw["textos"]}
        tpl["activo"] = True
        tpl["musica_activa"] = raw.get("musica_activa", True)
        return tpl
    except Exception:
        return None


async def apply_template(
    db: AsyncSession,
    template_id: str,
    *,
    activar_modo_evento: bool = True,
    musica_activa: bool = True,
    textos: dict | None = None,
) -> dict[str, Any]:
    """
    Aplica plantilla: guarda config + rellena evento_media con imágenes de muestra
    + opcionalmente enciende modo evento en todas las TVs.
    """
    from app.services import pantallas as pant_svc

    tpl = get_template(template_id)
    if not tpl:
        raise ValueError(f"Plantilla desconocida: {template_id}")

    if textos:
        tpl["textos"] = {**tpl.get("textos", {}), **textos}

    payload = {
        "template_id": tpl["id"],
        "musica_activa": bool(musica_activa),
        "textos": tpl.get("textos") or {},
        "applied_at": __import__("time").time(),
    }
    await db.execute(
        text(
            """
            INSERT INTO config_sistema (clave, valor, actualizado_en)
            VALUES ('evento_plantilla_activa', CAST(:v AS jsonb), NOW())
            ON CONFLICT (clave) DO UPDATE SET
                valor = EXCLUDED.valor,
                actualizado_en = NOW()
            """
        ),
        {"v": json.dumps(payload, ensure_ascii=False)},
    )

    # Reemplazar media de evento con imágenes de la plantilla
    await db.execute(text("UPDATE evento_media SET activo = FALSE"))
    orden = 0
    for url in tpl.get("imagenes") or []:
        await db.execute(
            text(
                """
                INSERT INTO evento_media
                    (titulo, media_url, media_tipo, orientacion, activo, orden)
                VALUES
                    (:titulo, :url, 'image', 'horizontal', TRUE, :orden)
                """
            ),
            {
                "titulo": (tpl["textos"] or {}).get("titulo") or tpl["nombre"],
                "url": url,
                "orden": orden,
            },
        )
        orden += 1

    await db.commit()

    if activar_modo_evento:
        await pant_svc.apply_control(db, all_tvs=True, modo_evento=True)

    active = await get_active_template(db)
    msg = {
        "t": "evt_tpl",
        "template_id": tpl["id"],
        "template": active,
    }
    await ws_manager.publish(CHANNEL_PANTALLAS, msg)
    await ws_manager.publish(CHANNEL_ADMIN, msg)
    await ws_manager.publish(CHANNEL_ALL, msg)
    return {"ok": True, "template": active}


async def clear_active_template(db: AsyncSession) -> dict[str, Any]:
    await db.execute(
        text("DELETE FROM config_sistema WHERE clave = 'evento_plantilla_activa'")
    )
    await db.commit()
    await ws_manager.publish(CHANNEL_PANTALLAS, {"t": "evt_tpl", "template_id": None})
    await ws_manager.publish(CHANNEL_ADMIN, {"t": "evt_tpl", "template_id": None})
    return {"ok": True}
