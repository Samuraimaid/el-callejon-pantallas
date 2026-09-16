import { Component } from "react";
import { createCrashSnapshot, formatSnapshotForClipboard } from "../lib/diagnostics";
import CrashDiagnosticModal from "./CrashDiagnosticModal";

/**
 * Captura errores en las pestañas del panel de administración
 * Mantiene la barra de navegación activa, genera un snapshot de diagnóstico
 * y permite copiar el reporte o ver la traza técnica completa.
 */
export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      snapshot: null,
      showModal: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Error en el panel") };
  }

  componentDidCatch(error, info) {
    const snapshot = createCrashSnapshot(error, info?.componentStack || "", {
      panel: this.props.name || "AdminTab",
    });
    this.setState({ snapshot, error });
    console.error("[AdminErrorBoundary] Fallo en panel capturado:", snapshot);
  }

  handleReset = () => {
    this.setState({ error: null, snapshot: null, showModal: false, copied: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopy = async () => {
    if (!this.state.snapshot) return;
    try {
      const text = formatSnapshotForClipboard(this.state.snapshot);
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }
  };

  render() {
    if (this.state.error) {
      const { snapshot, showModal, copied } = this.state;
      const analysis = snapshot?.analysis;

      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-4 sm:p-6 text-center text-ivory">
          <div className="max-w-lg rounded-2xl border border-rose-500/60 bg-stone-950/95 p-6 shadow-2xl backdrop-blur">
            <div className="flex justify-center mb-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-2xl text-rose-400 ring-1 ring-rose-500/40">
                🚨
              </span>
            </div>

            <h2 className="text-lg font-bold text-rose-100">
              Fallo detectado en esta sección
            </h2>

            <p className="mt-2 text-xs text-rose-300 font-mono bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/40 break-words text-left">
              {String(this.state.error?.message || this.state.error)}
            </p>

            {analysis && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-left">
                <p className="text-[11px] font-bold text-amber-300 uppercase">
                  💡 Causa probable:
                </p>
                <p className="mt-0.5 text-xs text-stone-300">
                  {analysis.title} — {analysis.description}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={this.handleCopy}
                className={`tap rounded-xl px-4 py-2.5 text-xs font-bold transition shadow ${
                  copied
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                    : "bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 hover:brightness-110"
                }`}
              >
                {copied ? "✅ ¡Diagnóstico copiado!" : "📋 Copiar snapshot para IA"}
              </button>

              <button
                type="button"
                onClick={() => this.setState({ showModal: true })}
                className="tap rounded-xl border border-stone-700 bg-stone-800 px-3.5 py-2.5 text-xs font-semibold text-stone-200 hover:bg-stone-700"
              >
                🔍 Ver detalles y Stack
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="tap rounded-xl border border-stone-600 bg-stone-900 px-3.5 py-2.5 text-xs font-bold text-stone-300 hover:bg-stone-800"
              >
                🔄 Reintentar
              </button>
            </div>
          </div>

          {showModal && snapshot && (
            <CrashDiagnosticModal
              snapshot={snapshot}
              onClose={() => this.setState({ showModal: false })}
              onRetry={this.handleReset}
            />
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
