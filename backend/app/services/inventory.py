"""Menú del día (productos_menu) — lógica 100% servidor + WS pantallas."""

from __future__ import annotations

import re
import unicodedata
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws_manager import (
    CHANNEL_ADMIN,
    CHANNEL_PANTALLAS,
    evt_product,
    evt_product_created,
    evt_product_deleted,
    evt_stock_zero,
    ws_manager,
)

TABLE = "productos_menu"
TIPO_ENUM = "tipo_producto_menu"

TIPOS_VALIDOS = frozenset(
    {
        "plato_preestablecido",
        "extra",
        "bebida_jugo",
        "bebida_soda",
        "licor",
        "cafe",
    }
)

TIPO_ALIASES = {
    "platillo": "plato_preestablecido",
    "platillos": "plato_preestablecido",
    "plato": "plato_preestablecido",
    "plato_preestablecido": "plato_preestablecido",
    "extra": "extra",
    "extras": "extra",
    "jugo": "bebida_jugo",
    "jugos": "bebida_jugo",
    "bebida_jugo": "bebida_jugo",
    "bebida": "bebida_soda",
    "bebidas": "bebida_soda",
    "soda": "bebida_soda",
    "bebida_soda": "bebida_soda",
    "licor": "licor",
    "licores": "licor",
    "cafe": "cafe",
    "cafes": "cafe",
    "café": "cafe",
    "cafés": "cafe",
}

PREFIX_BY_TIPO = {
    "plato_preestablecido": "PLT",
    "extra": "EXT",
    "bebida_jugo": "JUG",
    "bebida_soda": "SOD",
    "licor": "LIC",
    "cafe": "CAF",
}

UNIDAD_BY_TIPO = {
    "plato_preestablecido": "plato",
    "extra": "porcion",
    "bebida_jugo": "vaso",
    "bebida_soda": "und",
    "licor": "und",
    "cafe": "taza",
}

SELECT_COLS = f"""
    id, codigo, nombre, tipo::text AS tipo, descripcion,
    precio_unitario, stock_disponible, stock_minimo,
    COALESCE(es_ilimitado, FALSE) AS es_ilimitado,
    COALESCE(destacado, FALSE) AS destacado,
    numero_combo,
    unidad, activo, orden_display,
    dias_semana
"""


