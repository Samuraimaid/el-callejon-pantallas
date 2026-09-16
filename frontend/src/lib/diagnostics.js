import { getUser } from "./auth";

/**
 * Sistema de Diagnóstico y Telemetría de Fallos — El Callejón POS
 * Captura snapshots completos de cualquier error (render, asíncrono, API, WS)
 * para que ningún fallo ocurra en silencio y cualquier bug sea trivial de solucionar.
 */

const STORAGE_KEY = "callejon:last_crash_snapshot";
const MAX_API_LOGS = 10;
const MAX_WS_LOGS = 10;

// Buffers en memoria
if (typeof window !== "undefined") {
  window.__RECENT_API_LOGS__ = window.__RECENT_API_LOGS__ || [];
  window.__RECENT_WS_LOGS__ = window.__RECENT_WS_LOGS__ || [];
  window.__LAST_SYSTEM_ERROR__ = window.__LAST_SYSTEM_ERROR__ || null;
}

/**
 * Registra una llamada API en el historial de diagnóstico
 */
export function recordApiLog(entry) {
  if (typeof window === "undefined") return;
  const item = {
    time: new Date().toLocaleTimeString(),
    ts: Date.now(),
    ...entry,
  };
  window.__RECENT_API_LOGS__.unshift(item);
  if (window.__RECENT_API_LOGS__.length > MAX_API_LOGS) {
    window.__RECENT_API_LOGS__.pop();
  }
}

/**
 * Registra un evento WebSocket en el historial de diagnóstico
 */
export function recordWsLog(event) {
  if (typeof window === "undefined") return;
  const item = {
    time: new Date().toLocaleTimeString(),
    ts: Date.now(),
    event,
  };
  window.__RECENT_WS_LOGS__.unshift(item);
  if (window.__RECENT_WS_LOGS__.length > MAX_WS_LOGS) {
    window.__RECENT_WS_LOGS__.pop();
  }
}

/**
 * Analiza la causa probable y sugiere una solución para el error
 */
export function analyzeErrorCause(error, componentStack = "") {
  const msg = String(error?.message || error || "");
  const name = String(error?.name || "Error");
  const stack = String(error?.stack || "");

  if (name === "ReferenceError" || msg.includes("is not defined")) {
    const varMatch = msg.match(/([a-zA-Z0-9_$]+) is not defined/);
    const varName = varMatch ? varMatch[1] : "la variable";
    return {
      type: "MISSING_IMPORT_OR_VARIABLE",
      title: `Referencia no definida: «${varName}»`,
      description: `Se intentó usar «${varName}» pero no está importada o declarada en el archivo.`,
      solution: `Verifica los 'import' en la cabecera del archivo donde se produjo el error y asegúrate de importar «${varName}» desde su módulo correspondiente.`,
    };
  }

  if (name === "TypeError" && (msg.includes("cannot read") || msg.includes("is undefined") || msg.includes("null"))) {
    return {
      type: "NULL_POINTER",
      title: "Acceso a propiedad de objeto nulo/indefinido",
      description: msg,
      solution: "Aplica encadenamiento opcional (?.) o valida que el objeto exista antes de acceder a sus propiedades (ej. 'item?.propiedad || fallback').",
    };
  }

  if (msg.includes("NetworkError") || msg.includes("Failed to fetch") || msg.includes("HTTP 5")) {
    return {
      type: "NETWORK_OR_SERVER_ERROR",
      title: "Fallo de conexión o error en servidor",
      description: msg,
      solution: "Comprueba si el backend en Cloud Run o local está activo, si hay problemas de CORS, o si la base de datos Neon PostgreSQL está disponible.",
    };
  }

  if (msg.includes("HTTP 401") || msg.includes("HTTP 403")) {
    return {
      type: "AUTH_ERROR",
      title: "Sesión expirada o no autorizada",
      description: msg,
      solution: "El token JWT expiró o el PIN es inválido. Vuelve a iniciar sesión en /login con el PIN correcto.",
    };
  }

  if (stack.includes("ImageCropUploadModal") || stack.includes("GestionarMenuPanel")) {
    return {
      type: "MENU_MEDIA_FLOW",
      title: "Fallo en flujo de catálogo / imágenes",
      description: msg,
      solution: "Revisa la respuesta del servidor en /api/productos/{id}/imagen y la función handleImageUploaded.",
    };
  }

  return {
    type: "GENERIC_RUNTIME_ERROR",
    title: name,
    description: msg || "Error en tiempo de ejecución sin mensaje detallado.",
    solution: "Revisa la traza de la pila (stack trace) adjunta abajo para identificar la línea y componente exacto.",
  };
}

/**
 * Genera un Snapshot completo del entorno en el momento del fallo
 */
