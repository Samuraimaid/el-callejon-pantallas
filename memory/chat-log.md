# Bitácora de Memoria del Proyecto - El Callejón Cartelería Digital

> Archivo de memoria persistente para el agente de IA. Actualizado en cada sesión.

---

## 1. Información General del Proyecto
- **Nombre:** El Callejón - Pantallas Digitales en Tiempo Real (Buffet y Restaurante en León, Nicaragua).
- **Repositorio GitHub:** `https://github.com/Samuraimaid/el-callejon-pantallas.git`
- **Ubicación Local:** `C:\EL_CALLEJON_POS`

---

## 2. Arquitectura en la Nube (Google Cloud + Neon Serverless)
- **Costo:** $0.00 a ~$0.50/mes (Escala a cero cuando las pantallas no se usan).
- **Google Cloud Project ID:** `gen-lang-client-0971793042` (Project Number: `836176703716`).
- **Región GCP:** `us-central1` (Iowa).

### Servicios Desplegados:
1. **Frontend (React 18 + Vite 6 + Tailwind 4 + Nginx):**
   - **URL Pública Oficial:** `https://callejon-frontend-836176703716.us-central1.run.app`
   - Nginx hace proxy transparente de `/api` y `/ws` hacia el backend en el mismo dominio.
   - Escala a 0 instancias inactivas (`min-instances=0`).
2. **Backend (FastAPI + WebSockets + rembg):**
   - **URL del Servicio:** `https://callejon-backend-836176703716.us-central1.run.app`
   - Puerto del contenedor: `8000`.
   - Timeout: 3600 segundos (mantiene WebSockets abiertos para las TVs).
   - Memoria: 2GiB, CPU: 2 (para procesamiento de imágenes con rembg/ONNX).
   - Escala a 0 instancias inactivas (`min-instances=0`).
3. **Multimedia (Google Cloud Storage):**
   - **Bucket:** `gs://callejon-multimedia-pos`
   - Montado con GCSFuse como volumen nativo en Cloud Run en `/app/static/images`.
   - Contiene todas las carpetas: `platillos`, `bebidas`, `extras`, `slides`, `publicidad`, `videos`.
4. **Base de Datos (Neon PostgreSQL Serverless):**
   - **Host:** `ep-empty-snow-b41b4o4k-pooler.c-6.us-east-2.aws.neon.tech`
   - **Database:** `neondb`
   - **User:** `neondb_owner`
   - Tablas migradas: `usuarios`, `productos_menu`, `campanas_publicidad`, `config_sistema`.
   - 14 migraciones aplicadas exitosamente.
   - Escala a cero automáticamente cuando no hay consultas.

---

## 3. URLs de Pantallas y Accesos
| Pantalla / Vista | Ruta | Descripción |
|---|---|---|
| **Landing Page Turística** | `/restaurante` | Web oficial multilingüe (6 idiomas) con cotizador WhatsApp y Google Maps |
| **Hub / Lobby** | `/` | Vista de inicio con accesos rápidos y banner a la web |
| **TV #1** | `/tv/1` o `/pantalla/comidas` | Menú comidas 50" (platillos + extras + hero rotativo) |
| **TV #2** | `/tv/2` o `/pantalla/complementos` | Complementos y bebidas 50" (jugos, sodas, cafés) |
| **TV #3** | `/tv/3` | Publicidad Barra (bebidas / picadas) |
| **TV #4** | `/tv/4` | Publicidad Parrilla (asados) |
| **TV #5** | `/tv/5` | Publicidad VIP ambiente |
| **TV #6** | `/tv/6` | Publicidad VIP platillos |
| **Admin Panel (CMS)** | `/admin` o `/login` | Centro de Control (Usuario y Contraseña Bcrypt: Marlon, Fabio, Invitado) con pestaña **Sitio Web** |
| **API Docs** | `/docs` | Swagger UI de FastAPI |

---

