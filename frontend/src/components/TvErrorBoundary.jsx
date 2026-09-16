import { Component } from "react";
import { createCrashSnapshot, formatSnapshotForClipboard } from "../lib/diagnostics";
import CrashDiagnosticModal from "./CrashDiagnosticModal";

/**
 * Evita pantalla blanca/vacía si un componente de Smart TV revienta al renderizar.
 * Registra un snapshot de diagnóstico completo y permite inspeccionar la causa o auto-recargar.
 */
export default class TvErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      snapshot: null,
      ticks: 0,
      showModal: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Error de pantalla") };
  }

  componentDidCatch(error, info) {
    const snapshot = createCrashSnapshot(error, info?.componentStack || "", {
      role: "SmartTV",
      path: typeof window !== "undefined" ? window.location.pathname : "",
    });
    this.setState({ snapshot, error });
    console.error("[TvErrorBoundary] Crash en Smart TV capturado:", snapshot);
  }

  componentDidMount() {
    this._id = window.setInterval(() => {
      this.setState((s) => {
        const ticks = (s.ticks || 0) + 1;
        if (ticks >= 12 && s.error) {
          // Auto-recarga a los ~60s
          window.location.reload();
        }
        return { ticks };
      });
    }, 5000);
  }

  componentWillUnmount() {
    window.clearInterval(this._id);
  }

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
      return (
        <div
          className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#1a0f0a] px-8 text-center text-ivory"
          role="alert"
        >
          <p className="font-display text-3xl text-amber-100">El Callejón</p>
          <p className="text-lg text-rose-200">
            Error de visualización en esta pantalla
          </p>
          <p className="max-w-md text-sm text-cream/70 font-mono bg-black/40 p-2.5 rounded-xl border border-rose-800/40 break-words">
            {String(this.state.error?.message || this.state.error)}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="tap rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold text-stone-950"
              onClick={() => window.location.reload()}
            >
              Recargar ahora
            </button>

            {snapshot && (
              <>
                <button
                  type="button"
                  className="tap rounded-xl border border-stone-600 bg-stone-900 px-4 py-2.5 text-xs font-semibold text-stone-200"
                  onClick={this.handleCopy}
                >
                  {copied ? "✅ Copiado" : "📋 Copiar snapshot"}
                </button>
                <button
                  type="button"
                  className="tap rounded-xl border border-amber-600/40 bg-stone-900 px-4 py-2.5 text-xs font-semibold text-amber-300"
                  onClick={() => this.setState({ showModal: true })}
                >
                  🔍 Ver diagnóstico
                </button>
              </>
            )}
          </div>

          <p className="text-[11px] text-stone-500">
            Reintento automático en ~1 min…
          </p>

          {showModal && snapshot && (
            <CrashDiagnosticModal
              snapshot={snapshot}
              onClose={() => this.setState({ showModal: false })}
              onRetry={() => window.location.reload()}
            />
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