export function createCrashSnapshot(error, componentStack = "", extraContext = {}) {
  const now = new Date();
  const user = getUser();
  const analysis = analyzeErrorCause(error, componentStack);

  const snapshot = {
    id: `crash-${Date.now()}`,
    timestamp: now.toISOString(),
    localTime: now.toLocaleString("es-NI", { timeZoneName: "short" }),
    error: {
      name: error?.name || "Error",
      message: error?.message || String(error),
      stack: error?.stack || "",
    },
    componentStack: componentStack || "",
    analysis,
    environment: {
      url: typeof window !== "undefined" ? window.location.href : "",
      pathname: typeof window !== "undefined" ? window.location.pathname : "",
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      user: user ? { id: user.id || user.codigo, nombre: user.nombre, rol: user.rol } : null,
    },
    recentApiLogs: typeof window !== "undefined" ? [...(window.__RECENT_API_LOGS__ || [])].slice(0, 5) : [],
    recentWsLogs: typeof window !== "undefined" ? [...(window.__RECENT_WS_LOGS__ || [])].slice(0, 5) : [],
    extraContext,
  };

  if (typeof window !== "undefined") {
    window.__LAST_SYSTEM_ERROR__ = snapshot;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* ignore storage quota errors */
    }
  }

  return snapshot;
}

/**
 * Recupera el último snapshot guardado
 */
export function getLastCrashSnapshot() {
  if (typeof window === "undefined") return null;
  if (window.__LAST_SYSTEM_ERROR__) return window.__LAST_SYSTEM_ERROR__;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Formatea el snapshot en Markdown limpio y estructurado listo para copiar y enviar a la IA o programador
 */
export function formatSnapshotForClipboard(snapshot) {
  if (!snapshot) return "No hay diagnóstico disponible.";
  const { error, analysis, environment, componentStack, recentApiLogs, recentWsLogs, localTime } = snapshot;

  return `### 🚨 REPORTE DE ERROR / CRASH SNAPSHOT - EL CALLEJÓN POS
**Fecha y Hora:** ${localTime}
**Ruta / Pantalla:** \`${environment.pathname}\` (URL: ${environment.url})
**Operador:** ${environment.user ? `${environment.user.nombre} (${environment.user.rol || 'staff'})` : 'No autenticado'}
**Dispositivo / Resolución:** ${environment.viewport} · ${environment.online ? 'En línea' : 'Sin conexión'}

---

#### 💥 Error Detectado:
- **Tipo:** \`${error.name}\`
- **Mensaje:** **\`${error.message}\`**
- **Diagnóstico sugerido:** ${analysis.title}
- **Causa probable:** ${analysis.description}
- **Acción recomendada:** ${analysis.solution}

${componentStack ? `#### 🧩 Pila de Componentes React:\n\`\`\`text\n${componentStack.trim()}\n\`\`\`\n` : ''}

#### 📜 Stack Trace Completo:
\`\`\`javascript
${error.stack || 'No stack trace disponible'}
\`\`\`

#### 🌐 Últimas Peticiones API:
${
  recentApiLogs.length
    ? recentApiLogs
        .map(
          (l) =>
            `- \`[${l.time}]\` **${l.method || 'REQ'}** \`${l.path}\` → Status: \`${l.status || 'pendiente'}\``
        )
        .join("\n")
    : "- Sin llamadas registradas recientemente."
}

#### ⚡ Últimos Mensajes WebSocket:
${
  recentWsLogs.length
    ? recentWsLogs.map((w) => `- \`[${w.time}]\` Tipo: \`${w.event?.t || 'desconocido'}\``).join("\n")
    : "- Sin eventos recientes."
}
`;
}

/**
 * Instala escuchadores globales en 'window' para capturar fallos no manejados
 * en eventos asíncronos, botones, promesas y setTimeout que escapan al ErrorBoundary de React.
 */
let installed = false;
export function installGlobalDiagnostics(onFatalCrash) {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  // Errores de script / runtime no capturados
  window.addEventListener("error", (event) => {
    // Ignorar errores triviales de extensiones de navegador
    if (event.filename && (event.filename.includes("chrome-extension") || event.filename.includes("moz-extension"))) {
      return;
    }
    const error = event.error || new Error(event.message || "Error no controlado");
    const snapshot = createCrashSnapshot(error, "", {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    console.error("[Diagnóstico El Callejón] Error global capturado:", snapshot);
    onFatalCrash?.(snapshot);
  });

  // Promesas rechazadas no manejadas (async/await sin try-catch)
  window.addEventListener("unhandledrejection", (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(typeof event.reason === "string" ? event.reason : JSON.stringify(event.reason || "Rechazo de promesa no controlado"));
    const snapshot = createCrashSnapshot(error, "", {
      source: "unhandledrejection",
    });
    console.error("[Diagnóstico El Callejón] Rechazo de promesa capturado:", snapshot);
    onFatalCrash?.(snapshot);
  });
}