## 4. Historial de Decisiones y Resoluciones
- **15-Sep-2026:**
  - Se descartó Compute Engine VM ($25/mes) y Cloud SQL (~$9/mes) para evitar costos fijos 24/7.
  - Se migró a Cloud Run + Cloud Storage + Neon PostgreSQL ($0.00 cuando no se usa).
  - Se solucionó el problema de imágenes faltantes en las pantallas: las fotos estaban archivadas en `snapshots/daily/mirror/frontend/public/images/`. Se copiaron a `frontend/public/images/` y se sincronizaron al bucket `gs://callejon-multimedia-pos`.
  - Se configuró el sistema de memoria persistente en `.agents/rules/` y `memory/chat-log.md` basado en el patrón de `MC-LARENS_ERP2`.

### [2026-09-15 14:45:12] Ajuste Visual: Desactivación de Overlay y Contorno Suave 5px con Fade-Out
- **Columna Central (Hero):**
  - Se removieron los overlays oscuros `bg-gradient-to-t` y `bg-gradient-to-r` que cubrían por completo la imagen del platillo destacado en `MenuBoardHero`.
  - Ahora las fotografías de platillos y bebidas se exhiben con brillo y contraste al 100%, tal como son en alta definición.
- **Tipografía y Legibilidad:**
  - Se reemplazó el contorno rígido con blur 0 por una función `heroTextStrokeStyle(5)` con contorno negro de 5px y **fade out progresivo** (dispersión suave de 0 a 12.5px).
  - La numeración (`#2`), nombre del platillo (`Canelones de carne`) y precio (`C$ 150.00`) ahora son 100% legibles sobre fondos claros u oscuros con acabado cinematográfico sin verse toscos.
  - Se optimizó también el contorno de las tarjetas laterales (`MenuBoardItem`).

### [2026-09-15 18:30:00] Corrección: Pantalla en blanco al subir fotos en Admin
- **Causa:** En `GestionarMenuPanel.jsx`, la función `handleImageUploaded` invocaba `imageForProductCard(r.codigo, r.tipo, newV)` pero dicha función no estaba importada desde `../lib/constants`, lanzando `ReferenceError: imageForProductCard is not defined` y desmontando React.
- **Solución:**
  - Se importó `imageForProductCard` en `GestionarMenuPanel.jsx` y se blindó el handler con comprobación de `targetCode` y `targetId`.
  - Se creó `AdminErrorBoundary.jsx` y se integró en `ControlCenterPage.jsx` para evitar caídas globales en el panel de administración ante cualquier error inesperado.

### [2026-09-15 18:48:00] Implementación: Sistema de Diagnóstico y Telemetría de Errores (Anti-Fallos en Silencio)
- **Inspiración:** Basado en el sistema de telemetría e instrumentación del ERP (`MC-LARENS_ERP2`).
- **Módulos Creados:**
  - `frontend/src/lib/diagnostics.js`: Captura automática de snapshots (error, stack, component stack, URL, usuario, viewport, buffer de últimas 10 peticiones API y eventos WebSocket). Análisis heurístico de causas (ReferenceError, TypeError, Network, etc.) con sugerencias de solución.
  - `frontend/src/components/CrashDiagnosticModal.jsx`: Pantalla interactiva con pestañas (Causa y Solución, Stack, Red/API, Entorno) y botón para copiar reporte en Markdown optimizado para IA/Desarrollador.
  - `frontend/src/components/GlobalErrorBoundary.jsx` & `SystemDiagnosticProvider.jsx`: Integrados en `App.jsx` para capturar tanto errores del ciclo de vida de React como excepciones asíncronas y promesas no manejadas en `window`.
  - Botón `🛠️ Diagnóstico` agregado al encabezado del Centro de Control (y atajo `Ctrl + Shift + D`) para inspección manual y preventiva.
  - Instrumentación en `lib/api.js` y `hooks/useWebSocket.js` para registrar telemetría de red.

### [2026-09-15 19:00:00] Despliegue a Producción y Pruebas en Vivo (Cloud Run)
- **Compilación Cloud Build:** `gcloud builds submit --tag gcr.io/gen-lang-client-0971793042/callejon-frontend:latest .` exitosa en 53s.
- **Despliegue Cloud Run:** Revisión `callejon-frontend-00008-xtj` activa en `us-central1`.

