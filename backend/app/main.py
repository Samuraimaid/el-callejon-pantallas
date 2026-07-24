"""
API Cartelería Digital — Buffet y Restaurante El Callejón (León, Nicaragua)

6 pantallas Smart TV en tiempo real:
  #1–#2 Menú 50" · #3–#6 Publicidad independiente (favoritos /tv/3…/tv/6)
Centro de Control: menú del día + campañas + mensajes dinámicos.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import parse_qs

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import auth, config_pantallas, content, health, pantallas, productos, publicidad
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
    version="2.0.0",
)

# Imágenes/videos de campañas y menú (misma carpeta que Vite public/images)
_image_root = Path(settings.image_root)
_image_root.mkdir(parents=True, exist_ok=True)
(_image_root / "videos").mkdir(parents=True, exist_ok=True)
app.mount(
    "/images",
    StaticFiles(directory=str(_image_root)),
    name="images",
)

# CORS abierto o lista + regex LAN (Smart TVs por IP:puerto)
_cors_kw: dict = {
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.cors_allow_all:
    _cors_kw["allow_origins"] = ["*"]
    _cors_kw["allow_credentials"] = False
else:
    _cors_kw["allow_origins"] = settings.cors_origin_list
    _cors_kw["allow_credentials"] = True
    if settings.cors_origin_regex:
        _cors_kw["allow_origin_regex"] = settings.cors_origin_regex

app.add_middleware(CORSMiddleware, **_cors_kw)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(publicidad.router)
app.include_router(config_pantallas.router)
app.include_router(pantallas.router)
app.include_router(content.router)


@app.get("/red")
async def red_info():
    """
    Info de conexión para el hub / técnicos.
    Las TVs deben abrir la IP LAN del PC servidor en el puerto del frontend (5173).
    """
    return {
        "mensaje": (
            "Abra en cada Smart TV: http://IP_DEL_SERVIDOR:5173 "
            "y elija el botón de esa pantalla (/tv/1 … /tv/6). "
            "Guarde la URL de la pantalla en favoritos."
        ),
        "puerto_hub": 5173,
        "puerto_api": 8000,
        "rutas_tv": {
            "1": "/tv/1",
            "2": "/tv/2",
            "3": "/tv/3",
            "4": "/tv/4",
            "5": "/tv/5",
            "6": "/tv/6",
        },
        "nota": (
            "En Windows: ipconfig → IPv4 (ej. 192.168.1.129). "
            "Firewall: permitir puertos 5173 (y 8000 si se usa API directa)."
        ),
    }


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "red": "/red",
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
                "tv3": "/api/publicidad/TV3",
                "tv4": "/api/publicidad/TV4",
                "tv5": "/api/publicidad/TV5",
                "tv6": "/api/publicidad/TV6",
                "favoritos": "/tv/3 … /tv/6",
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
