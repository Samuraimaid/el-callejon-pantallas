# Regla Canónica: Gobernanza de Costos Cloud, Control de Recursos y Prevención de Picos de Facturación

Esta regla es de cumplimiento **ESTRICTO Y OBLIGATORIO** para cualquier agente de IA o desarrollador que opere en este repositorio o interactúe con los servicios de Google Cloud (GCP) vinculados al proyecto.

---

## 1. Contexto Operativo del Proyecto
- **Negocio:** Pantallas de menú digital y publicidad para restaurante ("El Callejón").
- **Horario de Operación Real:** 11:30 AM a 3:00 PM (Lunes a Domingo, ~3.5 horas al día = ~105 horas al mes).
- **Meta Financiera:** Costo mensual cercano a **$0.00 - $1.00 USD/mes**, operando estrictamente dentro de la **Capa Gratuita (Free Tier)** de Google Cloud Run (100 horas de 1 vCPU gratis al mes y 2 millones de peticiones gratuitas).

---

## 2. Reglas Inviolables de Infraestructura en Google Cloud Run

### 2.1. Dimensionamiento de Hardware (CPU y Memoria)
- **CPU Máxima Permitida:** **`1 vCPU`** por servicio (`callejon-backend`, `callejon-frontend`).
  - ⛔ **QUEDA ESTRICTAMENTE PROHIBIDO** asignar `2 vCPUs` o más sin autorización explícita y escrita del usuario. Asignar 2 vCPUs duplica el cobro por segundo y agota el Free Tier en la primera quincena.
- **Memoria Máxima Permitida:** **`1 GiB`** para el backend (suficiente para FastAPI y GCSFuse) y **`512 MiB`** para el frontend.
- **Escalado a Cero Obligatorio (`min-instances = 0`):**
  - Todo servicio debe tener configurado `min-instances=0`. No se permite fijar `min-instances >= 1` bajo ninguna circunstancia. Fuera del horario de operación (3:00 PM a 11:30 AM), las instancias deben apagarse por completo.
- **CPU Throttling Activo:**
  - El flag `--cpu-throttling` debe estar siempre habilitado para que la CPU se congele cuando no haya peticiones HTTP activas procesándose.

---

## 3. Reglas de Código en Clientes y Pantallas (Frontend / Scripts)

### 3.1. Frecuencia de Heartbeats y Polling HTTP
- **Intervalo Mínimo de Heartbeat:** Los pings de telemetría hacia `/api/pantallas/{tv_id}/heartbeat` o APIs de estado **NUNCA deben ejecutarse con intervalos inferiores a 15 segundos** (el intervalo recomendado es de 15s a 30s).
- ⛔ **PROHIBIDO:** Pings o consultas HTTP en bucles rápidos (1s, 2s, 4s, 5s) desde clientes o navegadores desatendidos, ya que impiden que Cloud Run suspenda el contenedor y generan tráfico artificial continuo.
- **Arquitectura Offline-First:** Las pantallas deben renderizar y rotar contenido desde la caché local del navegador. Ninguna animación o transición debe bloquearse esperando respuestas del servidor.

---

## 4. Gobernanza sobre APIs de IA Generativa (Gemini / Vertex AI / Tokens)

- ⛔ **PROHIBIDO** incorporar llamadas automáticas o desatendidas en bucle a modelos de IA generativa (Gemini 1.5 Pro, Flash, Imagen, Embeddings) sin límite estricto de presupuesto y control de concurrencia.
- Cualquier funcionalidad asistida por IA debe:
  1. Estar protegida por autenticación y permisos de administrador.
  2. Tener un límite de gasto diario o cuota máxima en Google Cloud Console.
  3. Manejar reintentos con backoff exponencial y un máximo de 2 intentos en caso de error 429/500.

---

## 5. Prevención de Bucles en Automatizaciones y Tareas Programadas

- **Cloud Scheduler / Cron Jobs:**
  - Ningún trabajo automatizado debe sondear servicios de Cloud Run con frecuencias extremas (ej. cada 1 o 5 minutos las 24 horas del día), a menos que el servicio cuente con mecanismos estrictos de auto-apagado.
  - Toda tarea en segundo plano debe tener timeout máximo configurado (ej. <= 60s) y tolerancia a fallos sin reintentos infinitos.

---

## 6. Lista de Verificación Previa a Cualquier Despliegue (`Pre-Deploy Checklist`)

Antes de ejecutar cualquier comando de despliegue (`gcloud run deploy` o `gcloud run services update`), el agente debe verificar:
1. `cpu` == 1
2. `memory` <= 1Gi
3. `min-instances` == 0
4. `cpu-throttling` == true
5. URLs públicas y rutas no se alteran (`callejon-backend-...`, `callejon-frontend-...`).
