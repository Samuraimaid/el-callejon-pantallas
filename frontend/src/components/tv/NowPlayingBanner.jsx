import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../lib/constants";
import { useWebSocket } from "../../hooks/useWebSocket";

const SHOW_MS = 5000;
/** Solo toast si la pista empezó hace poco (inicio real, no canción vieja). */
const MAX_ELAPSED_S = 12;
/** Tiempos absolutos (ms) de cada intento de verificación con el servidor. */
const VERIFY_AT = [300, 600, 1000, 1500];

function trackKey(o) {
  if (!o) return "";
  return String(
    o.rel || o.track_id || o.id || `${o.artist || ""}|${o.title || ""}`
  );
}

function sleep(ms) {
  return new Promise((r) => window.setTimeout(r, ms));
}

/**
 * Toast "Ahora suena" (TV #3–#6).
 * Al recibir WS, verifica varias veces con GET /api/ambient/status.
 * Solo muestra la canción que el servidor confirma como actual y reciente.
 * Nunca muestra una pista que ya terminó o lleva mucho tiempo sonando.
 */
export default function NowPlayingBanner({ enabled = true }) {
  const [np, setNp] = useState(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(0);
  const lastTrack = useRef("");
  const seq = useRef(0);

  useEffect(() => {
    return () => {
      window.clearTimeout(hideTimer.current);
      seq.current += 1;
    };
  }, []);

  function showToast(cur, mySeq) {
    const key = trackKey(cur);
    if (!key || key === lastTrack.current) return false;
    lastTrack.current = key;

    setNp({
      title: cur.title,
      artist: cur.artist,
      folder: cur.folder,
      rel: cur.rel,
    });
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => {
        if (mySeq === seq.current) setNp(null);
      }, 400);
    }, SHOW_MS);
    return true;
  }

  async function fetchServerStatus() {
    const res = await fetch(`${API_URL}/api/ambient/status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  }

  /**
   * Confirma con el servidor qué suena de verdad.
   * - Preferencia: 2 lecturas seguidas de la misma pista fresca.
   * - Si WS y servidor coinciden en una pista fresca, muestra de inmediato.
   * - Si WS traía la vieja y el servidor ya cambió, muestra la del servidor.
   */
  async function verifyWithServer(hintKey) {
    const mySeq = ++seq.current;
    let prevKey = "";
    let prevCur = null;
    let t0 = 0;

    for (let i = 0; i < VERIFY_AT.length; i++) {
      await sleep(VERIFY_AT[i] - t0);
      t0 = VERIFY_AT[i];
      if (mySeq !== seq.current) return;

      try {
        const data = await fetchServerStatus();
        if (mySeq !== seq.current) return;
        if (!data?.ok || !data.playing || data.paused || !data.current?.title) {
          prevKey = "";
          prevCur = null;
          continue;
        }

        const cur = data.current;
        const key = trackKey(cur);
        if (!key) continue;

        const elapsed = Number(data.elapsed_s ?? 0);
        if (elapsed > MAX_ELAPSED_S) {
          // WS anunció una pista que el servidor ya no considera "inicio"
          if (hintKey && key === hintKey) return;
          prevKey = "";
          prevCur = null;
          continue;
        }

        // WS y servidor de acuerdo → confiar
        if (hintKey && key === hintKey && key !== lastTrack.current) {
          showToast(cur, mySeq);
          return;
        }

        // Dos lecturas iguales y frescas (pista real estable en el servidor)
        if (key === prevKey && prevCur && key !== lastTrack.current) {
          showToast(cur, mySeq);
          return;
        }

        prevKey = key;
        prevCur = cur;
      } catch {
        /* offline / red */
      }
    }

    if (mySeq !== seq.current) return;

    // Cierre: un último status; solo si es fresco y distinto al último toast
    try {
      const data = await fetchServerStatus();
      if (mySeq !== seq.current) return;
      if (
        data?.ok &&
        data.playing &&
        !data.paused &&
        data.current?.title &&
        Number(data.elapsed_s ?? 0) <= MAX_ELAPSED_S
      ) {
        const finalKey = trackKey(data.current);
        if (finalKey && finalKey !== lastTrack.current) {
          showToast(data.current, mySeq);
        }
      }
    } catch {
      /* */
    }
  }

  useWebSocket(enabled ? "pantallas,all" : "off", (ev) => {
    if (ev?.t !== "now_playing") return;
    if (!ev.playing || ev.paused || !ev.title) return;

    // Rebroadcast de pista ya avanzada → no toast
    if (Number(ev.elapsed_s ?? 0) > MAX_ELAPSED_S) return;

    const hintKey = trackKey(ev);
    if (hintKey && hintKey === lastTrack.current) return;

    // Nueva secuencia cancela la verificación anterior (seq++)
    void verifyWithServer(hintKey);
  });

  if (!enabled || !np?.title || !visible) return null;

  const line = [np.artist, np.title].filter(Boolean).join(" — ");

  return (
    <div
      className="np-toast np-toast-bl pointer-events-none z-35"
      aria-live="polite"
    >
      <div className="np-toast-card flex max-w-[min(92vw,22rem)] items-center gap-3 rounded-2xl border border-emerald-400/30 bg-black/80 px-3.5 py-2.5 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
        <VuMeter active />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">
            Ahora suena
          </p>
          <p className="truncate font-display text-sm leading-snug text-white sm:text-base">
            {line}
          </p>
        </div>
        <span className="shrink-0 text-lg text-emerald-300/90" aria-hidden>
          ♪
        </span>
      </div>
    </div>
  );
}

function VuMeter({ active }) {
  return (
    <div
      className={`np-vu flex h-9 items-end gap-[3px] ${active ? "is-on" : "is-off"}`}
      aria-hidden
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`np-vu-bar np-vu-bar-${i + 1}`} />
      ))}
    </div>
  );
}
