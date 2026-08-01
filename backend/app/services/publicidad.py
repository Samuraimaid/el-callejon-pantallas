"""Campañas publicitarias por zona — slides + mensajes dinámicos."""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.text_encoding import fix_mojibake, fix_obj_strings
from app.ws_manager import (
    CHANNEL_ADMIN,
    CHANNEL_ALL,
    CHANNEL_PANTALLAS,
    evt_publicidad,
    ws_manager,
)

# TVs #3–#6: campañas independientes. Aliases legacy → TV3 / TV5.
ZONAS = frozenset({"TV3", "TV4", "TV5", "TV6", "BARRA_BEBIDAS", "SALON_VIP"})
ZONAS_ACTIVAS = frozenset({"TV3", "TV4", "TV5", "TV6"})

EFECTOS = frozenset(
    {
        "zoom-in",
        "fade",
        "slide-left",
        "slide-right",
        "slide-up",
        "giro-3d",
        "persiana",
        "scale-soft",
        "blur",
        "flip-h",
    }
)

TAMANOS = frozenset({"pequeno", "mediano", "grande"})
CATEGORIAS_MSG = frozenset({"chef", "sabias"})


def normalize_zona(zona: str) -> str:
    z = (zona or "").strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        # Nuevas pantallas independientes
        "TV3": "TV3",
        "TV4": "TV4",
        "TV5": "TV5",
        "TV6": "TV6",
        "3": "TV3",
        "4": "TV4",
        "5": "TV5",
        "6": "TV6",
        "PANTALLA_3": "TV3",
        "PANTALLA_4": "TV4",
        "PANTALLA_5": "TV5",
        "PANTALLA_6": "TV6",
        # Legacy: Barra → TV3, VIP → TV5 (siguen existiendo filas legacy)
        "BARRA": "TV3",
        "BEBIDAS": "TV3",
        "BARRA_BEBIDAS": "TV3",
        "VIP": "TV5",
        "SALON": "TV5",
        "SALON_VIP": "TV5",
    }
    z = aliases.get(z, z)
    if z not in ZONAS_ACTIVAS:
        raise HTTPException(
            400,
            f"Zona inválida. Use: {', '.join(sorted(ZONAS_ACTIVAS))} "
            f"(aliases: barra→TV3, vip→TV5)",
        )
    return z


def _parse_json_list(raw: Any) -> list:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return []
    return list(raw or []) if isinstance(raw, list) else []


def _clean_mensajes(items: list[dict] | None) -> list[dict]:
    clean: list[dict] = []
    if not items:
        return clean
    for m in items:
        if not isinstance(m, dict):
            continue
        texto = fix_mojibake((m.get("texto") or "").strip())
        if not texto:
            continue
        cat = (m.get("categoria") or "chef").strip().lower()
        if cat not in CATEGORIAS_MSG:
            cat = "chef"
        mid = m.get("id") or str(uuid.uuid4())[:8]
        clean.append({"id": str(mid), "categoria": cat, "texto": texto[:280]})
    return clean


def _map_row(row: Any) -> dict[str, Any]:
    slides = fix_obj_strings(_parse_json_list(row["slides"]))
    mensajes = fix_obj_strings(_parse_json_list(row.get("mensajes")))
    return {
        "id": str(row["id"]),
        "zona": row["zona"] if isinstance(row["zona"], str) else str(row["zona"]),
        "activo": bool(row["activo"]),
        "duracion_slide": int(row["duracion_slide"]),
        "efecto_visual": str(row["efecto_visual"] or "fade"),
        "mostrar_logo": bool(row.get("mostrar_logo", True)),
        "tamano_fuente": str(row.get("tamano_fuente") or "mediano"),
        "efectos_aleatorios": bool(row.get("efectos_aleatorios", False)),
        "mostrar_mensajes": bool(row.get("mostrar_mensajes", True)),
        "duracion_mensaje": int(row.get("duracion_mensaje") or 9000),
        "mensajes": mensajes,
        "slides": slides,
        "actualizado_en": (
            row["actualizado_en"].isoformat() if row.get("actualizado_en") else None
        ),
    }


async def get_campana(db: AsyncSession, zona: str) -> dict[str, Any]:
    zona = normalize_zona(zona)
    result = await db.execute(
        text(
            """
            SELECT id, zona::text AS zona, activo, duracion_slide,
                   efecto_visual::text AS efecto_visual, slides, actualizado_en,
                   COALESCE(mostrar_logo, TRUE) AS mostrar_logo,
                   COALESCE(tamano_fuente, 'mediano') AS tamano_fuente,
                   COALESCE(efectos_aleatorios, FALSE) AS efectos_aleatorios,
                   COALESCE(mostrar_mensajes, TRUE) AS mostrar_mensajes,
                   COALESCE(duracion_mensaje, 9000) AS duracion_mensaje,
                   COALESCE(mensajes, '[]'::jsonb) AS mensajes
            FROM campanas_publicidad
            WHERE zona = CAST(:zona AS zona_publicidad)
            LIMIT 1
            """
        ),
        {"zona": zona},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, f"Campaña no encontrada para zona {zona}")
    return _map_row(row)


