import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/constants";
import { CACHE_KEYS, cacheGetData, cacheSet } from "../../lib/tvCache";
import { useContentSync } from "../../hooks/useContentSync";
import { useTvRuntime } from "../../hooks/useTvRuntime";
import ContentLoadingOverlay from "./ContentLoadingOverlay";

/**
 * Envoltorio industrial: standby, modo evento, sync de contenido 1-a-1,
 * barra de progreso y caché local reutilizable.
 */
export default function TvRuntimeShell({
  tvId,
  snapshotExtra = null,
  children,
}) {
  const snapshotBuilder = useCallback(() => {
    const extra =
      typeof snapshotExtra === "function" ? snapshotExtra() : snapshotExtra || {};
    return {
      label: document.title,
      ...extra,
    };
  }, [snapshotExtra]);

  const { powerOn, volumen, modoEvento, standby, renderError, setRenderError } =
    useTvRuntime(tvId, { snapshotBuilder });

  const sync = useContentSync(tvId, { enabled: !standby && !modoEvento });

  const [eventoItems, setEventoItems] = useState(
    () => cacheGetData(CACHE_KEYS.evento)?.items || []
  );
  const [evtIdx, setEvtIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/pantallas/evento/media`);
        if (!res.ok) return;
        const data = await res.json();
        const items = data.items || [];
        setEventoItems(items);
        cacheSet(CACHE_KEYS.evento, { items });
      } catch {
        /* cache */
      }
    })();
  }, [modoEvento]);

  useEffect(() => {
    if (!modoEvento || eventoItems.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setEvtIdx((i) => (i + 1) % eventoItems.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [modoEvento, eventoItems.length]);

  // Volumen en videos del evento
  useEffect(() => {
    document.querySelectorAll("video").forEach((v) => {
      v.volume = Math.max(0, Math.min(1, (volumen || 0) / 100));
      v.muted = (volumen || 0) <= 0 || standby;
    });
  }, [volumen, standby, modoEvento, evtIdx]);

  if (standby) {
    return (
      <div className="tv-standby" data-tv={tvId} aria-label="Pantalla en reposo">
        <div className="tv-standby-dot" />
      </div>
    );
  }

  if (modoEvento) {
    const item = eventoItems[evtIdx % Math.max(1, eventoItems.length)];
    if (!item) {
      return (
        <div className="tv-event-empty bg-black text-ivory">
          <p className="font-display text-3xl">Modo Evento</p>
          <p className="mt-2 text-cream/60">Sin fotos cargadas en el panel</p>
        </div>
      );
    }
    return (
      <EventMediaStage
        item={item}
        volumen={volumen}
        key={item.id || item.media_url}
      />
    );
  }

  return (
    <div className="relative h-full w-full" data-tv={tvId} data-vol={volumen}>
      <ContentLoadingOverlay
        tvId={tvId}
        phase={sync.phase}
        progress={sync.progress}
        etaSec={sync.etaSec}
        message={sync.message}
        detail={sync.detail}
        queueInfo={sync.queueInfo}
        fromCache={sync.fromCache}
      />
      {renderError && (
        <div className="pointer-events-none absolute left-2 top-2 z-[100] rounded bg-rose-900/90 px-2 py-1 text-xs text-white">
          ⚠️ {renderError}
          <button
            type="button"
            className="pointer-events-auto ml-2 underline"
            onClick={() => setRenderError(null)}
          >
            ok
          </button>
        </div>
      )}
      {/* Mientras descarga masiva, no montar media pesada (ahorra CPU/red) */}
      {sync.blocking ? null : children}
    </div>
  );
}

function EventMediaStage({ item, volumen }) {
  const vertical = item.orientacion === "vertical";
  const isVideo = item.media_tipo === "video";
  const url = item.media_url?.startsWith("http")
    ? item.media_url
    : item.media_url;

  return (
    <div className="tv-event-stage">
      {vertical && !isVideo && (
        <img
          src={url}
          alt=""
          className="tv-event-blur-bg"
          aria-hidden
        />
      )}
      <div className={`tv-event-frame ${vertical ? "is-vertical" : "is-wide"}`}>
        {isVideo ? (
          <video
            src={url}
            className="tv-event-media"
            autoPlay
            loop
            playsInline
            muted={(volumen || 0) <= 0}
          />
        ) : (
          <img src={url} alt={item.titulo || ""} className="tv-event-media" />
        )}
      </div>
      {item.titulo && (
        <p className="tv-event-caption font-display">{item.titulo}</p>
      )}
    </div>
  );
}
