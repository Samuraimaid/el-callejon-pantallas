# Regla: Memoria Persistente de Sesión y Prevención de Bucles

## 1. Memoria Local Persistente (`memory/chat-log.md`)
- Ante cada hito importante, decisión arquitectónica, despliegue, configuración de base de datos o resolución de errores, el asistente **debe registrar un resumen conciso en `memory/chat-log.md`**.
- Al iniciar cualquier nueva conversación, el asistente **debe leer primero `memory/chat-log.md`** para recuperar de inmediato el contexto completo del proyecto, la infraestructura en la nube, las URLs y el historial previo.

## 2. Prevención de Bucles Infinitos
- **Límite de Reintentos:** Si una acción o comando falla 2 veces consecutivas con el mismo error, **NO** reintentar automáticamente en bucle. Detenerse, analizar la causa raíz o solicitar clarificación/feedback.
- **Verificación de Salida:** Siempre validar el código de retorno y los mensajes de error antes de proceder con el siguiente paso.
- **Sin Polling Ciego:** Nunca ejecutar comandos en bucle infinito (`while true`) o polling sin límite de tiempo o condición de parada clara.