### [2026-09-15 20:45:00] Modo Smart TV Básico (Anti-Crash de RAM) y Diapositivas de TV4/TV6
- **Diagnóstico y Población de Diapositivas en TV4 (Parrilla) y TV6 (VIP Platillos):**
  - La fila `TV4` en la tabla `campanas_publicidad` de Neon DB tenía `slides: []` vacío, provocando el cartel «Sin diapositivas configuradas».
  - Se poblaron 7 diapositivas fotográficas de Parrilla para TV4 y 7 para TV6.
- **Implementación de Modo Smart TV Básico (Bajo Consumo de RAM):**
  - `frontend/src/pages/PantallaPublicidadPage.jsx`: Detección dual (`?lite=1`), omisión de video turn, 20s rígidos por imagen, reducción de DOM a un solo slide y desactivación de filtros GPU pesados.
  - `frontend/src/components/PublicidadAdminPanel.jsx`: Sección «⚡ Modo Smart TV Básico».

### [2026-09-15 22:20:00] Landing Page Turística Multilingüe (6 idiomas), Backoffice CMS y Despliegue en Vivo
- **Objetivo Cumplido:** Sitio web oficial para turistas y Google Maps, con cotizador de eventos a WhatsApp (`+505 8512 1494`) y backoffice CMS integrado en el Centro de Control de Pantallas.
- **Backend Centralizado y Eficiente:**
  - `backend/app/services/landing_page.py`: Estructura `DEFAULT_LANDING_CONFIG` basada en datos oficiales de WhatsApp Business (25 años de trayectoria, pioneros en buffet, catering, menú, precios NIO/USD). Lectura/escritura en PostgreSQL Neon en la tabla `config_sistema` (`clave='landing_page'`). Función `list_available_images()` para reusar imágenes de TV y menú sin duplicidad.
  - `backend/app/routers/landing.py`: Endpoints `GET /api/landing` (público), `PUT /api/landing` (CMS protegido), `GET /api/landing/imagenes` y `POST /api/landing/upload-image`.
  - `backend/app/main.py`: Montaje de `landing.router`.
- **Frontend Multilingüe (6 Idiomas) e Interactivo:**
  - `frontend/src/lib/landingTranslations.js`: Traducciones completas en Español (`es`), Inglés (`en`), Francés (`fr`), Italiano (`it`), Alemán (`de`) y Portugués (`pt`). Detección automática de idioma y selector con banderas.
  - `frontend/src/pages/LandingPage.jsx`: Hero gastronómico, Sobre Nosotros con 25 años de historia, Menú interactivo con selector C$/USD, Cotizador interactivo de bodas/15 años/cumpleaños que envía WhatsApp a `+505 8512 1494`, Galería de fotos del salón y Ubicación con Google Maps / Waze.
  - Rutas agregadas en `App.jsx`: `/restaurante`, `/bienvenidos`, `/web`, `/menu-web`.
  - Enlace con banner destacado en `HomePage.jsx` hacia `/restaurante`.
- **Backoffice CMS Integrado:**
  - `frontend/src/components/LandingPageAdminPanel.jsx`: Pestaña dedicada **🌐 Sitio Web** en `ControlCenterPage.jsx` para editar textos, precios, fotos, secciones y tipos de eventos desde el mismo panel de administración.
- **Git Repository:**
  - Commit `9632720` sincronizado y empujado a `https://github.com/Samuraimaid/el-callejon-pantallas.git`.
- **Despliegue a Producción (Google Cloud Run):**
  - **Frontend:** Revisión `callejon-frontend-00011-k8s` (Cloud Build ID `45db8264-c75a-49c2-adf5-64b83272428f`).
  - **Backend:** Revisión `callejon-backend-00007-ncv` (Cloud Build ID `90729269-27f6-481e-a70c-f01e1139313d`).
  - **URLs en Vivo:**
    - Landing Page: `https://callejon-frontend-836176703716.us-central1.run.app/restaurante`
    - Centro de Control CMS: `https://callejon-frontend-836176703716.us-central1.run.app/admin` (Pestaña "🌐 Sitio Web")
    - API de Configuración: `https://callejon-backend-836176703716.us-central1.run.app/api/landing`

