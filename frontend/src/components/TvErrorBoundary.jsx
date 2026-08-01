import { Component } from "react";

/**
 * Evita pantalla blanca/vacía si un componente de TV revienta al renderizar.
 */
export default class TvErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, ticks: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Error de pantalla") };
  }

  componentDidCatch(error, info) {
    console.error("[TvErrorBoundary]", error, info);
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

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#1a0f0a] px-8 text-center text-ivory"
          role="alert"
        >
          <p className="font-display text-3xl text-amber-100">El Callejón</p>
          <p className="text-lg text-rose-200">
            Error de visualización en esta pantalla
          </p>
          <p className="max-w-md text-sm text-cream/60">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            type="button"
            className="tap rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold text-stone-950"
            onClick={() => window.location.reload()}
          >
            Recargar ahora
          </button>
          <p className="text-[11px] text-stone-500">
            Reintento automático en ~1 min…
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