async def update_campana(
    db: AsyncSession,
    zona: str,
    *,
    activo: bool | None = None,
    duracion_slide: int | None = None,
    efecto_visual: str | None = None,
    slides: list[dict] | None = None,
    mostrar_logo: bool | None = None,
    tamano_fuente: str | None = None,
    efectos_aleatorios: bool | None = None,
    mostrar_mensajes: bool | None = None,
    duracion_mensaje: int | None = None,
    mensajes: list[dict] | None = None,
) -> dict[str, Any]:
    zona = normalize_zona(zona)
    current = await get_campana(db, zona)

    if duracion_slide is not None:
        if duracion_slide < 2000 or duracion_slide > 60000:
            raise HTTPException(400, "duracion_slide debe estar entre 2000 y 60000 ms")
    if duracion_mensaje is not None:
        if duracion_mensaje < 3000 or duracion_mensaje > 60000:
            raise HTTPException(400, "duracion_mensaje debe estar entre 3000 y 60000 ms")
    if efecto_visual is not None and efecto_visual not in EFECTOS:
        raise HTTPException(
            400,
            f"efecto_visual inválido. Use: {', '.join(sorted(EFECTOS))}",
        )
    if tamano_fuente is not None and tamano_fuente not in TAMANOS:
        raise HTTPException(400, "tamano_fuente: pequeno | mediano | grande")

    new_activo = current["activo"] if activo is None else bool(activo)
    new_dur = current["duracion_slide"] if duracion_slide is None else int(duracion_slide)
    new_ef = current["efecto_visual"] if efecto_visual is None else efecto_visual
    new_slides = current["slides"] if slides is None else slides
    new_logo = current["mostrar_logo"] if mostrar_logo is None else bool(mostrar_logo)
    new_font = current["tamano_fuente"] if tamano_fuente is None else tamano_fuente
    new_rand = (
        current["efectos_aleatorios"]
        if efectos_aleatorios is None
        else bool(efectos_aleatorios)
    )
    new_show_msg = (
        current.get("mostrar_mensajes", True)
        if mostrar_mensajes is None
        else bool(mostrar_mensajes)
    )
    new_msg_dur = (
        current.get("duracion_mensaje", 9000)
        if duracion_mensaje is None
        else int(duracion_mensaje)
    )
    new_mensajes = (
        current.get("mensajes") if mensajes is None else _clean_mensajes(mensajes)
    )

    clean_slides: list[dict] = []
    for s in new_slides or []:
        if not isinstance(s, dict):
            continue
        sid = s.get("id") or str(uuid.uuid4())[:8]
        video_url = str(s.get("video_url") or "").strip()
        imagen_url = str(s.get("imagen_url") or s.get("url") or "").strip()
        media_tipo = str(s.get("media_tipo") or "").lower().strip()
        # Inferir tipo si el cliente no lo mandó (o llegó vacío por schemas viejos)
        if media_tipo not in ("image", "video"):
            media_tipo = "video" if video_url else "image"
        if media_tipo == "video" and not video_url and imagen_url.lower().endswith(
            (".mp4", ".webm", ".ogg")
        ):
            video_url = imagen_url
            imagen_url = ""
        anim = str(s.get("animacion_texto") or "fade-in-up").lower()
        if anim not in (
            "none",
            "fade-in-up",
            "fade",
            "bounce",
            "marquee",
            "slide-left",
            "zoom",
        ):
            anim = "fade-in-up"
        tam = str(s.get("tamano_texto") or s.get("tamano_fuente") or "mediano").lower()
        if tam not in ("pequeno", "mediano", "grande"):
            tam = "mediano"
        clean_slides.append(
            {
                "id": str(sid),
                "media_tipo": media_tipo,
                "imagen_url": imagen_url,
                "video_url": video_url,
                "texto_principal": fix_mojibake(
                    s.get("texto_principal") or s.get("titulo") or ""
                ),
                "texto_secundario": fix_mojibake(
                    s.get("texto_secundario") or s.get("subtitulo") or ""
                ),
                "animacion_texto": anim,
                "tamano_texto": tam,
            }
        )

    if mensajes is None:
        new_mensajes = _clean_mensajes(new_mensajes or [])

    await db.execute(
        text(
            """
            UPDATE campanas_publicidad
            SET activo = :activo,
                duracion_slide = :duracion,
                efecto_visual = :efecto,
                slides = CAST(:slides AS jsonb),
                mostrar_logo = :mostrar_logo,
                tamano_fuente = :tamano_fuente,
                efectos_aleatorios = :efectos_aleatorios,
                mostrar_mensajes = :mostrar_mensajes,
                duracion_mensaje = :duracion_mensaje,
                mensajes = CAST(:mensajes AS jsonb),
                actualizado_en = NOW()
            WHERE zona = CAST(:zona AS zona_publicidad)
            """
        ),
        {
            "activo": new_activo,
            "duracion": new_dur,
            "efecto": new_ef,
            "slides": json.dumps(clean_slides, ensure_ascii=False),
            "mostrar_logo": new_logo,
            "tamano_fuente": new_font,
            "efectos_aleatorios": new_rand,
            "mostrar_mensajes": new_show_msg,
            "duracion_mensaje": new_msg_dur,
            "mensajes": json.dumps(new_mensajes, ensure_ascii=False),
            "zona": zona,
        },
    )
    await db.commit()
    updated = await get_campana(db, zona)
    await _broadcast(zona, updated)
    return updated


