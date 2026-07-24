"""Perfiles de campaña y plantillas de texto editables."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.text_encoding import fix_mojibake, fix_obj_strings

ZONAS = ("TV3", "TV4", "TV5", "TV6")


def _parse_json(raw: Any, default: Any):
    if raw is None:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return default
    return default


def _map_perfil(row: Any) -> dict[str, Any]:
    return fix_obj_strings(
        {
            "id": str(row["id"]),
            "clave": row["clave"],
            "nombre": row["nombre"],
            "tipo": row["tipo"],
            "descripcion": row.get("descripcion") or "",
            "editable": bool(row.get("editable", True)),
            "modo_evento": bool(row.get("modo_evento", False)),
            "zonas": _parse_json(row.get("zonas"), list(ZONAS)),
            "config": _parse_json(row.get("config"), {}),
            "plantillas": _parse_json(row.get("plantillas"), {}),
            "mensajes": _parse_json(row.get("mensajes"), {}),
            "activo": bool(row.get("activo", True)),
            "orden": int(row.get("orden") or 0),
            "actualizado_en": (
                row["actualizado_en"].isoformat()
                if row.get("actualizado_en")
                else None
            ),
        }
    )


async def list_perfiles(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT * FROM perfiles_campana
            WHERE activo = TRUE
            ORDER BY orden ASC, nombre ASC
            """
        )
    )
    return [_map_perfil(r) for r in result.mappings().all()]


async def get_perfil(db: AsyncSession, clave: str) -> dict[str, Any]:
    result = await db.execute(
        text("SELECT * FROM perfiles_campana WHERE clave = :c LIMIT 1"),
        {"c": clave},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, f"Perfil no encontrado: {clave}")
    return _map_perfil(row)


async def update_perfil(
    db: AsyncSession,
    clave: str,
    *,
    nombre: str | None = None,
    descripcion: str | None = None,
    zonas: list[str] | None = None,
    plantillas: dict | None = None,
    mensajes: dict | None = None,
    config: dict | None = None,
    modo_evento: bool | None = None,
    editable: bool | None = None,
) -> dict[str, Any]:
    current = await get_perfil(db, clave)
    if not current.get("editable") and editable is not False:
        # still allow plantillas edit on all profiles (user asked editable templates)
        pass

    new_nombre = fix_mojibake(nombre if nombre is not None else current["nombre"])
    new_desc = fix_mojibake(
        descripcion if descripcion is not None else current["descripcion"]
    )
    new_zonas = zonas if zonas is not None else current["zonas"]
    new_zonas = [z for z in new_zonas if z in ZONAS] or list(ZONAS)
    new_plant = fix_obj_strings(
        plantillas if plantillas is not None else current["plantillas"]
    )
    new_msg = fix_obj_strings(mensajes if mensajes is not None else current["mensajes"])
    new_cfg = config if config is not None else current["config"]
    new_evt = (
        bool(modo_evento) if modo_evento is not None else current["modo_evento"]
    )

    await db.execute(
        text(
            """
            UPDATE perfiles_campana
            SET nombre = :nombre,
                descripcion = :descripcion,
                zonas = CAST(:zonas AS jsonb),
                plantillas = CAST(:plantillas AS jsonb),
                mensajes = CAST(:mensajes AS jsonb),
                config = CAST(:config AS jsonb),
                modo_evento = :modo_evento,
                actualizado_en = NOW()
            WHERE clave = :clave
            """
        ),
        {
            "nombre": new_nombre,
            "descripcion": new_desc,
            "zonas": json.dumps(new_zonas, ensure_ascii=False),
            "plantillas": json.dumps(new_plant, ensure_ascii=False),
            "mensajes": json.dumps(new_msg, ensure_ascii=False),
            "config": json.dumps(new_cfg, ensure_ascii=False),
            "modo_evento": new_evt,
            "clave": clave,
        },
    )
    await db.commit()
    return await get_perfil(db, clave)