### [2026-09-16 10:35:00] Seguridad y Autenticación con Usuario y Contraseña, Rediseño Visual Madera Roja y Carrusel en Landing Page
- **Auditoría y Robustecimiento de Seguridad (Usuario y Contraseña):**
  - Se evaluó la vulnerabilidad del sistema ante cambios de URL en el navegador:
    - Las rutas de pantallas (`/tv/*`, `/pantalla/*`) y la landing (`/restaurante`) son de acceso público de solo lectura por diseño.
    - El Centro de Control (`/admin`, `/login`) estaba protegido por un PIN de 4 dígitos (`2580`/`0000`) sin control granular de acceso.
  - **Reemplazo total de autenticación PIN por Usuario y Contraseña con Bcrypt:**
    - Se creó la migración `db/migrations/015_add_admin_users.sql` agregando columnas `password_hash`, `nombre`, `rol` (`admin` / `operador`) y eliminando la dependencia exclusiva de PIN plano.
    - Se sembraron los 3 usuarios del sistema (también integrados en `db/init/02_seed.sql`):
      1. **Marlon** (Rol: `admin`) — Contraseña: `Sazon de 25 años`
      2. **Fabio** (Rol: `admin`) — Contraseña: `El peluka sapbe`
      3. **Invitado** (Rol: `operador`) — Contraseña: `Cordon Blue 2026`
    - `backend/app/services/auth_bootstrap.py`: Verificación automática al arranque para asegurar la existencia de los 3 usuarios en base de datos.
    - `backend/app/routers/auth.py`: Endpoint `/api/auth/login` modificado para aceptar `LoginRequest(username, password)`. Emite token JWT con payload `{sub: usuario.username, rol: usuario.rol, nombre: usuario.nombre}`.
    - `frontend/src/lib/api.js` y `frontend/src/pages/LoginPage.jsx`: Rediseño del formulario con inputs de usuario y contraseña, selector para ver/ocultar contraseña y almacenamiento de sesión con rol.
- **Rediseño del Hero de la Landing Page:**
  - Se eliminó el globo flotante de comida y los badges informales ("Pollo", "Asados", "Camarones", "Costilla") para dotar al sitio de mayor seriedad y elegancia gastronómica.
  - Se implementó un **carrusel panorámico 16:9** idéntico a las pantallas de TV3 y TV4, con rotación automática suave cada 6 segundos, barra de progreso animada, botones de navegación anterior/siguiente, indicadores de diapositivas y textos descriptivos de cada plato/corte.
- **Estética Visual: Madera Roja / Caoba:**
  - Se eliminaron los contenedores y paddings de color marfil claro (`#fcf7ee`, etc.).
  - Se generó e integró la textura de madera caoba roja `frontend/public/images/madera-roja-card.jpg` combinada con gradientes profundos (`#1a0806`, `#280c09`), bordes ámbar dorados (`border-amber-700/40`) y tipografía clara con sombras suaves para todas las tarjetas (Sobre Nosotros, Menú, Eventos, Galería y Ubicación).
- **Ajuste Automático de Moneda según Idioma:**
  - Se eliminó el selector manual de precios (pill switch NIO/USD).
  - Los precios ahora se exhiben automáticamente en **Córdobas (`C$ NIO`)** cuando el idioma seleccionado es Español, y en **Dólares (`$ USD`)** para todos los demás idiomas (Inglés, Francés, Italiano, Alemán, Portugués).
- **Traducción Integral Multilingüe (6 Idiomas):**
  - Se corrigió el error de precedencia en `LandingPage.jsx` donde los textos estáticos del CMS en español sobrescribían el diccionario de traducciones.
  - Se completaron las traducciones para todos los encabezados, párrafos, diapositivas del carrusel, tarjetas de eventos, categorías gastronómicas y detalles de ubicación en `frontend/src/lib/landingTranslations.js` y `LandingPage.jsx`.
