"""
WebSockets de alta eficiencia para las 6 pantallas Smart TV + Centro de Control.

Canales: pantallas | admin | all
Payloads compactos (claves cortas) para no saturar la LAN del restaurante.
"""

from __future__ import annotations

import asyncio
from typing import Any, Iterable

from fastapi import WebSocket
from starlette.websockets import WebSocketState

CHANNEL_PANTALLAS = "pantallas"
CHANNEL_ADMIN = "admin"
CHANNEL_ALL = "all"

# Alias legacy (clientes viejos)
CHANNEL_CAJERO = CHANNEL_ADMIN
CHANNEL_MESAS = CHANNEL_ADMIN

VALID_CHANNELS = frozenset(
    {CHANNEL_PANTALLAS, CHANNEL_ADMIN, CHANNEL_ALL, "cajero", "mesas"}
)


class ConnectionManager:
    def __init__(self) -> None:
        self._subs: dict[WebSocket, set[str]] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        channels: Iterable[str] | None = None,
    ) -> None:
        await websocket.accept()
        chans = {_normalize_ch(c) for c in (channels or [CHANNEL_ALL]) if _normalize_ch(c) in {CHANNEL_PANTALLAS, CHANNEL_ADMIN, CHANNEL_ALL}}
        if not chans:
            chans = {CHANNEL_ALL}
        async with self._lock:
            self._subs[websocket] = chans

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._subs.pop(websocket, None)

    async def set_channels(self, websocket: WebSocket, channels: Iterable[str]) -> None:
        chans = {
            _normalize_ch(c)
            for c in channels
            if _normalize_ch(c) in {CHANNEL_PANTALLAS, CHANNEL_ADMIN, CHANNEL_ALL}
        }
        if not chans:
            chans = {CHANNEL_ALL}
        async with self._lock:
            if websocket in self._subs:
                self._subs[websocket] = chans

    def _targets(self, channel: str) -> list[WebSocket]:
        channel = _normalize_ch(channel)
        out: list[WebSocket] = []
        for ws, chans in self._subs.items():
            if CHANNEL_ALL in chans or channel in chans or channel == CHANNEL_ALL:
                out.append(ws)
        return out

    async def publish(self, channel: str, payload: dict[str, Any]) -> int:
        async with self._lock:
            targets = self._targets(channel)

        sent = 0
        dead: list[WebSocket] = []
        for ws in targets:
            if ws.client_state != WebSocketState.CONNECTED:
                dead.append(ws)
                continue
            try:
                await ws.send_json(payload)
                sent += 1
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                for ws in dead:
                    self._subs.pop(ws, None)
        return sent

    async def broadcast(self, payload: dict[str, Any]) -> int:
        return await self.publish(CHANNEL_ALL, payload)

    @property
    def count(self) -> int:
        return len(self._subs)


def _normalize_ch(c: str) -> str:
    c = (c or "").strip().lower()
    if c in ("cajero", "mesas", "admin"):
        return CHANNEL_ADMIN
    if c == "pantallas":
        return CHANNEL_PANTALLAS
    if c == "all":
        return CHANNEL_ALL
    return c


ws_manager = ConnectionManager()


def evt_product(
    *,
    product_id: str,
    codigo: str,
    precio: float | None = None,
    activo: bool | None = None,
    stock: int | None = None,
    nombre: str | None = None,
    es_ilimitado: bool | None = None,
    destacado: bool | None = None,
    numero_combo: int | None = None,
) -> dict[str, Any]:
    """Cambio de precio / activo / stock / board de un producto del menú."""
    p: dict[str, Any] = {"t": "p", "id": product_id, "c": codigo}
    if precio is not None:
        p["pr"] = round(float(precio), 2)
    if activo is not None:
        p["a"] = 1 if activo else 0
    if stock is not None:
        p["s"] = int(stock)
    if nombre is not None:
        p["n"] = nombre
    if es_ilimitado is not None:
        p["inf"] = 1 if es_ilimitado else 0
    if destacado is not None:
        p["dst"] = 1 if destacado else 0
    if numero_combo is not None:
        p["num"] = int(numero_combo)
    return p


def evt_stock_zero(*, product_id: str, codigo: str) -> dict[str, Any]:
    return {"t": "z", "id": product_id, "c": codigo, "s": 0, "a": 0}


def evt_image(
    *,
    product_id: str,
    codigo: str,
    url: str,
    version: int,
    url_card: str | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "t": "img",
        "id": product_id,
        "c": codigo,
        "u": url,
        "v": version,
    }
    if url_card:
        out["uc"] = url_card
    return out


def evt_product_created(
    *,
    product_id: str,
    codigo: str,
    nombre: str,
    precio: float,
    stock: int,
    activo: bool,
    tipo: str,
    es_ilimitado: bool = False,
    destacado: bool = False,
    numero_combo: int | None = None,
) -> dict[str, Any]:
    """Producto nuevo → TVs recargan o insertan en el grupo."""
    p: dict[str, Any] = {
        "t": "+",
        "id": product_id,
        "c": codigo,
        "n": nombre,
        "pr": round(float(precio), 2),
        "s": int(stock),
        "a": 1 if activo else 0,
        "tp": tipo,
        "inf": 1 if es_ilimitado else 0,
        "dst": 1 if destacado else 0,
    }
    if numero_combo is not None:
        p["num"] = int(numero_combo)
    return p


def evt_product_deleted(*, product_id: str, codigo: str, tipo: str | None = None) -> dict[str, Any]:
    """Producto eliminado → TVs lo quitan del menú."""
    p: dict[str, Any] = {"t": "-", "id": product_id, "c": codigo}
    if tipo:
        p["tp"] = tipo
    return p


def evt_publicidad(*, zona: str, campana: dict[str, Any] | None = None) -> dict[str, Any]:
    import time as _t

    p: dict[str, Any] = {"t": "pub", "zona": zona, "v": int(_t.time())}
    if campana:
        p["d"] = campana.get("duracion_slide")
        p["e"] = campana.get("efecto_visual")
        p["a"] = 1 if campana.get("activo") else 0
        p["n"] = len(campana.get("slides") or [])
    return p