def normalize_dias_semana(raw: Any) -> list[int] | None:
    """
    null / [] / omitido → None (todos los días).
    Lista de 0–6 (domingo–sábado) como promos del menú board.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        if not s or s.lower() in ("null", "todos", "all", "none"):
            return None
        try:
            import json as _json

            raw = _json.loads(s)
        except Exception:
            return None
    if not isinstance(raw, (list, tuple)):
        return None
    cleaned: list[int] = []
    for d in raw:
        try:
            n = int(d)
        except (TypeError, ValueError):
            continue
        if 0 <= n <= 6 and n not in cleaned:
            cleaned.append(n)
    cleaned.sort()
    return cleaned if cleaned else None


def producto_visible_hoy(dias: list[int] | None, weekday: int | None = None) -> bool:
    """True si el producto debe mostrarse hoy en pantallas."""
    if dias is None or (isinstance(dias, list) and len(dias) == 0):
        return True
    if weekday is None:
        from datetime import datetime

        weekday = datetime.now().weekday()  # Python: 0=lunes … 6=domingo
        # Convertir a JS getDay(): 0=domingo … 6=sábado
        weekday = (weekday + 1) % 7
    return int(weekday) in {int(d) for d in dias}


def normalize_tipo(raw: str | None) -> str:
    key = (raw or "").strip().lower()
    tipo = TIPO_ALIASES.get(key) or TIPO_ALIASES.get(key.replace(" ", "_"))
    if not tipo or tipo not in TIPOS_VALIDOS:
        raise HTTPException(
            400,
            "categoria/tipo inválido. Use: platillo, extra, jugo, bebida, licor, cafe "
            f"(o enum: {', '.join(sorted(TIPOS_VALIDOS))})",
        )
    return tipo


def _slug_nombre(nombre: str, max_len: int = 18) -> str:
    text_n = unicodedata.normalize("NFKD", nombre or "")
    text_n = "".join(c for c in text_n if not unicodedata.combining(c))
    text_n = text_n.upper()
    text_n = re.sub(r"[^A-Z0-9]+", "-", text_n)
    text_n = text_n.strip("-")
    parts = [p for p in text_n.split("-") if p]
    if not parts:
        return "ITEM"
    stop = {"DE", "LA", "EL", "LOS", "LAS", "Y", "A", "EN", "DEL", "CON", "UN", "UNA"}
    parts = [p for p in parts if p not in stop] or parts
    slug = "-".join(parts)
    if len(slug) > max_len:
        if len(parts) >= 2:
            slug = f"{parts[0][:8]}-{parts[-1][:8]}"
        else:
            slug = parts[0][:max_len]
    return slug.strip("-") or "ITEM"


async def _codigo_disponible(db: AsyncSession, base: str) -> str:
    candidate = base[:30]
    n = 2
    while True:
        result = await db.execute(
            text(f"SELECT 1 FROM {TABLE} WHERE codigo = :c LIMIT 1"),
            {"c": candidate},
        )
        if not result.first():
            return candidate
        suffix = f"-{n}"
        candidate = f"{base[: 30 - len(suffix)]}{suffix}"
        n += 1
        if n > 999:
            raise HTTPException(500, "No se pudo generar código único")


async def generate_codigo(db: AsyncSession, tipo: str, nombre: str) -> str:
    prefix = PREFIX_BY_TIPO[tipo]
    slug = _slug_nombre(nombre)
    return await _codigo_disponible(db, f"{prefix}-{slug}")


async def get_producto(
    db: AsyncSession,
    *,
    producto_id: UUID | None = None,
    codigo: str | None = None,
) -> dict[str, Any]:
    if not producto_id and not codigo:
        raise HTTPException(400, "producto_id o codigo requerido")

    clauses = []
    params: dict[str, Any] = {}
    if producto_id:
        clauses.append("id = :id")
        params["id"] = str(producto_id)
    if codigo:
        clauses.append("codigo = :codigo")
        params["codigo"] = codigo

    result = await db.execute(
        text(
            f"""
            SELECT {SELECT_COLS}
            FROM {TABLE}
            WHERE {" OR ".join(clauses)}
            LIMIT 1
            """
        ),
        params,
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, "Producto no encontrado")
    return _map_producto(row)


async def list_productos_compact(
    db: AsyncSession,
    *,
    tipo: str | None = None,
    solo_activos: bool = True,
    para_pantalla: bool = False,
    filtrar_dia: bool = False,
    weekday: int | None = None,
) -> list[dict[str, Any]]:
    """
    Catálogo para cliente ligero.
    para_pantalla=True → claves mínimas (id, c, n, pr, s, a, tp, inf, dias).
    filtrar_dia=True → solo productos visibles hoy (dias_semana null = todos).
    weekday: 0=dom … 6=sab (JS). Si None y filtrar_dia, usa hoy local.
    """
    sql = f"""
        SELECT {SELECT_COLS}
        FROM {TABLE}
        WHERE 1=1
    """
    params: dict[str, Any] = {}
    if solo_activos:
        sql += " AND activo = TRUE"
    if tipo:
        sql += f" AND tipo = CAST(:tipo AS {TIPO_ENUM})"
        params["tipo"] = tipo
    sql += " ORDER BY tipo, numero_combo NULLS LAST, orden_display, nombre"

    result = await db.execute(text(sql), params)
    rows = []
    for r in result.mappings().all():
        item = _map_compact(r) if para_pantalla else _map_producto(r)
        if filtrar_dia:
            dias = item.get("dias") if para_pantalla else item.get("dias_semana")
            if not producto_visible_hoy(dias, weekday):
                continue
        rows.append(item)
    return rows


async def update_producto(
    db: AsyncSession,
    producto_id: UUID,
    *,
    precio_unitario: float | None = None,
    activo: bool | None = None,
    stock_disponible: int | None = None,
    stock_delta: int | None = None,
    nombre: str | None = None,
    es_ilimitado: bool | None = None,
    destacado: bool | None = None,
    numero_combo: int | None = None,
    clear_numero_combo: bool = False,
    dias_semana: list[int] | None = None,
    clear_dias_semana: bool = False,
    set_dias_semana: bool = False,
) -> dict[str, Any]:
    """Actualiza producto y notifica pantallas de menú al instante."""
    prod = await get_producto(db, producto_id=producto_id)

    sets: list[str] = []
    params: dict[str, Any] = {"id": str(producto_id)}

    if precio_unitario is not None:
        if precio_unitario < 0:
            raise HTTPException(400, "precio_unitario inválido")
        sets.append("precio_unitario = :precio")
        params["precio"] = Decimal(str(precio_unitario))

    if activo is not None:
        sets.append("activo = :activo")
        params["activo"] = activo

    if es_ilimitado is not None:
        sets.append("es_ilimitado = :es_ilimitado")
        params["es_ilimitado"] = bool(es_ilimitado)

    if destacado is not None:
        sets.append("destacado = :destacado")
        params["destacado"] = bool(destacado)

    if clear_numero_combo:
        sets.append("numero_combo = NULL")
    elif numero_combo is not None:
        if numero_combo < 1 or numero_combo > 12:
            raise HTTPException(400, "numero_combo debe estar entre 1 y 12")
        sets.append("numero_combo = :numero_combo")
        params["numero_combo"] = int(numero_combo)

    # Dias de pantalla: null = todos los dias
    if clear_dias_semana:
        sets.append("dias_semana = NULL")
    elif set_dias_semana:
        norm = normalize_dias_semana(dias_semana)
        if norm is None:
            sets.append("dias_semana = NULL")
        else:
            import json as _json

            sets.append("dias_semana = CAST(:dias_semana AS jsonb)")
            params["dias_semana"] = _json.dumps(norm)

    # Stock: si queda/se marca ilimitado, no se fuerza a cero en ventas
    will_unlimited = (
        bool(es_ilimitado)
        if es_ilimitado is not None
        else bool(prod.get("es_ilimitado"))
    )

    if not will_unlimited:
        if stock_disponible is not None:
            if stock_disponible < 0:
                raise HTTPException(400, "stock_disponible inválido")
            sets.append("stock_disponible = :stock")
            params["stock"] = stock_disponible
        elif stock_delta is not None:
            sets.append(
                "stock_disponible = GREATEST(0, stock_disponible + :delta)"
            )
            params["delta"] = stock_delta
    elif stock_disponible is not None and es_ilimitado is False:
        # Transición a limitado con stock explícito
        if stock_disponible < 0:
            raise HTTPException(400, "stock_disponible inválido")
        sets.append("stock_disponible = :stock")
        params["stock"] = stock_disponible

    if nombre is not None:
        sets.append("nombre = :nombre")
        params["nombre"] = nombre

    if not sets:
        return prod

    sets.append("actualizado_en = NOW()")
    await db.execute(
        text(f"UPDATE {TABLE} SET {', '.join(sets)} WHERE id = :id"),
        params,
    )
    await db.commit()

    updated = await get_producto(db, producto_id=producto_id)
    await _broadcast_product(updated)
    return updated


async def create_producto(
    db: AsyncSession,
    *,
    nombre: str,
    tipo: str,
    precio_unitario: float = 0,
    stock_disponible: int = 0,
    activo: bool = True,
    es_ilimitado: bool = False,
    destacado: bool = False,
    numero_combo: int | None = None,
    descripcion: str | None = None,
    codigo: str | None = None,
    dias_semana: list[int] | None = None,
) -> dict[str, Any]:
    """Crea producto, genera código si no se envía, notifica TVs (t=+)."""
    import json as _json

    nombre = (nombre or "").strip()
    if not nombre or len(nombre) > 160:
        raise HTTPException(400, "nombre requerido (máx. 160 caracteres)")
    tipo = normalize_tipo(tipo)
    if precio_unitario < 0:
        raise HTTPException(400, "precio_unitario inválido")
    if stock_disponible < 0:
        raise HTTPException(400, "stock_disponible inválido")
    if numero_combo is not None and (numero_combo < 1 or numero_combo > 12):
        raise HTTPException(400, "numero_combo debe estar entre 1 y 12")

    if codigo:
        code = re.sub(r"[^A-Za-z0-9_-]", "", codigo.upper())[:30]
        if not code:
            raise HTTPException(400, "codigo inválido")
        code = await _codigo_disponible(db, code)
    else:
        code = await generate_codigo(db, tipo, nombre)

    unidad = UNIDAD_BY_TIPO.get(tipo, "und")
    stock = 0 if es_ilimitado else int(stock_disponible)
    dias_norm = normalize_dias_semana(dias_semana)

    result = await db.execute(
        text(
            f"""
            SELECT COALESCE(MAX(orden_display), 0) + 1 AS next_ord
            FROM {TABLE}
            WHERE tipo = CAST(:tipo AS {TIPO_ENUM})
            """
        ),
        {"tipo": tipo},
    )
    next_ord = int(result.mappings().first()["next_ord"] or 1)

    result = await db.execute(
        text(
            f"""
            INSERT INTO {TABLE} (
                codigo, nombre, tipo, descripcion, precio_unitario,
                stock_disponible, stock_minimo, es_ilimitado,
                destacado, numero_combo,
                unidad, activo, orden_display, dias_semana
            ) VALUES (
                :codigo, :nombre, CAST(:tipo AS {TIPO_ENUM}), :descripcion, :precio,
                :stock, 0, :es_ilimitado,
                :destacado, :numero_combo,
                :unidad, :activo, :orden,
                CASE WHEN :dias_json IS NULL THEN NULL ELSE CAST(:dias_json AS jsonb) END
            )
            RETURNING {SELECT_COLS}
            """
        ),
        {
            "codigo": code,
            "nombre": nombre,
            "tipo": tipo,
            "descripcion": descripcion,
            "precio": Decimal(str(precio_unitario)),
            "stock": stock,
            "es_ilimitado": bool(es_ilimitado),
            "destacado": bool(destacado),
            "numero_combo": numero_combo,
            "unidad": unidad,
            "activo": bool(activo),
            "orden": next_ord,
            "dias_json": _json.dumps(dias_norm) if dias_norm is not None else None,
        },
    )
    row = result.mappings().first()
    await db.commit()
    created = _map_producto(row)

    payload = evt_product_created(
        product_id=created["id"],
        codigo=created["codigo"],
        nombre=created["nombre"],
        precio=created["precio_unitario"],
        stock=created["stock_disponible"],
        activo=created["activo"],
        tipo=created["tipo"],
        es_ilimitado=created["es_ilimitado"],
        destacado=created.get("destacado"),
        numero_combo=created.get("numero_combo"),
    )
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    return created


async def delete_producto(db: AsyncSession, producto_id: UUID) -> dict[str, Any]:
    """Borra permanentemente y notifica TVs (t=-)."""
    prod = await get_producto(db, producto_id=producto_id)
    await db.execute(
        text(f"DELETE FROM {TABLE} WHERE id = :id"),
        {"id": str(producto_id)},
    )
    await db.commit()

    payload = evt_product_deleted(
        product_id=prod["id"],
        codigo=prod["codigo"],
        tipo=prod["tipo"],
    )
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    return {"ok": True, "deleted": prod}


async def consume_stock(
    db: AsyncSession,
    producto_id: UUID,
    qty: int = 1,
) -> dict[str, Any]:
    """
    Descuenta existencias si el producto NO es ilimitado.
    Ilimitado: no restar; solo falla si está inactivo.
    """
    if qty <= 0:
        raise HTTPException(400, "qty debe ser > 0")

    prod = await get_producto(db, producto_id=producto_id)
    if not prod["activo"]:
        raise HTTPException(409, "Producto inactivo")

    if prod.get("es_ilimitado"):
        return prod

    result = await db.execute(
        text(
            f"""
            UPDATE {TABLE}
            SET stock_disponible = stock_disponible - :qty,
                actualizado_en = NOW()
            WHERE id = :id
              AND activo = TRUE
              AND COALESCE(es_ilimitado, FALSE) = FALSE
              AND stock_disponible >= :qty
            RETURNING {SELECT_COLS}
            """
        ),
        {"id": str(producto_id), "qty": qty},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(409, "Stock insuficiente o producto inactivo")
    await db.commit()
    updated = _map_producto(row)
    await _broadcast_product(updated)
    return updated


async def _broadcast_product(updated: dict[str, Any]) -> None:
    payload = evt_product(
        product_id=updated["id"],
        codigo=updated["codigo"],
        precio=updated["precio_unitario"],
        activo=updated["activo"],
        stock=updated["stock_disponible"],
        nombre=updated["nombre"],
        es_ilimitado=updated.get("es_ilimitado"),
        destacado=updated.get("destacado"),
        numero_combo=updated.get("numero_combo"),
    )
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)

    # AGOTADO solo si limitado y stock 0 (o inactivo)
    if not updated.get("es_ilimitado") and (
        updated["stock_disponible"] == 0 or not updated["activo"]
    ):
        z = evt_stock_zero(product_id=updated["id"], codigo=updated["codigo"])
        if updated["stock_disponible"] == 0 and updated["activo"]:
            z["a"] = 0
        await ws_manager.publish(CHANNEL_PANTALLAS, z)
        await ws_manager.publish(CHANNEL_ADMIN, z)


def _dias_from_row(row: Any) -> list[int] | None:
    try:
        return normalize_dias_semana(row.get("dias_semana"))
    except Exception:
        return None


def _map_compact(row: Any) -> dict[str, Any]:
    unlimited = bool(row.get("es_ilimitado"))
    out: dict[str, Any] = {
        "id": str(row["id"]),
        "c": row["codigo"],
        "n": row["nombre"],
        "pr": float(row["precio_unitario"]),
        "s": int(row["stock_disponible"] or 0),
        "a": 1 if row["activo"] else 0,
        "tp": row["tipo"],
        "inf": 1 if unlimited else 0,
        "dst": 1 if row.get("destacado") else 0,
    }
    if row.get("numero_combo") is not None:
        out["num"] = int(row["numero_combo"])
    dias = _dias_from_row(row)
    # null = todos los días; array = solo esos días (0=dom … 6=sáb)
    out["dias"] = dias
    return out


def _map_producto(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "codigo": row["codigo"],
        "nombre": row["nombre"],
        "tipo": row["tipo"],
        "descripcion": row.get("descripcion"),
        "precio_unitario": float(row["precio_unitario"]),
        "stock_disponible": int(row["stock_disponible"] or 0),
        "stock_minimo": int(row["stock_minimo"] or 0),
        "es_ilimitado": bool(row.get("es_ilimitado")),
        "destacado": bool(row.get("destacado")),
        "numero_combo": (
            int(row["numero_combo"]) if row.get("numero_combo") is not None else None
        ),
        "unidad": row["unidad"],
        "activo": bool(row["activo"]),
        "orden_display": int(row.get("orden_display") or 0),
        "dias_semana": _dias_from_row(row),
        "dias": _dias_from_row(row),
    }
