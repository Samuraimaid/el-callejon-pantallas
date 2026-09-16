"""
API Cartelería Digital — Buffet y Restaurante El Callejón (León, Nicaragua)

6 pantallas Smart TV en tiempo real:
  #1–#2 Menú 50" · #3–#6 Publicidad independiente (favoritos /tv/3…/tv/6)
Centro de Control: menú del día + campañas + mensajes dinámicos.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import parse_qs

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import (
    ambient,
    auth,
    backup,
    config_pantallas,
    content,
    health,
    pantallas,
    productos,
    publicidad,
    landing,
)
from app.ws_manager import (
    CHANNEL_ALL,
    VALID_CHANNELS,
    ws_manager,
)

settings = get_settings()


async def _ambient_poll_loop() -> None:
    """Detecta cambios de canción del host y reintenta autoplay si hace falta."""
    from app.services import ambient_music as amb

    # Autoplay al arrancar solo si autoplay_on_boot=true (default: no)
    await asyncio.sleep(3.0)
    try:
        if getattr(amb, "_autoplay_on_boot_enabled", lambda: False)():
            amb._need_autoplay = True
        await amb.ensure_playing_if_needed(force=False)
    except Exception:
        pass

    while True:
        try:
            await amb.poll_host_for_track_changes()
        except Exception:
            pass
        await asyncio.sleep(2.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Hidratar estado de pantallas + master_power desde BD
    try:
        from app.db import AsyncSessionLocal
        from app.services import pantallas as pant_svc

        async with AsyncSessionLocal() as db:
            await pant_svc.load_from_db(db)
    except Exception:
        pass

    task = asyncio.create_task(_ambient_poll_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.app_name,
    description=(
        "Sistema de Gestión de Pantallas Digitales en Tiempo Real — "
        "menú del día, campañas publicitarias (Barra/VIP) y mensajes dinámicos."
    ),
    version="2.0.0",
    lifespan=lifespan,
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
app.include_router(ambient.router)
app.include_router(backup.router)
app.include_router(landing.router)


def _detect_lan_ips() -> list[str]:
    """IPs privadas del host/contenedor (para hub en Smart TVs)."""
    import os
    import socket

    found: list[str] = []
    seen: set[str] = set()

    def add(ip: str | None) -> None:
        if not ip or ip in seen:
            return
        if ip.startswith("127.") or ip == "0.0.0.0" or ":" in ip:
            return
        # Preferir redes locales típicas
        if not (
            ip.startswith("192.168.")
            or ip.startswith("10.")
            or ip.startswith("172.")
        ):
            return
        seen.add(ip)
        found.append(ip)

    # Override manual (recomendado en Docker: LAN_IP del host Windows)
    for key in ("LAN_IP", "HOST_LAN_IP", "PUBLIC_HOST"):
        raw = (os.environ.get(key) or "").strip()
        if raw:
            # puede ser host o URL
            raw = raw.replace("http://", "").replace("https://", "").split("/")[0]
            raw = raw.split(":")[0]
            add(raw)

    # Socket UDP: IP de la interfaz de salida por defecto
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.4)
        s.connect(("8.8.8.8", 80))
        add(s.getsockname()[0])
        s.close()
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            add(info[4][0])
    except OSError:
        pass

    # Linux: hostname -I / ip route
    try:
        import subprocess

        out = subprocess.check_output(
            ["hostname", "-I"], stderr=subprocess.DEVNULL, timeout=1
        ).decode("utf-8", errors="replace")
        for part in out.split():
            add(part.strip())
    except (OSError, subprocess.SubprocessError):
        pass

    # Preferir 192.168.* sobre 172.* (Docker bridge)
    found.sort(
        key=lambda ip: (
            0 if ip.startswith("192.168.") else 1 if ip.startswith("10.") else 2,
            ip,
        )
    )
    return found


@app.get("/red")
async def red_info():
    """
    Info de conexión para el hub / técnicos.
    Incluye IP(s) LAN detectadas del servidor para las Smart TVs.
    """
    import os

    ips = _detect_lan_ips()
    puerto_hub = int(os.environ.get("FRONTEND_PORT") or os.environ.get("HUB_PORT") or 5173)
    preferred = ips[0] if ips else None
    hub_url = f"http://{preferred}:{puerto_hub}" if preferred else None

    return {
        "mensaje": (
            "Abra en cada Smart TV la dirección del hub y elija su pantalla "
            "(/tv/1 … /tv/6). Guarde la URL en favoritos."
        ),
        "puerto_hub": puerto_hub,
        "puerto_api": 8000,
        "ips": ips,
        "ip_preferida": preferred,
        "hub_url": hub_url,
        "rutas_tv": {
            "1": "/tv/1",
            "2": "/tv/2",
            "3": "/tv/3",
            "4": "/tv/4",
            "5": "/tv/5",
            "6": "/tv/6",
        },
        "nota": (
            "Si corre en Docker y ve IP 172.x, defina LAN_IP=su.ip.local en .env "
            "(ipconfig → IPv4 del PC host)."
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
