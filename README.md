# El Callejón — Pantallas Digitales en Tiempo Real

Sistema de **cartelería digital** para Buffet y Restaurante El Callejón (León, Nicaragua).

**No procesa cobros ni dinero.** Administra 6 pantallas Smart TV, menú del día, campañas publicitarias y mensajes dinámicos en vivo.

> Guía completa de instalación en otro PC servidor: **[DEPENDENCIAS.md](./DEPENDENCIAS.md)**

---

## Las 6 pantallas

| # | Uso | Ruta (navegador Smart TV) |
|---|-----|---------------------------|
| 1 | Menú comidas 50″ (platillos + extras) | `/pantalla/comidas` o `/tv/1` |
| 2 | Complementos 50″ (jugos, sodas, cafés) | `/pantalla/complementos` o `/tv/2` |
| 3–4 | Publicidad Barra 50″ | `/pantalla/publicidad/barra` o `/tv/3` `/tv/4` |
| 5–6 | Publicidad VIP 60″ | `/pantalla/publicidad/vip` o `/tv/5` `/tv/6` |

- **Menú board** estilo franquicia (números, hero rotativo, 10 efectos) sobre fondo roble rojo.
- **Publicidad** independiente Barra / VIP (slides, efectos, logo, fuente).
- **Mensajes dinámicos** (Chef / ¿Sabías qué?) editables desde el control.
- Actualización en vivo por **WebSocket**.

---

## Stack Docker

| Servicio | Tecnología | Puerto |
|----------|------------|--------|
| `db` | PostgreSQL 16 | 5432 |
| `backend` | FastAPI + WebSockets + rembg | 8000 |
| `frontend` | React 18 + Vite 6 + Tailwind 4 | 5173 |

---

## Requisitos en el PC servidor

**Mínimo:** Docker Desktop (o Docker Engine + Compose) + Git.

Detalle de dependencias Python/Node y puertos: **[DEPENDENCIAS.md](./DEPENDENCIAS.md)**.

---

## Arranque rápido

```bash
git clone https://github.com/Samuraimaid/el-callejon-pantallas.git
cd el-callejon-pantallas
cp .env.example .env    # Windows: copy .env.example .env
# Editar .env: JWT_SECRET, contraseñas, VITE_API_URL / VITE_WS_URL con IP del servidor

docker compose up --build -d
```

| Uso | URL |
|-----|-----|
| Hub (este PC) | http://localhost:5173 |
| Hub (red / TVs) | http://IP_DEL_SERVIDOR:5173 |
| Centro de Control | http://IP_DEL_SERVIDOR:5173/admin |
| API / docs | http://IP_DEL_SERVIDOR:8000/docs |
| Health / red | http://IP_DEL_SERVIDOR:8000/health · `/red` |

**Smart TVs en la misma Wi‑Fi:** en el televisor abra `http://IP:5173` (IPv4 del PC servidor, ej. `192.168.1.129`), elija el botón de esa TV y guarde en favoritos. No use `localhost` en las TVs — eso apunta al propio televisor.

**Login dev:** `admin` / `1234` (cambiar en producción).

### Smart TVs en la red local

En el `.env` del servidor (recomendado para LAN):

```env
VITE_API_URL=auto
VITE_WS_URL=auto
CORS_ORIGINS=*
```

Con `auto`, el navegador de cada TV usa la **misma IP** con la que abrió el hub; Vite hace proxy de `/api` y `/ws` al backend (solo hace falta el puerto **5173** en las TVs).

Luego `docker compose up --build -d`.

### Reinicio limpio de BD

Los scripts en `db/init/` solo corren en el **primer** arranque del volumen:

```bash
docker compose down
# Windows PowerShell:
Remove-Item -Recurse -Force .\data\postgres
docker compose up --build -d
```

Migraciones incrementales: carpeta `db/migrations/` (`001` … `007`).

---

## Base de datos (3 tablas)

| Tabla | Rol |
|-------|-----|
| `usuarios` | Auth del Centro de Control |
| `productos_menu` | Menú: precios, stock, `es_ilimitado`, `destacado`, `numero_combo` |
| `campanas_publicidad` | Slides + mensajes dinámicos por zona |

---

## Centro de Control (`/admin`)

1. **Gestionar Menú del Día** — CRUD, ♾️ ilimitado, ⭐ destacado, Nº combo 1–12, foto 1:1 + rembg, WS a TVs.
2. **Gestionar Campañas Publicitarias** — TV #3–#6 independientes, 10 efectos, mensajes Chef / ¿Sabías qué?

### Favoritos Smart TV (URL corta)

En la home (`/`) hay un botón por televisor. Abra el enlace en cada TV y guárdelo en favoritos o como página de inicio:

| TV | Ruta | Contenido |
|----|------|-----------|
| #1 | `/tv/1` | Menú comidas |
| #2 | `/tv/2` | Complementos |
| #3 | `/tv/3` | Publicidad Barra (bebidas/picada) |
| #4 | `/tv/4` | Publicidad Parrilla (asados) |
| #5 | `/tv/5` | Publicidad VIP ambiente |
| #6 | `/tv/6` | Publicidad VIP platillos |

---

## API relevante

- `POST /api/auth/login`
- `GET|POST /api/productos` · `PATCH|DELETE /api/productos/{id}` · `POST .../imagen`
- `GET /api/productos/menu`
- `GET|PUT /api/publicidad/{zona}` · `POST .../subir-slide`

Zonas activas: `TV3` | `TV4` | `TV5` | `TV6`  
Aliases: `barra` → TV3, `vip` → TV5

WebSocket: `ws://host:8000/ws?ch=pantallas`  
Eventos: `p`, `z`, `img`, `+`, `-`, `pub`, `h`

---

## Estructura

```
el-callejon-pantallas/
├── docker-compose.yml
├── .env.example
├── DEPENDENCIAS.md          # Lista completa para instalar en otro PC
├── db/init/                 # schema + seed (primer arranque)
├── db/migrations/           # upgrades
├── backend/                 # FastAPI
│   ├── requirements.txt
│   └── app/
└── frontend/                # React + Vite
    ├── package.json
    └── src/
```

---

## Licencia / uso

Uso interno del restaurante El Callejón. No publicar credenciales reales en el repositorio.