async def add_slide_image(
    db: AsyncSession,
    zona: str,
    upload: UploadFile,
    *,
    texto_principal: str = "",
    texto_secundario: str = "",
    animacion_texto: str = "fade-in-up",
    tamano_texto: str = "mediano",
) -> dict[str, Any]:
    """Guarda imagen o video y lo agrega a la campaña."""
    zona = normalize_zona(zona)
    ctype = (upload.content_type or "").lower()
    is_video = ctype.startswith("video/")
    is_image = ctype.startswith("image/")
    if not is_video and not is_image:
        raise HTTPException(400, "El archivo debe ser imagen o video (mp4/webm)")

    raw = await upload.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")
    max_bytes = 80 * 1024 * 1024 if is_video else 12 * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(400, "Archivo demasiado grande")

    settings = get_settings()
    slide_id = uuid.uuid4().hex[:10]
    media_tipo = "video" if is_video else "image"
    imagen_url = ""
    video_url = ""

    if is_video:
        import asyncio

        from app.services.video_process import transcode_to_1080p, videos_dir

        vdir = videos_dir()
        raw_path = vdir / f"raw-{zona.lower()}-{slide_id}.bin"
        out_path = vdir / f"pub-{zona.lower()}-{slide_id}.mp4"
        raw_path.write_bytes(raw)
        try:
            # No bloquear el event loop (heartbeats/WS de las TVs)
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None, lambda: transcode_to_1080p(raw_path, out_path)
            )
        finally:
            try:
                if raw_path.is_file():
                    raw_path.unlink()
            except OSError:
                pass
        video_url = f"/images/videos/{out_path.name}"
    else:
        import asyncio
        from io import BytesIO

        slides_dir = Path(settings.image_root) / "slides"
        slides_dir.mkdir(parents=True, exist_ok=True)

        def _save_jpeg() -> str:
            from PIL import Image

            img = Image.open(BytesIO(raw)).convert("RGB")
            max_side = 1600
            w, h = img.size
            scale = min(1.0, max_side / max(w, h))
            if scale < 1.0:
                img = img.resize(
                    (int(w * scale), int(h * scale)), Image.Resampling.LANCZOS
                )
            fname = f"pub-{zona.lower()}-{slide_id}.jpg"
            dest = slides_dir / fname
            img.save(dest, format="JPEG", quality=88, optimize=True)
            return f"/images/slides/{fname}"

        loop = asyncio.get_running_loop()
        imagen_url = await loop.run_in_executor(None, _save_jpeg)

    anim = (animacion_texto or "fade-in-up").lower()
    if anim not in ("none", "fade-in-up", "fade", "bounce", "marquee", "slide-left", "zoom"):
        anim = "fade-in-up"
    tam = (tamano_texto or "mediano").lower()
    if tam not in ("pequeno", "mediano", "grande"):
        tam = "mediano"

    campana = await get_campana(db, zona)
    slides = list(campana["slides"])
    slides.append(
        {
            "id": slide_id,
            "media_tipo": media_tipo,
            "imagen_url": imagen_url,
            "video_url": video_url,
            "texto_principal": fix_mojibake(texto_principal or "El Callejón"),
            "texto_secundario": fix_mojibake(texto_secundario or "León, Nicaragua"),
            "animacion_texto": anim,
            "tamano_texto": tam,
        }
    )
    updated = await update_campana(db, zona, slides=slides)
    return {
        "ok": True,
        "slide_id": slide_id,
        "media_tipo": media_tipo,
        "imagen_url": imagen_url,
        "video_url": video_url,
        "campana": updated,
    }


async def _broadcast(zona: str, campana: dict[str, Any]) -> None:
    payload = evt_publicidad(zona=zona, campana=campana)
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)
