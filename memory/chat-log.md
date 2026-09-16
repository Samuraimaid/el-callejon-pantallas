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
- **Google Cloud Project ID:** `gen-lang-client-0971793042` (Gemini Project, Project Number: `836176703716`).
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
| Pantalla | Ruta | Descripción |
|---|---|---|
| **Hub / Lobby** | `/` | Vista de inicio con accesos rápidos |
| **TV #1** | `/tv/1` o `/pantalla/comidas` | Menú comidas 50" (platillos + extras + hero rotativo) |
| **TV #2** | `/tv/2` o `/pantalla/complementos` | Complementos y bebidas 50" (jugos, sodas, cafés) |
| **TV #3** | `/tv/3` | Publicidad Barra (bebidas / picadas) |
| **TV #4** | `/tv/4` | Publicidad Parrilla (asados) |
| **TV #5** | `/tv/5` | Publicidad VIP ambiente |
| **TV #6** | `/tv/6` | Publicidad VIP platillos |
| **Admin Panel** | `/admin` o `/login` | Centro de Control (PIN inicial: `2580`) |
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
- **Compilación Cloud Build:** `gcloud builds submit --tag gcr.io/gen-lang-client-0971793042/callejon-frontend:latest .` exitosa en 53s (Vite 6.4.3 empaquetado en 3.85s, Nginx Alpine).
- **Despliegue Cloud Run:** Revisión `callejon-frontend-00008-xtj` activa en `us-central1`, enrutando el 100% del tráfico a `https://callejon-frontend-836176703716.us-central1.run.app`.
- **Verificaciones en Vivo:**
  - HTML & Assets HTTP 200 OK (`index-DCgdNu4L.js` y `index-DR40NTGR.css`).
  - Bundle contiene los módulos de diagnóstico (`callejon:last_crash_snapshot` y botón `🛠️ Diagnóstico`).
  - Autenticación con PIN (`0000`) confirmada: retorno de 67 productos del menú.
  - Endpoint de sincronización WebSocket (`/api/productos/sincronizar`) verificado: emite evento a TVs con éxito.
  - Menú público para Smart TVs (`/api/productos/menu`): 12 platillos, 9 extras, 5 jugos, 20 bebidas devueltos correctamente.
### [2026-09-15 20:15:00] Control de Tipografías en Smart TVs y Corrección de Edición de Precios
- **Corrección de Entrada de Precios (`GestionarMenuPanel.jsx`):**
  - Se eliminó el reseteo inmediato a `0` al borrar caracteres con Backspace que provocaba que se agregaran ceros a la izquierda (ej. `045`).
  - Se agregó `onFocus={(e) => e.target.select()}` a los campos de `precio` y `stock` para permitir sobreescribir el valor con solo teclear el nuevo monto.
- **Ajuste Dinámico de Tipografía para Smart TVs:**
  - `backend/app/services/config_menu.py`: Agregado `fontScale` (70%-160%) y tamaños individuales en píxeles (`cardNameSizePx`, `cardPriceSizePx`, `cardNumSizePx`, `heroNameSizePx`, `heroPriceSizePx`, `heroNumSizePx`, `heroBadgeSizePx`, `clockSizePx`, `marqueeSizePx`, `colTitleSizePx`) a `DEFAULT_LAYOUT` y `_clean_layout`.
  - `frontend/src/components/MenuBoardConfigPanel.jsx`: Creado el panel interactivo `TypographySection` con sub-pestañas (Zoom Maestro, Tarjetas Laterales, Platillo Hero, Cabecera), presets rápidos, botón de restablecer a estándar y mini-previsualizador en tiempo real.
  - `frontend/src/components/tv/MenuBoard.jsx`, `MenuBoardScreen.jsx` & `PromoMarquee.jsx`: Inyección dinámica de tamaños calculados vía `fontScale`.
- **Despliegue y Validación en Cloud Run:**
  - Backend `callejon-backend-00005-6dh` y Frontend `callejon-frontend-00009-7kf` desplegados y sirviendo el 100% del tráfico.
  - Verificado en vivo que la API persiste los nuevos valores y el bundle `index-Bi4rODbu.js` incluye los componentes actualizados.
