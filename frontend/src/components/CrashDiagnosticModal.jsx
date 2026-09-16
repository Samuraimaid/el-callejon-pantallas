import { useState } from "react";
import { formatSnapshotForClipboard } from "../lib/diagnostics";

/**
 * Pantalla / Modal de Diagnóstico y Snapshot de Fallos
 * Permite ver exactamente qué falló, dónde, por qué, y copiar un reporte completo para la IA o el desarrollador.
 */
export default function CrashDiagnosticModal({
  snapshot,
  onRetry,
  onClose,
  isFatal = false,
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // summary | stack | network | env
  const [showRaw, setShowRaw] = useState(false);

  if (!snapshot) return null;

  const { error, analysis, environment, componentStack, recentApiLogs, recentWsLogs, localTime } = snapshot;

  const handleCopy = async () => {
    try {
      const text = formatSnapshotForClipboard(snapshot);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual
      const textarea = document.createElement("textarea");
      textarea.value = formatSnapshotForClipboard(snapshot);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `callejon-crash-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleReloadClean = () => {
    try {
      window.sessionStorage.clear();
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-rose-500/60 bg-stone-950 text-stone-100 shadow-2xl">
        {/* Encabezado */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-800 bg-rose-950/40 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-xl text-rose-400 ring-1 ring-rose-500/40">
              🚨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-rose-100 sm:text-lg">
                  Diagnóstico de Fallo en Sistema
                </h2>
                <span className="rounded-full bg-rose-900/60 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-700/50 uppercase">
                  {error.name || "Error"}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Snapshot capturado en {localTime} · {environment.pathname || "Ruta"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isFatal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white"
                title="Cerrar ventana de diagnóstico"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Mensaje de error destacado */}
        <div className="border-b border-stone-800/80 bg-black/30 px-4 py-3 sm:px-6">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Mensaje del error:
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-rose-200 break-words">
              {error.message || String(error)}
            </p>
          </div>
        </div>

        {/* Barra de pestañas */}
        <div className="flex shrink-0 gap-1 border-b border-stone-800 bg-stone-900/50 px-4 py-2">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "summary"
                ? "bg-amber-600 text-stone-950 shadow"
                : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            💡 Causa y Solución
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stack")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "stack"
                ? "bg-amber-600 text-stone-950 shadow"
                : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            🧭 Dónde ocurrió (Stack)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("network")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "network"
                ? "bg-amber-600 text-stone-950 shadow"
                : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            🌐 Red y API ({recentApiLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("env")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "env"
                ? "bg-amber-600 text-stone-950 shadow"
                : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            💻 Entorno y Dispositivo
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === "summary" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                  <span>🔍</span> Diagnóstico Asistido: {analysis.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-300">
                  {analysis.description}
                </p>
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-black/40 p-3">
                  <p className="text-[11px] font-semibold uppercase text-amber-400">
                    🛠️ Cómo solucionarlo:
                  </p>
                  <p className="mt-1 text-xs text-amber-100/90 leading-relaxed font-mono">
                    {analysis.solution}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
                  <span className="text-stone-400">Pantalla afectada:</span>
                  <p className="mt-1 font-semibold text-stone-100 break-words">
                    {environment.pathname}
                  </p>
                </div>
                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3">
                  <span className="text-stone-400">Usuario activo:</span>
                  <p className="mt-1 font-semibold text-stone-100">
                    {environment.user ? `${environment.user.nombre} (${environment.user.rol || "staff"})` : "Sin sesión"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "stack" && (
            <div className="space-y-3">
              {componentStack && (
                <div>
                  <p className="text-xs font-semibold text-amber-300 mb-1.5">
                    🧩 Pila de Componentes React:
                  </p>
                  <pre className="max-h-40 overflow-x-auto rounded-xl border border-stone-800 bg-stone-950 p-3 font-mono text-[11px] leading-relaxed text-stone-300">
                    {componentStack}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-rose-300 mb-1.5">
                  📜 Traza de Ejecución JavaScript (Stack Trace):
                </p>
                <pre className="max-h-60 overflow-x-auto rounded-xl border border-stone-800 bg-stone-950 p-3 font-mono text-[11px] leading-relaxed text-stone-300">
                  {error.stack || "No se capturó stack trace."}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "network" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
                  Últimas Peticiones al Backend (FastAPI):
                </h4>
                {recentApiLogs.length === 0 ? (
                  <p className="text-xs text-stone-500 py-3 text-center">
                    No hay peticiones API registradas en esta sesión.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recentApiLogs.map((log, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-900/70 px-3 py-2 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] text-stone-500">{log.time}</span>
                          <span className="font-bold text-amber-400">{log.method || "REQ"}</span>
                          <span className="truncate text-stone-200">{log.path}</span>
                        </div>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            log.status >= 400
                              ? "bg-rose-900 text-rose-200"
                              : "bg-emerald-950 text-emerald-300"
                          }`}
                        >
                          {log.status || "OK"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
                  Últimos Mensajes WebSocket:
                </h4>
                {recentWsLogs.length === 0 ? (
                  <p className="text-xs text-stone-500 py-2 text-center">
                    No hay eventos WebSocket recientes.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {recentWsLogs.map((ws, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-stone-800/80 bg-stone-900/50 px-3 py-1.5 text-[11px] font-mono"
                      >
                        <span className="text-stone-500">{ws.time}</span>
                        <span className="text-amber-300">Tipo: {ws.event?.t || "evento"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "env" && (
            <div className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-2.5">
                  <span className="text-stone-400 block text-[10px]">Resolución / Pantalla:</span>
                  <span className="text-stone-100 font-bold">{environment.viewport}</span>
                </div>
                <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-2.5">
                  <span className="text-stone-400 block text-[10px]">Estado de Conexión:</span>
                  <span className={environment.online ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {environment.online ? "Online (Conectado)" : "Offline (Desconectado)"}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-2.5">
                <span className="text-stone-400 block text-[10px]">Navegador (User-Agent):</span>
                <span className="text-stone-300 break-all text-[11px]">{environment.userAgent}</span>
              </div>
            </div>
          )}

          {/* Opción para ver JSON Crudo */}
          <div className="pt-2 border-t border-stone-800/60">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-[11px] text-stone-500 hover:text-stone-300 underline"
            >
              {showRaw ? "Ocultar snapshot JSON crudo" : "Ver snapshot JSON crudo completo"}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-40 overflow-x-auto rounded-lg border border-stone-800 bg-black p-2 font-mono text-[10px] text-stone-400">
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Pie de acciones */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-stone-800 bg-stone-900 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={`tap flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-lg ${
                copied
                  ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                  : "bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 hover:brightness-110"
              }`}
            >
              <span>{copied ? "✅" : "📋"}</span>
              <span>{copied ? "¡Copiado para la IA!" : "Copiar Diagnóstico para IA / Dev"}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="tap rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-xs font-semibold text-stone-300 hover:bg-stone-700"
              title="Descargar snapshot JSON"
            >
              💾 JSON
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="tap rounded-xl border border-stone-600 bg-stone-800 px-4 py-2.5 text-xs font-bold text-stone-100 hover:bg-stone-700"
              >
                🔄 Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={handleReloadClean}
              className="tap rounded-xl bg-stone-800 px-4 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-950 hover:text-rose-100 border border-rose-800/40"
            >
              🔃 Recargar limpia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
