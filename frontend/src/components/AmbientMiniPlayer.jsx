import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useWebSocket } from "../hooks/useWebSocket";

/**
 * Mini reproductor fijo (arriba centro del Centro de Control).
 * Permite prev / play-pause / next sin abrir la pestaña Ambiente.
 */
export default function AmbientMiniPlayer() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.ambientStatus();
      if (s?.ok) setSt(s);
    } catch {
      /* host offline */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useWebSocket("admin,pantallas", (ev) => {
    if (ev?.t !== "now_playing") return;
    // Confirmar con el servidor (evita quedar en la pista anterior)
    window.setTimeout(() => {
      void refresh();
    }, 350);
  });

  async function act(fn) {
    setBusy(true);
    try {
      const s = await fn();
      if (s?.ok !== false) setSt(s);
    } catch {
      /* */
    } finally {
      setBusy(false);
    }
  }

  const cur = st?.current;
  const playing = !!st?.playing;
  const line = cur
    ? [cur.artist, cur.title].filter(Boolean).join(" — ")
    : st?.offline
      ? "Ambiente offline"
      : "Ambiente";

  return (
    <div className="ambient-mini pointer-events-auto flex max-w-[min(52vw,20rem)] items-center gap-1.5 rounded-full border border-stone-600/80 bg-black/55 px-2 py-1 shadow-md backdrop-blur-sm sm:max-w-[min(40vw,24rem)] sm:gap-2 sm:px-2.5 sm:py-1.5">
      <button
        type="button"
        disabled={busy}
        className="tap shrink-0 rounded-full px-1.5 py-0.5 text-xs text-cream/90 hover:bg-white/10 disabled:opacity-40"
        title="Anterior"
        onClick={() => act(() => api.ambientPrev())}
      >
        ⏮
      </button>
      <button
        type="button"
        disabled={busy}
        className="tap shrink-0 rounded-full bg-amber-600/90 px-2 py-0.5 text-xs font-bold text-stone-950 hover:bg-amber-500 disabled:opacity-40"
        title={playing ? "Pausa" : "Play"}
        onClick={() =>
          act(() => (playing ? api.ambientPause() : api.ambientResume()))
        }
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        disabled={busy}
        className="tap shrink-0 rounded-full px-1.5 py-0.5 text-xs text-cream/90 hover:bg-white/10 disabled:opacity-40"
        title="Siguiente"
        onClick={() => act(() => api.ambientNext())}
      >
        ⏭
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-emerald-300/80">
          {playing ? "♪ En vivo" : st?.paused ? "Pausa" : "Ambiente"}
        </p>
        <p className="truncate text-[10px] text-ivory/90 sm:text-[11px]" title={line}>
          {line}
        </p>
      </div>
    </div>
  );
}