- **Aclaración Arquitectónica del Salón VIP:**
  - Se especificó de manera explícita en todos los idiomas que el **Salón VIP es el área exclusivamente climatizada con A/C**, mientras que el salón principal y comedor familiar ofrecen un ambiente fresco y tradicional al aire libre.
- **Validación y Estado:**
  - Compilación exitosa en `frontend` con `npm run build` en 9.23s (cero errores).
  - Verificación de sintaxis backend con `python -m py_compile` (código 0).

### [2026-09-16 13:05:00] Reparación de Creación de Productos, Resiembra Bcrypt y Despliegue en Vivo a Producción
- **Diagnóstico y Reparación de Creación de Productos (`backend/app/services/inventory.py`):**
  - **Error 1 (NameError):** `_json.dumps(dias_norm)` fallaba con `NameError: name '_json' is not defined` por falta de import a nivel de módulo.
    - *Solución:* Se agregó `import json as _json` en la cabecera de `backend/app/services/inventory.py`.
  - **Error 2 (AmbiguousParameterError en PostgreSQL / asyncpg):** Al crear productos con o sin días de semana, asyncpg arrojaba `could not determine data type of parameter $13` debido a la expresión SQL `CASE WHEN :dias_json IS NULL THEN NULL ELSE CAST(:dias_json AS jsonb) END`, donde la rama `IS NULL` impedía a Postgres inferir el tipo de dato preparado.
    - *Solución:* Se simplificó a `CAST(:dias_json AS jsonb)` en la sentencia `INSERT INTO productos_menu`. Si `:dias_json` es `None`, Postgres castea limpiamente a `NULL` de tipo `jsonb` sin ambigüedad.
- **Resiembra de Credenciales de Usuarios en Neon DB:**
  - Se detectó que la inserción previa de hashes había truncado el prefijo `$2b$12$` debido al escape en bash/psql.
  - Se generaron hashes Bcrypt genuinos de 60 caracteres y se sembraron exitosamente en Neon PostgreSQL:
    - **Marlon** (`admin`): `Sazon de 25 años`
    - **Fabio** (`admin`): `El peluka sapbe`
    - **Invitado** (`operador`): `Cordon Blue 2026`
- **Despliegue a Producción (Google Cloud Run):**
  - **Frontend:** Revisión `callejon-frontend-00019-f5l` (Cloud Build `fdccb985-8ddb-423d-8fe0-a6ecda58d510`).
  - **Backend:** Revisión `callejon-backend-00011-4x7` (Cloud Build `caeab156-3fa6-4447-a16a-0320fb38395f`).
- **Verificación en Vivo (100% Exitosa):**
  - Autenticación vía proxy `/api/auth/login` probada para `Marlon`, `Fabio` e `Invitado`.
  - Creación y eliminación de productos de prueba probada en vivo por API tanto con días específicos (`[1, 2, 3, 4, 5]`) como con días nulos (`None`).
  - Landing page turística `/restaurante` respondiendo 200 OK con el carrusel 16:9, diseño de madera roja caoba y selector automático de moneda.

### [2026-09-16 14:05:00] Cargador de Fotos al Crear Platillos, Respaldos en Google Cloud Storage y Login Seguro
- **1. Cargador de Fotos con Retoque al Crear Platillos:**
  - `frontend/src/components/ImageCropUploadModal.jsx`: Soporte para prop `onCaptureProductImage`, permitiendo recortar (Hero 1:1, Card horizontal) y aplicar retoques/remoción de fondo con IA antes de guardar el producto.
  - `frontend/src/components/GestionarMenuPanel.jsx`:
    - Caja de selección de fotografía integrada en el formulario modal «Nuevo Platillo».
    - Previsualización en vivo de la foto seleccionada con botones «Reajustar recorte» y «Quitar foto».
    - Al oprimir «Crear Platillo», primero se crea el registro en la base de datos y de inmediato se envía el blob a `/api/productos/{id}/imagen`, quedando el platillo con su foto activa al instante.