async def create_perfil(
    db: AsyncSession,
    *,
    clave: str,
    nombre: str,
    tipo: str = "custom",
    descripcion: str = "",
    plantillas: dict | None = None,
    mensajes: dict | None = None,
    zonas: list[str] | None = None,
    modo_evento: bool = False,
) -> dict[str, Any]:
    clave = (clave or "").strip().lower().replace(" ", "_")
    if not clave:
        raise HTTPException(400, "clave requerida")
    if tipo not in ("diario", "evento", "festivo", "custom"):
        tipo = "custom"
    await db.execute(
        text(
            """
            INSERT INTO perfiles_campana
                (clave, nombre, tipo, descripcion, editable, modo_evento, zonas,
                 plantillas, mensajes, orden)
            VALUES
                (:clave, :nombre, :tipo, :descripcion, TRUE, :modo_evento,
                 CAST(:zonas AS jsonb), CAST(:plantillas AS jsonb),
                 CAST(:mensajes AS jsonb), 100)
            """
        ),
        {
            "clave": clave,
            "nombre": fix_mojibake(nombre),
            "tipo": tipo,
            "descripcion": fix_mojibake(descripcion),
            "modo_evento": modo_evento,
            "zonas": json.dumps(zonas or list(ZONAS), ensure_ascii=False),
            "plantillas": json.dumps(plantillas or {}, ensure_ascii=False),
            "mensajes": json.dumps(mensajes or {}, ensure_ascii=False),
        },
    )
    await db.commit()
    return await get_perfil(db, clave)


def pick_template_pair(
    plantillas: dict, zona: str, index: int
) -> tuple[str, str]:
    """Rota plantillas de la zona; fallback genérico."""
    lista = plantillas.get(zona) or plantillas.get(zona.upper()) or []
    if not lista:
        return (
            "El Callejón",
            "Buffet-Restaurante · León, Nicaragua",
        )
    item = lista[index % len(lista)]
    if isinstance(item, dict):
        p = fix_mojibake(item.get("principal") or item.get("texto_principal") or "")
        s = fix_mojibake(item.get("secundario") or item.get("texto_secundario") or "")
        return p or "El Callejón", s or "León, Nicaragua"
    return "El Callejón", "León, Nicaragua"


async def apply_perfil_to_zonas(
    db: AsyncSession,
    clave: str,
    zonas: list[str],
    *,
    replace_slides: bool = False,
    apply_mensajes: bool = True,
) -> dict[str, Any]:
    """Aplica plantillas/mensajes del perfil a campañas de las zonas (sin borrar videos)."""
    from app.services import publicidad as pub

    perfil = await get_perfil(db, clave)
    zonas_ok = [z for z in zonas if z in ZONAS]
    if not zonas_ok:
        raise HTTPException(400, "Seleccione al menos una TV (TV3–TV6)")

    results = {}
    for zona in zonas_ok:
        campana = await pub.get_campana(db, zona)
        slides = list(campana.get("slides") or [])
        templates = perfil.get("plantillas") or {}
        pairs = templates.get(zona) or []

        if replace_slides and pairs:
            # Solo textos sobre slides existentes; no elimina media
            for i, s in enumerate(slides):
                p, sec = pick_template_pair(templates, zona, i)
                s["texto_principal"] = p
                s["texto_secundario"] = sec
        elif pairs and slides:
            for i, s in enumerate(slides):
                if not (s.get("texto_principal") or "").strip():
                    p, sec = pick_template_pair(templates, zona, i)
                    s["texto_principal"] = p
                    s["texto_secundario"] = sec

        mensajes = campana.get("mensajes") or []
        if apply_mensajes:
            pm = (perfil.get("mensajes") or {}).get(zona)
            if pm:
                mensajes = pm

        updated = await pub.update_campana(
            db,
            zona,
            slides=slides,
            mensajes=mensajes if apply_mensajes else None,
        )
        results[zona] = {
            "slides": len(updated.get("slides") or []),
            "mensajes": len(updated.get("mensajes") or []),
        }

    return {
        "ok": True,
        "perfil": clave,
        "modo_evento": perfil.get("modo_evento"),
        "zonas": results,
    }
