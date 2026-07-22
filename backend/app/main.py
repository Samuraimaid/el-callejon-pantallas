"""
API Cartelería Digital — Buffet y Restaurante El Callejón (León, Nicaragua)

6 pantallas Smart TV en tiempo real:
  #1–#2 Menú 50" · #3–#4 Publicidad Barra 50" · #5–#6 Publicidad VIP 60"
Centro de Control: menú del día + campañas + mensajes dinámicos.
"""

from __future__ import annotations

from urllib.parse import parse_qs

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, health, productos, publicidad
from app.ws_manager import (
    CHANNEL_ALL,
    VALID_CHANNELS,
    ws_manager,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=(
        "Sistema de Gestión de Pantallas Digitales en Tiempo Real — "
        "menú del día, campañas publicitarias (Barra/VIP) y mensajes dinámicos."
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(publicidad.router)


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
        "auth": "/api/auth/login",
        "pantallas": {
            "menu_comidas": "/pantalla/comidas",
            "menu_complementos": "/pantalla/complementos",
            "pub_barra": "/pantalla/publicidad/barra",
            "pub_vip": "/pantalla/publicidad/vip",
        },
        "ws": {
            "url": "/ws",
            "channels": sorted(
                c for c in VALID_CHANNELS if c not in ("cajero", "mesas")
            ),
            "query": "?ch=pantallas  |  ?ch=admin",
            "payload_types": {
                "p": "producto menú (precio/activo/stock)",
                "z": "stock cero",
                "img": "foto producto",
                "pub": "campaña publicidad por zona (slides + mensajes)",
                "h": "hello",
            },
            "publicidad": {
                "barra": "/api/publicidad/BARRA_BEBIDAS",
                "vip": "/api/publicidad/SALON_VIP",
            },
        },
    }


def _parse_channels(raw: str | None) -> list[str]:
    if not raw:
        return [CHANNEL_ALL]
    parts = [p.strip().lower() for p in raw.replace(";", ",").split(",") if p.strip()]
    valid = [p for p in parts if p in VALID_CHANNELS]
    return valid or [CHANNEL_ALL]


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    ch: str | None = Query(
        default=None,
        description="Canales: pantallas,admin,all",
    ),
):
    """
    WebSocket en vivo para Smart TVs y Centro de Control.

      ws://host/ws?ch=pantallas
      ws://host/ws?ch=admin
      ws://host/ws

    Eventos: p | z | img | pub | h
    """
    channels = _parse_channels(ch)
    if not ch and websocket.url.query:
        qs = parse_qs(websocket.url.query)
        if "ch" in qs:
            channels = _parse_channels(qs["ch"][0])

    await ws_manager.connect(websocket, channels)
    await websocket.send_json(
        {
            "t": "h",
            "ch": channels,
            "n": ws_manager.count,
        }
    )

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("a") or data.get("action")
            if action == "ping":
                await websocket.send_json({"t": "pong"})
            elif action in ("sub", "subscribe"):
                raw_ch = data.get("ch") or data.get("channels") or []
                if isinstance(raw_ch, str):
                    raw_ch = [raw_ch]
                await ws_manager.set_channels(websocket, raw_ch)
                await websocket.send_json({"t": "h", "ch": list(raw_ch)})
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)
