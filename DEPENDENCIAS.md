# Dependencias — PC servidor El Callejón (pantallas digitales)

Guía para montar el sistema en **otro PC Windows o Linux** que actuará como servidor local del restaurante.

---

## Requisitos del equipo (recomendado)

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 núcleos | 4+ núcleos |
| RAM | 8 GB | 16 GB (rembg/IA de imágenes) |
| Disco | 15 GB libres | 40 GB+ SSD |
| Red | LAN Ethernet o Wi‑Fi estable | Ethernet al switch de las TVs |
| SO | Windows 10/11 64‑bit o Ubuntu 22.04+ | Windows 11 Pro / Ubuntu 24.04 |

Las **6 Smart TVs** solo necesitan un navegador moderno (Chrome/Edge/WebOS/Tizen) apuntando a la IP del servidor.

---

## Software a instalar en el servidor

### Opción A — Recomendada: solo Docker (más simple)

1. **Docker Desktop** (Windows) o **Docker Engine + Compose** (Linux)  
   - Windows: https://www.docker.com/products/docker-desktop/  
   - Linux: https://docs.docker.com/engine/install/  
2. **Git**  
   - https://git-scm.com/downloads  
3. (Opcional) **GitHub CLI** `gh` — solo si clonas repos privados con facilidad  

Con Docker **no** hace falta instalar Python ni Node a mano: todo va en contenedores.

```bash
# Verificar
docker --version
docker compose version
git --version
```

### Opción B — Desarrollo sin Docker (nativo)

Instalar además:

| Software | Versión | Uso |
|----------|---------|-----|
| **Python** | 3.12.x | Backend FastAPI |
| **Node.js** | 22.x LTS | Frontend Vite/React |
| **PostgreSQL** | 16.x | Base de datos |
| **Git** | 2.x | Código fuente |

---

## Dependencias del proyecto (listas de paquetes)

### Backend (Python) — `backend/requirements.txt`

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
pydantic==2.10.4
pydantic-settings==2.7.0
python-dotenv==1.0.1
websockets==14.1
orjson==3.10.12
PyJWT==2.10.1
bcrypt==4.2.1
python-multipart==0.0.20
Pillow==11.1.0
rembg==2.0.62
onnxruntime==1.20.1
httpx==0.28.1
```

Instalación nativa:

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend (Node) — `frontend/package.json`

**Producción / runtime:**

- `react` ^18.3.1  
- `react-dom` ^18.3.1  
- `react-router-dom` ^6.28.1  
- `react-easy-crop` ^5.2.0  

**Build / dev:**

- `vite` ^6.0.6  
- `@vitejs/plugin-react` ^4.3.4  
- `tailwindcss` ^4.0.0  
- `@tailwindcss/vite` ^4.0.0  

```bash
cd frontend
npm install
```

### Base de datos

- Imagen Docker: **`postgres:16-alpine`**  
- O PostgreSQL 16 nativo con extensión `pgcrypto`

### Sistema (dentro del contenedor backend)

- `curl`, `libgomp1` (para onnxruntime/rembg) — ya en el `Dockerfile`

---

## Puertos que debe dejar libres el servidor

| Puerto | Servicio |
|--------|----------|
| **5173** | Frontend (hub + TVs + admin) |
| **8000** | API FastAPI + WebSocket |
| **5432** | PostgreSQL (solo LAN local; no exponer a Internet) |

Firewall Windows: permitir entrada en 5173 y 8000 para la red local.

---

## Variables de entorno (`.env`)

Copiar desde `.env.example` y ajustar, sobre todo en el PC servidor:

```env
POSTGRES_USER=callejon
POSTGRES_PASSWORD=***cambiar***
POSTGRES_DB=el_callejon_pos
POSTGRES_PORT=5432

BACKEND_PORT=8000
DATABASE_URL=postgresql+asyncpg://callejon:***@db:5432/el_callejon_pos
CORS_ORIGINS=http://IP_DEL_SERVIDOR:5173,http://localhost:5173
JWT_SECRET=***cadena-larga-aleatoria***
JWT_EXPIRE_MINUTES=720

FRONTEND_PORT=5173
# Importante: usar la IP LAN del servidor, no solo localhost,
# para que las Smart TVs puedan hablar con la API.
VITE_API_URL=http://IP_DEL_SERVIDOR:8000
VITE_WS_URL=ws://IP_DEL_SERVIDOR:8000/ws
```

Tras cambiar `VITE_*`, hay que **reconstruir** el frontend:

```bash
docker compose up --build -d
```

---

## Arranque en el servidor (Docker)

```bash
git clone https://github.com/Samuraimaid/el-callejon-pantallas.git
cd el-callejon-pantallas
copy .env.example .env   # o: cp .env.example .env
# Editar .env con IP del servidor y contraseñas

docker compose up --build -d
```

Primera vez: PostgreSQL ejecuta `db/init/*.sql` (schema + seed).

Credenciales dev por defecto (cambiar en producción):

- Usuario: `admin`  
- PIN/password: `1234`  

### URLs útiles

- Hub: `http://IP_SERVIDOR:5173`  
- Admin: `http://IP_SERVIDOR:5173/admin`  
- TV comidas: `http://IP_SERVIDOR:5173/pantalla/comidas`  
- TV complementos: `http://IP_SERVIDOR:5173/pantalla/complementos`  
- Pub Barra: `http://IP_SERVIDOR:5173/pantalla/publicidad/barra`  
- Pub VIP: `http://IP_SERVIDOR:5173/pantalla/publicidad/vip`  
- API docs: `http://IP_SERVIDOR:8000/docs`  

---

## Notas

1. **Modelo rembg (u2net):** se descarga al primer uso de quitar fondo (~176 MB). Queda en `data/u2net/` (no va en Git).  
2. **Imágenes de menú/slides:** están en `frontend/public/images/` y sí se versionan.  
3. **No subir** archivo `.env` real ni `data/postgres/` al repositorio.  
4. En un segundo PC, clonar de GitHub y `docker compose up --build` es el flujo completo.
