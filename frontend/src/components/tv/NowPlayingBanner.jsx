import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../lib/constants";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useAmbientUiConfig } from "../../hooks/useAmbientUiConfig";
import OverflowMarquee from "../OverflowMarquee";

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
 * - Escucha WS now_playing
 * - Confirma con /status (sin ser tan estricto como para bloquear el toast)
 * - Poll de respaldo por si se perdió el WS
 */
export default function NowPlayingBanner({ enabled = true }) {
  const { cfg } = useAmbientUiConfig();
  const showMs = Math.max(2000, Number(cfg.now_playing_show_ms) || 5000);
  const maxElapsed = Math.max(3, Number(cfg.now_playing_max_elapsed_s) || 20);
  const featureOn = cfg.now_playing_enabled !== false;
  const marqueeOn = cfg.banner_marquee_enabled !== false;
  const marqueeSpeed = Number(cfg.banner_marquee_speed_px_s) || 42;

  const [np, setNp] = useState(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(0);
  const lastTrack = useRef("");
  const seq = useRef(0);
  const showMsRef = useRef(showMs);
  const maxElapsedRef = useRef(maxElapsed);
  showMsRef.current = showMs;
  maxElapsedRef.current = maxElapsed;

  useEffect(() => {
    return () => {
      window.clearTimeout(hideTimer.current);
      seq.current += 1;
    };
  }, []);

  function showToast(cur, mySeq, { force = false } = {}) {
    const key = trackKey(cur);
    if (!key) return false;
    if (!force && key === lastTrack.current) return false;
    lastTrack.current = key;

    setNp({
      title: cur.title,
      artist: cur.artist,
      folder: cur.folder,
      rel: cur.rel,
      cover_url: cur.cover_url || cur.album_art || "",
    });
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => {
        if (mySeq === seq.current) setNp(null);
      }, 400);
    }, showMsRef.current);
    return true;
  }

  async function fetchServerStatus() {
    try {
      const res = await fetch(`${API_URL}/api/ambient/status`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  /**
   * Tras WS: espera un momento, confirma con status y muestra.
   * Si status no responde a tiempo, usa el hint del WS (pista fresca).
   */
  async function handleNowPlaying(ev) {
    const mySeq = ++seq.current;
    const hintKey = trackKey(ev);
    if (!hintKey) return;

    const maxE = Math.max(maxElapsedRef.current, 45);
    const elapsedHint = Number(ev.elapsed_s ?? 0);
    // Pistas muy viejas no muestran toast (salvo force del backend con elapsed bajo)
    if (elapsedHint > maxE && hintKey === lastTrack.current) return;

    // Breve espera: el host asienta current tras next/auto-advance
    await sleep(180);
    if (mySeq !== seq.current) return;

    // Hasta 3 lecturas de status
    for (let i = 0; i < 3; i++) {
      if (i > 0) await sleep(220);
      if (mySeq !== seq.current) return;

      const data = await fetchServerStatus();
      if (mySeq !== seq.current) return;
      if (!data?.ok || !data.playing || data.paused || !data.current?.title) {
        continue;
      }

      const cur = data.current;
      const key = trackKey(cur);
      if (!key) continue;

      const elapsed = Number(data.elapsed_s ?? 0);
      // Cambio de pista: mostrar aunque el poll lleve unos segundos
      if (key !== lastTrack.current && elapsed <= maxE) {
        showToast(
          {
            ...cur,
            cover_url: cur.cover_url || cur.album_art || ev.cover_url,
          },
          mySeq
        );
        return;
      }
    }

    // Fallback: confiar en el evento WS (evita perder el banner)
    if (mySeq !== seq.current) return;
    if (ev.title && hintKey !== lastTrack.current && elapsedHint <= maxE) {
      showToast(
        {
          title: ev.title,
          artist: ev.artist,
          folder: ev.folder,
          rel: ev.rel,
          track_id: ev.track_id,
          cover_url: ev.cover_url || "",
        },
        mySeq
      );
    }
  }

  useWebSocket(enabled && featureOn ? "pantallas,all" : "off", (ev) => {
    if (ev?.t !== "now_playing") return;
    if (!ev.playing || ev.paused || !ev.title) return;
    void handleNowPlaying(ev);
  });

  // Respaldo: si el WS se pierde, detectar cambio por poll de status
  useEffect(() => {
    if (!enabled || !featureOn) return undefined;

    let alive = true;
    const tick = async () => {
      if (!alive) return;
      const data = await fetchServerStatus();
      if (!alive || !data?.ok) return;
      if (!data.playing || data.paused || !data.current?.title) return;
      const key = trackKey(data.current);
      if (!key) return;
      const elapsed = Number(data.elapsed_s ?? 0);
      const maxE = Math.max(maxElapsedRef.current, 45);

      // Misma pista ya anunciada
      if (key === lastTrack.current) return;

      // Pista nueva o TV recien conectada al inicio de cancion
      if (elapsed > maxE) {
        // Canción ya avanzada: recordar para no spam, sin toast
        lastTrack.current = key;
        return;
      }
      const mySeq = ++seq.current;
      showToast(data.current, mySeq);
    };

    // Primer poll pronto (banner al conectar la TV con musica ya sonando)
    const t0 = window.setTimeout(tick, 800);
    const id = window.setInterval(tick, 3500);
    return () => {
      alive = false;
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [enabled, featureOn]);

  if (!enabled || !featureOn || !np?.title || !visible) return null;

  const line = [np.artist, np.title].filter(Boolean).join(" — ");
  // Covers se guardan en public/images/covers (same-origin /images/...)
  const cover = np.cover_url || null;

  return (
    <div
      className="np-toast np-toast-bl pointer-events-none z-35"
      aria-live="polite"
    >
      <div className="np-toast-card flex max-w-[min(92vw,24rem)] items-center gap-3 rounded-2xl border border-emerald-400/30 bg-black/80 px-3.5 py-2.5 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <VuMeter active />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">
            Ahora suena
          </p>
          <OverflowMarquee
            className="font-display text-sm leading-snug text-white sm:text-base"
            enabled={marqueeOn}
            speedPxS={marqueeSpeed}
            title={line}
          >
            {line}
          </OverflowMarquee>
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
