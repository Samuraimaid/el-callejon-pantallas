"""CRUD menú del día — mutaciones en servidor + WS pantallas 50\"."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import CurrentUser, require_caja, require_operacion
from app.services import inventory
from app.ws_manager import CHANNEL_ADMIN, CHANNEL_PANTALLAS, evt_image, ws_manager

router = APIRouter(prefix="/api/productos", tags=["productos"])


class ProductoCreate(BaseModel):
    """Alta de producto del menú. codigo se genera si no se envía (ej. CAF-MOKA)."""

    nombre: str = Field(..., min_length=1, max_length=160)
    # Acepta enum real o alias UI: platillo, extra, jugo, bebida, licor, cafe
    categoria: str | None = Field(
        default=None,
        description="Alias de categoría UI (platillo, extra, jugo, bebida, licor, cafe)",
    )
    tipo: str | None = Field(
        default=None,
        description="Enum PostgreSQL tipo_producto_menu (alternativa a categoria)",
    )
    precio_unitario: float = Field(default=0, ge=0)
    stock_disponible: int = Field(default=0, ge=0)
    es_ilimitado: bool = False
    destacado: bool = False
    numero_combo: int | None = Field(default=None, ge=1, le=12)
    activo: bool = True
    descripcion: str | None = None
    codigo: str | None = Field(
        default=None,
        max_length=30,
        description="Opcional; si falta se genera PLT-… / CAF-… etc.",
    )
    # 0=dom … 6=sab; null = todos los dias (como promos)
    dias_semana: list[int] | None = None


class ProductoPatch(BaseModel):
    precio_unitario: float | None = Field(default=None, ge=0)
    activo: bool | None = None
    stock_disponible: int | None = Field(default=None, ge=0)
    stock_delta: int | None = None
    nombre: str | None = None
    es_ilimitado: bool | None = None
    destacado: bool | None = None
    # null explícito limpia el número; omitir = no cambiar
    numero_combo: int | None = Field(default=None, ge=1, le=12)
    clear_numero_combo: bool = False
    # Dias de semana en pantallas: 0=dom … 6=sab; null/[] = todos
    dias_semana: list[int] | None = None
    clear_dias_semana: bool = False


@router.post("")
async def crear(
    body: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """
    Crea producto en productos_menu.
    Genera código único (ej. CAF-MOKA) y emite WS t=+ a pantallas.
    """
    tipo = body.tipo or body.categoria
    if not tipo:
        raise HTTPException(400, "categoria o tipo requerido")
    return await inventory.create_producto(
        db,
        nombre=body.nombre,
        tipo=tipo,
        precio_unitario=body.precio_unitario,
        stock_disponible=body.stock_disponible,
        activo=body.activo,
        es_ilimitado=body.es_ilimitado,
        destacado=body.destacado,
        numero_combo=body.numero_combo,
        descripcion=body.descripcion,
        codigo=body.codigo,
        dias_semana=body.dias_semana,
    )


@router.get("")
async def listar(
    db: AsyncSession = Depends(get_db),
    tipo: str | None = None,
    solo_activos: bool = True,
    compact: bool = Query(
        False,
        description="true = payload mínimo para pantallas de menú",
    ),
    _user: CurrentUser = Depends(require_operacion),
):
    return await inventory.list_productos_compact(
        db,
        tipo=tipo,
        solo_activos=solo_activos,
        para_pantalla=compact,
    )


@router.get("/menu")
async def menu_agrupado(
    db: AsyncSession = Depends(get_db),
):
    """
    Menú agrupado para TVs #1 (comidas) y #2 (complementos).

    Público (sin JWT): las Smart TVs no pueden hacer login PIN
    (bloqueado en /api/auth) y deben leer el menú del día.
    Mutaciones siguen protegidas en POST/PATCH/DELETE.
    """
    # Solo productos activos y visibles HOY (dias_semana null = todos los dias)
    all_p = await inventory.list_productos_compact(
        db, solo_activos=True, para_pantalla=True, filtrar_dia=True
    )
    groups = {
        "platillos": [],
        "extras": [],
        "jugos": [],
        "bebidas": [],
        "licores": [],
        "cafes": [],
    }
    for p in all_p:
        tp = p["tp"]
        if tp == "plato_preestablecido":
            groups["platillos"].append(p)
        elif tp == "extra":
            groups["extras"].append(p)
        elif tp == "bebida_jugo":
            groups["jugos"].append(p)
        elif tp == "bebida_soda":
            groups["bebidas"].append(p)
        elif tp == "licor":
            groups["licores"].append(p)
        elif tp == "cafe":
            groups["cafes"].append(p)
    from datetime import datetime

    # weekday JS: 0=dom … 6=sab
    js_day = (datetime.now().weekday() + 1) % 7
    return {
        "menu": groups,
        "conteos": {k: len(v) for k, v in groups.items()},
        "weekday": js_day,
        "filtro_dia": True,
    }


@router.get("/{producto_id}")
async def detalle(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(require_caja),
):
    return await inventory.get_producto(db, producto_id=producto_id)


@router.patch("/{producto_id}")
async def actualizar(
    producto_id: UUID,
    body: ProductoPatch,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """Cambia precio, stock, dias de pantalla o activo → push WS a TVs de menú."""
    # Detectar si el cliente envio dias_semana (incluso null = todos los dias)
    raw = body.model_dump(exclude_unset=True)
    set_dias = "dias_semana" in raw or body.clear_dias_semana
    return await inventory.update_producto(
        db,
        producto_id,
        precio_unitario=body.precio_unitario,
        activo=body.activo,
        stock_disponible=body.stock_disponible,
        stock_delta=body.stock_delta,
        nombre=body.nombre,
        es_ilimitado=body.es_ilimitado,
        destacado=body.destacado,
        numero_combo=body.numero_combo,
        clear_numero_combo=body.clear_numero_combo,
        dias_semana=body.dias_semana,
        clear_dias_semana=body.clear_dias_semana,
        set_dias_semana=set_dias and not body.clear_dias_semana,
    )


@router.delete("/{producto_id}")
async def eliminar(
    producto_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """Elimina permanentemente el producto y avisa a las TVs (WS t=-)."""
    return await inventory.delete_producto(db, producto_id)


@router.post("/{producto_id}/imagen")
async def subir_imagen(
    producto_id: UUID,
    file: UploadFile = File(..., description="Imagen hero 1:1"),
    file_card: UploadFile | None = File(
        default=None, description="Imagen ancha para tarjeta lateral"
    ),
    remove_bg: str = Form(default="false"),
    db: AsyncSession = Depends(get_db),
    _user: Annotated[CurrentUser, Depends(require_caja)] = ...,
):
    """
    Sube foto de producto (doble plantilla):
      - file → {CODIGO}.jpg (hero 1:1, columna central)
      - file_card → {CODIGO}-card.jpg (fondo de tarjeta lateral)
      - remove_bg=true|false (rembg opcional, sobre todo en hero)
      - WebSocket t=img a pantallas
    """
    from app.services.product_images import process_image, absolute_path, public_url

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(400, "El archivo debe ser una imagen")

    prod = await inventory.get_producto(db, producto_id=producto_id)
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(400, "Imagen demasiado grande (máx. 12 MB)")

    do_rembg = str(remove_bg).lower() in ("1", "true", "yes", "si", "sí")
    card_raw: bytes | None = None
    if file_card is not None:
        card_raw = await file_card.read()
        if card_raw and len(card_raw) > 12 * 1024 * 1024:
            raise HTTPException(400, "Imagen tarjeta demasiado grande (máx. 12 MB)")

    def _pipeline() -> dict:
        import time

        jpeg = process_image(raw, remove_bg=do_rembg, max_side=1000)
        dest = absolute_path(prod["tipo"], prod["codigo"], role="hero")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(jpeg)
        from app.services.product_images import save_alias_copies
        save_alias_copies(prod["tipo"], prod["codigo"], jpeg, role="hero")
        ver = int(time.time())
        card_url = None
        if card_raw:
            # Tarjeta: sin rembg por defecto (foto completa de fondo)
            jpeg_c = process_image(card_raw, remove_bg=False, max_side=1200)
            dest_c = absolute_path(prod["tipo"], prod["codigo"], role="card")
            dest_c.write_bytes(jpeg_c)
            save_alias_copies(prod["tipo"], prod["codigo"], jpeg_c, role="card")
            card_url = public_url(prod["tipo"], prod["codigo"], ver, role="card")
        return {
            "url": public_url(prod["tipo"], prod["codigo"], ver, role="hero"),
            "url_card": card_url,
            "version": ver,
            "path": str(dest),
        }

    try:
        meta = await run_in_threadpool(_pipeline)
    except Exception as e:
        raise HTTPException(500, f"Error procesando imagen: {e}") from e

    payload = evt_image(
        product_id=prod["id"],
        codigo=prod["codigo"],
        url=meta["url"],
        version=meta["version"],
        url_card=meta.get("url_card"),
    )
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)

    return {
        "ok": True,
        "producto_id": prod["id"],
        "codigo": prod["codigo"],
        "url": meta["url"],
        "url_card": meta.get("url_card"),
        "imagen_url": meta["url"],
        "imagen_url_card": meta.get("url_card"),
        "version": meta["version"],
        "v": meta["version"],
    }

@router.post("/sincronizar")
async def sincronizar_pantallas(_user: CurrentUser = Depends(require_caja)):
    """Emite una señal WebSocket a todas las TVs para recargar y sincronizar el menú de inmediato."""
    import time

    ver = int(time.time())
    payload = {"t": "p_reload", "v": ver}
    await ws_manager.publish(CHANNEL_PANTALLAS, payload)
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    return {"ok": True, "v": ver, "mensaje": "Pantallas sincronizadas"}
