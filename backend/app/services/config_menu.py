"""Configuración completa del menú board + promos (TV #1 / #2 y publicidad)."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

CLAVE = "menu_board"

_HERO_COMIDAS = "Men\u00fa del d\u00eda"  # Menú del día

DEFAULT_SIDE = {
    "leftTitle": "",
    "rightTitle": "",
    "showTitles": False,
    "showSubtitles": False,
    "leftMaxCards": 5,
    "rightMaxCards": 5,
    "heroTitle": _HERO_COMIDAS,
    "heroIntervalMs": 5000,
    "showClock": False,
    "showMarquee": True,
    "showLogo": True,
}

DEFAULT_LAYOUT = {
    "logoSizePx": 110,  # alto en px; el PNG ya está recortado al óvalo
    "logoAlign": "left",  # left | center
    "logoOutlinePx": 2,  # contorno blanco alrededor del logo (0 = sin contorno)
    "textOutlinePx": 1.5,  # contorno de textos en tarjetas/hero
    "marqueeIntervalMs": 5200,
    "showFicoshaOnPublicidad": True,
    "ficoshaCorto": "Ficosha · 35% de descuento en tu cuenta · sin m\u00ednimo",
    "ficoshaTag": "Alianza Ficosha",
    # Tipografías y escala de textos en Smart TVs
    "fontScale": 100,  # Multiplicador global (70% - 160%)
    "cardNameSizePx": 18,  # Nombre de platillo en tarjeta lateral
    "cardPriceSizePx": 22,  # Precio en tarjeta lateral
    "cardNumSizePx": 26,  # Número (#1) en tarjeta lateral
    "heroNameSizePx": 38,  # Nombre en hero central rotativo
    "heroPriceSizePx": 38,  # Precio en hero central
    "heroNumSizePx": 68,  # Número (#1) gigante en hero
    "heroBadgeSizePx": 13,  # Etiqueta Menú del día / Promoción
    "clockSizePx": 30,  # Reloj digital superior
    "marqueeSizePx": 17,  # Texto marquesina superior
    "colTitleSizePx": 24,  # Título de sección/columna
}

# Promos por defecto (editables en el panel)
DEFAULT_PROMOS: list[dict[str, Any]] = [
    {
        "id": "bienvenida",
        "tag": "Bienvenidos",
        "icon": "✨",
        "corto": "¡Bienvenidos a El Callejón! · Sabor de León desde 1990",
        "activo": True,
        "dias": None,  # todos los días
        "enMarquesina": True,
        "enPublicidad": False,
    },
    {
        "id": "ficosha",
        "tag": "Ficosha",
        "icon": "💳",
        "corto": "Ficosha · 35% de descuento en tu cuenta · sin m\u00ednimo",
        "activo": True,
        "dias": None,
        "enMarquesina": True,
        "enPublicidad": True,
    },
    {
        "id": "familia",
        "tag": "Familia",
        "icon": "🍽️",
        "corto": "Buffet y platos de la casa · ideales para la familia",
        "activo": True,
        "dias": None,
        "enMarquesina": True,
        "enPublicidad": False,
    },
    {
        "id": "martes-canelones",
        "tag": "Martes",
        "icon": "🍝",
        "corto": "Martes · Canelones 2×1",
        "activo": True,
        "dias": [2],  # martes
        "enMarquesina": True,
        "enPublicidad": False,
    },
    {
        "id": "martes-estudiantes",
        "tag": "Estudiantes",
        "icon": "🎓",
        "corto": "Martes · Descuento para estudiantes de León",
        "activo": True,
        "dias": [2],
        "enMarquesina": True,
        "enPublicidad": False,
    },
    {
        "id": "jueves-buffet",
        "tag": "Jueves",
        "icon": "🔥",
        "corto": "Jueves · Combos especiales en el buffet",
        "activo": True,
        "dias": [4],  # jueves
        "enMarquesina": True,
        "enPublicidad": False,
    },
]

DEFAULTS: dict[str, Any] = {
    "comidas": {
        **DEFAULT_SIDE,
        "leftMaxCards": 5,
        "rightMaxCards": 5,
        "heroTitle": _HERO_COMIDAS,
        "showClock": True,
        "showMarquee": True,
        "showLogo": True,
    },
    "complementos": {
        **DEFAULT_SIDE,
        "leftMaxCards": 6,
        "rightMaxCards": 6,
        "heroTitle": "Complementos",
        "showClock": False,
        "showMarquee": True,
        "showLogo": True,
    },
    "layout": deepcopy(DEFAULT_LAYOUT),
    "promos": deepcopy(DEFAULT_PROMOS),
}


def _clamp_int(v: Any, lo: int, hi: int, default: int) -> int:
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _fix_hero_title(raw: Any) -> str:
    t = str(raw or "").strip()[:40]
    if not t:
        return _HERO_COMIDAS
    if "??" in t or "MenÃ" in t or "MEN??" in t.upper():
        return _HERO_COMIDAS
    if "?" in t and "menu" in t.lower().replace("ú", "u").replace("í", "i"):
        return _HERO_COMIDAS
    return t


def _clean_side(raw: dict | None, fallback: dict) -> dict[str, Any]:
    src = raw if isinstance(raw, dict) else {}
    fb = fallback or DEFAULT_SIDE
    return {
        "leftTitle": str(src.get("leftTitle", fb.get("leftTitle", "")) or "")[:40],
        "rightTitle": str(src.get("rightTitle", fb.get("rightTitle", "")) or "")[:40],
        "showTitles": bool(src.get("showTitles", fb.get("showTitles", False))),
        "showSubtitles": bool(
            src.get("showSubtitles", fb.get("showSubtitles", False))
        ),
        "leftMaxCards": _clamp_int(
            src.get("leftMaxCards", fb.get("leftMaxCards")), 3, 12, 5
        ),
        "rightMaxCards": _clamp_int(
            src.get("rightMaxCards", fb.get("rightMaxCards")), 3, 12, 5
        ),
        "heroTitle": _fix_hero_title(
            src.get("heroTitle", fb.get("heroTitle", ""))
        ),
        "heroIntervalMs": _clamp_int(
            src.get("heroIntervalMs", fb.get("heroIntervalMs")), 3000, 20000, 5000
        ),
        "showClock": bool(src.get("showClock", fb.get("showClock", False))),
        "showMarquee": bool(src.get("showMarquee", fb.get("showMarquee", True))),
        "showLogo": bool(src.get("showLogo", fb.get("showLogo", True))),
    }


def _clean_layout(raw: Any) -> dict[str, Any]:
    src = raw if isinstance(raw, dict) else {}
    fb = DEFAULT_LAYOUT
    align = str(src.get("logoAlign", fb["logoAlign"]) or "left").lower()
    if align not in ("left", "center"):
        align = "left"
    return {
        "logoSizePx": _clamp_int(
            src.get("logoSizePx", fb["logoSizePx"]), 48, 160, 96
        ),
        "logoAlign": align,
        "logoOutlinePx": _clamp_int(
            src.get("logoOutlinePx", fb.get("logoOutlinePx", 2)), 0, 12, 2
        ),
        "textOutlinePx": float(
            max(
                0.0,
                min(
                    6.0,
                    float(src.get("textOutlinePx", fb.get("textOutlinePx", 1.5)) or 1.5),
                ),
            )
        ),
        "marqueeIntervalMs": _clamp_int(
            src.get("marqueeIntervalMs", fb["marqueeIntervalMs"]), 3000, 20000, 5200
        ),
        "showFicoshaOnPublicidad": bool(
            src.get("showFicoshaOnPublicidad", fb["showFicoshaOnPublicidad"])
        ),
        "ficoshaCorto": str(
            src.get("ficoshaCorto", fb["ficoshaCorto"]) or fb["ficoshaCorto"]
        )[:120],
        "ficoshaTag": str(
            src.get("ficoshaTag", fb["ficoshaTag"]) or fb["ficoshaTag"]
        )[:40],
        # Tipografías y escala de textos en Smart TVs
        "fontScale": _clamp_int(
            src.get("fontScale", fb.get("fontScale", 100)), 70, 160, 100
        ),
        "cardNameSizePx": _clamp_int(
            src.get("cardNameSizePx", fb.get("cardNameSizePx", 18)), 12, 36, 18
        ),
        "cardPriceSizePx": _clamp_int(
            src.get("cardPriceSizePx", fb.get("cardPriceSizePx", 22)), 14, 40, 22
        ),
        "cardNumSizePx": _clamp_int(
            src.get("cardNumSizePx", fb.get("cardNumSizePx", 26)), 16, 48, 26
        ),
        "heroNameSizePx": _clamp_int(
            src.get("heroNameSizePx", fb.get("heroNameSizePx", 38)), 24, 68, 38
        ),
        "heroPriceSizePx": _clamp_int(
            src.get("heroPriceSizePx", fb.get("heroPriceSizePx", 38)), 24, 68, 38
        ),
        "heroNumSizePx": _clamp_int(
            src.get("heroNumSizePx", fb.get("heroNumSizePx", 68)), 40, 100, 68
        ),
        "heroBadgeSizePx": _clamp_int(
            src.get("heroBadgeSizePx", fb.get("heroBadgeSizePx", 13)), 10, 24, 13
        ),
        "clockSizePx": _clamp_int(
            src.get("clockSizePx", fb.get("clockSizePx", 30)), 18, 52, 30
        ),
        "marqueeSizePx": _clamp_int(
            src.get("marqueeSizePx", fb.get("marqueeSizePx", 17)), 12, 30, 17
        ),
        "colTitleSizePx": _clamp_int(
            src.get("colTitleSizePx", fb.get("colTitleSizePx", 24)), 16, 40, 24
        ),
    }


def _clean_promo(raw: Any, idx: int) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    pid = str(raw.get("id") or f"promo-{idx}")[:40]
    corto = str(raw.get("corto") or "").strip()[:160]
    if not corto:
        return None
    dias = raw.get("dias")
    if dias is not None:
        if not isinstance(dias, list):
            dias = None
        else:
            cleaned = []
            for d in dias:
                try:
                    n = int(d)
                except (TypeError, ValueError):
                    continue
                if 0 <= n <= 6:
                    cleaned.append(n)
            dias = cleaned if cleaned else None
    return {
        "id": pid,
        "tag": str(raw.get("tag") or "Promo")[:24],
        "icon": str(raw.get("icon") or "✨")[:8],
        "corto": corto,
        "activo": bool(raw.get("activo", True)),
        "dias": dias,
        "enMarquesina": bool(raw.get("enMarquesina", True)),
        "enPublicidad": bool(raw.get("enPublicidad", False)),
    }


def _clean_promos(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list) or not raw:
        return deepcopy(DEFAULT_PROMOS)
    out: list[dict[str, Any]] = []
    for i, item in enumerate(raw):
        p = _clean_promo(item, i)
        if p:
            out.append(p)
    return out or deepcopy(DEFAULT_PROMOS)


def normalize_config(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    return {
        "comidas": _clean_side(data.get("comidas"), DEFAULTS["comidas"]),
        "complementos": _clean_side(
            data.get("complementos"), DEFAULTS["complementos"]
        ),
        "layout": _clean_layout(data.get("layout")),
        "promos": _clean_promos(data.get("promos")),
    }


async def get_menu_board_config(db: AsyncSession) -> dict[str, Any]:
    try:
        row = (
            await db.execute(
                text(
                    """
                    SELECT valor
                    FROM config_sistema
                    WHERE clave = :clave
                    """
                ),
                {"clave": CLAVE},
            )
        ).mappings().first()
    except Exception:
        return deepcopy(DEFAULTS)

    if not row:
        return deepcopy(DEFAULTS)

    valor = row["valor"]
    if isinstance(valor, str):
        try:
            valor = json.loads(valor)
        except json.JSONDecodeError:
            valor = {}
    return normalize_config(valor)


async def save_menu_board_config(
    db: AsyncSession, body: dict[str, Any]
) -> dict[str, Any]:
    clean = normalize_config(body)
    try:
        await db.execute(
            text(
                """
                INSERT INTO config_sistema (clave, valor, actualizado_en)
                VALUES (:clave, CAST(:valor AS jsonb), NOW())
                ON CONFLICT (clave) DO UPDATE
                SET valor = CAST(:valor AS jsonb),
                    actualizado_en = NOW()
                """
            ),
            {"clave": CLAVE, "valor": json.dumps(clean, ensure_ascii=False)},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f"No se pudo guardar la configuración: {exc}") from exc

    payload = {"t": "cfg", "k": CLAVE, "v": clean}
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)
    return clean