- **2. Gestión de Respaldos en Google Cloud Storage (GCS) y Descarga Manual ZIP:**
  - `backend/app/services/cloud_backup.py`:
    - Servicio que genera volcado de tablas PostgreSQL (`usuarios`, `productos_menu`, `campanas_publicidad`, `config_sistema`) a JSON y SQL.
    - Empaqueta el archivo ZIP directamente en el volumen GCSFuse `/app/static/images/backups/`, persistiendo en `gs://callejon-multimedia-pos/backups/`.
    - Endpoints actualizados en `backend/app/routers/backup.py`:
      - `POST /api/backup/run`: Generación manual o programada de respaldo en GCS.
      - `GET /api/backup/status` y `GET /api/backup/history`: Listado y tamaño de respaldos en la nube.
      - `GET /api/backup/download/{filename}` y `GET /api/backup/download-now`: Descarga directa en el navegador en formato ZIP.
  - `frontend/src/components/BackupPanel.jsx` & `frontend/src/lib/api.js`:
    - Rediseño con destino visible `gs://callejon-multimedia-pos/backups`.
    - Botones «☁️ Hacer respaldo en Google Cloud» y «📥 Descargar respaldo manual (ZIP)».
    - Historial con botón de descarga individual por archivo.
- **3. Limpieza de Pantalla de Login:**
  - `frontend/src/pages/LoginPage.jsx`: Se eliminó el placeholder `"Ej. Marlon, Fabio o Invitado"`, reemplazándolo por `"Ingrese su usuario"`.
- **4. Despliegue a Producción (Google Cloud Run):**
  - **Frontend:** Revisión `callejon-frontend-00020-bk8` (Cloud Build `8d03fa36-e949-48a0-9e8f-477a9c1f3c49`).
  - **Backend:** Revisión `callejon-backend-00012-z8p` (Cloud Build `a6a83095-fe3e-4634-aaef-a44c5b13baa1`).
- **5. Verificación en Vivo (100% Exitosa):**
  - Bundle frontend verificado: `placeholder="Ingrese su usuario"` activo, no expone credenciales ni nombres.
  - Generación de respaldo en la nube probada: `POST /api/backup/run` generó `backup_callejon_2026-09-16_200325.zip` (24 KB) con 369 archivos multimedia y tablas completas.
  - Descarga manual ZIP probada: `GET /api/backup/download-now` devolvió 200 OK con Content-Type `application/zip`.
  - Creación de platillo + subida de imagen probada en vivo por API y confirmada sin errores.

### [2026-09-16 14:18:00] Reparación de ReferenceError: setShowPrices en LandingPage (/restaurante)
- **Causa:** En `frontend/src/pages/LandingPage.jsx`, un `useEffect` residual ejecutaba `setShowPrices(Boolean(config.info_general.mostrar_precios))` al cargar la configuración del landing. Al removerse previamente el switch manual de precios a favor del cálculo automático de moneda (`C$` para español, `USD` para otros idiomas), la función `setShowPrices` había quedado sin declarar.
- **Solución:**
  - Se eliminaron la variable huérfana y el `useEffect` residual en [LandingPage.jsx](file:///c:/EL_CALLEJON_POS/frontend/src/pages/LandingPage.jsx).
  - Se ejecutó escaneo exhaustivo de identificadores y setters no declarados en todo el frontend para descartar problemas similares.
  - Se recompiló el frontend y se generó una nueva imagen en Google Cloud Build (`e18e5bd2-3aac-47ae-bc66-d38c691de847`).
  - Se desplegó la revisión `callejon-frontend-00021-k26` en Google Cloud Run.
- **Verificación en Vivo:**
  - Se verificó el bundle activo `/assets/index-zmSuot8l.js`: `setShowPrices` eliminado al 100%.
  - La página `/restaurante` carga limpia y correctamente en producción.


