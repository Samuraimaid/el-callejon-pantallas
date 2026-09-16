import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../lib/constants";
import { CACHE_KEYS, cacheGetData, cacheSet } from "../../lib/tvCache";
import { isTvEmbedMode } from "../../lib/tvEmbed";
import { useContentSync } from "../../hooks/useContentSync";
import { useTvRuntime } from "../../hooks/useTvRuntime";
import { useWebSocket } from "../../hooks/useWebSocket";
import ContentLoadingOverlay from "./ContentLoadingOverlay";
import EventTemplateStage from "./EventTemplateStage";

/**
 * Envoltorio industrial: standby, modo evento, sync de contenido 1-a-1,
 * barra de progreso y caché local reutilizable.
 * En ?embed=1 (preview admin): sin sync pesado ni overlay de carga.
 */
export default function TvRuntimeShell({
  tvId,
  snapshotExtra = null,
  children,
}) {
  const embed = isTvEmbedMode();

  const snapshotBuilder = useCallback(() => {
    if (embed) return { embed: true, path: window.location.pathname };
    const extra =
      typeof snapshotExtra === "function" ? snapshotExtra() : snapshotExtra || {};
    return {
      label: document.title,
      ...extra,
    };
  }, [snapshotExtra, embed]);

  const { powerOn, volumen, modoEvento, standby, renderError, setRenderError } =
    useTvRuntime(tvId, { snapshotBuilder });

  // Preview del Centro de Control: no competir por lease ni bloquear la vista.
  // TVs #1–#2 son menú en vivo (API + WS); no deben bloquearse por cola de
  // descarga de campañas (diseñada sobre todo para publicidad #3–#6).
  const isMenuTv = tvId === 1 || tvId === 2;
  const sync = useContentSync(tvId, {
    enabled: !embed && !standby && !modoEvento && !isMenuTv,
  });

  const [eventoItems, setEventoItems] = useState(
    () => cacheGetData(CACHE_KEYS.evento)?.items || []
  );
  const [evtIdx, setEvtIdx] = useState(0);
  const [eventTemplate, setEventTemplate] = useState(
    () => cacheGetData(CACHE_KEYS.eventoPlantilla) || null
  );
  /** Incrementar para forzar recarga de plantilla/media (cambio cumpleaños→boda, etc.) */
  const [evtRev, setEvtRev] = useState(0);

  const loadEventoContent = useCallback(async (hintTemplate = null) => {
    // Plantilla: preferir payload WS si viene completo
    if (hintTemplate && hintTemplate.id) {
      setEventTemplate(hintTemplate);
      cacheSet(CACHE_KEYS.eventoPlantilla, hintTemplate);
    } else {
      try {
        const res = await fetch(
          `${API_URL}/api/pantallas/evento/plantillas/activa?_=${Date.now()}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          const tpl = data.template || null;
          setEventTemplate(tpl);
          cacheSet(CACHE_KEYS.eventoPlantilla, tpl);
        }
      } catch {
        /* cache */
      }
    }
    // Media del evento (imagenes de la plantilla aplicada)
    try {
      const res = await fetch(
        `${API_URL}/api/pantallas/evento/media?_=${Date.now()}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setEventoItems(items);
        cacheSet(CACHE_KEYS.evento, { items });
        setEvtIdx(0);
      }
    } catch {
      /* cache */
    }
  }, []);

  // Al entrar/salir de modo evento o al cambiar plantilla (evtRev)
  useEffect(() => {
    if (standby) return undefined;
    if (!modoEvento && evtRev === 0) {
      // primera carga en modo normal: no obligatorio, pero al activar evento sí
    }
    if (modoEvento || evtRev > 0) {
      void loadEventoContent();
    }
  }, [modoEvento, evtRev, standby, loadEventoContent]);

  // WebSocket: cambio de plantilla (cumpleaños → boda) sin salir de modo evento
  useWebSocket(embed ? "" : "pantallas,all", (ev) => {
    if (!ev?.t) return;
    if (ev.t === "evt_tpl") {
      // Actualizar al instante con el template del mensaje si viene
      if (ev.template) {
        setEventTemplate(ev.template);
        cacheSet(CACHE_KEYS.eventoPlantilla, ev.template);
      } else if (ev.template_id == null) {
        setEventTemplate(null);
        cacheSet(CACHE_KEYS.eventoPlantilla, null);
      }
      setEvtIdx(0);
      setEvtRev((n) => n + 1);
      // Refetch media + plantilla (cache-bust)
      void loadEventoContent(ev.template || null);
      return;
    }
    // Media de evento subida o regenerada
    if (ev.t === "evt_media" || ev.t === "evento_media") {
      setEvtRev((n) => n + 1);
      void loadEventoContent();
    }
  });

  useEffect(() => {
    if (!modoEvento || eventoItems.length <= 1) return undefined;
    const ms = Math.max(
      4000,
      Number(eventTemplate?.duracion_slide_ms) || 7000
    );
    const id = window.setInterval(() => {
      setEvtIdx((i) => (i + 1) % eventoItems.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [
    modoEvento,
    eventoItems.length,
    eventTemplate?.duracion_slide_ms,
    eventTemplate?.id,
    evtRev,
  ]);

  // Volumen en videos del evento
  useEffect(() => {
    document.querySelectorAll("video, audio").forEach((v) => {
      try {
        v.volume = Math.max(0, Math.min(1, (volumen || 0) / 100));
        if (v.tagName === "VIDEO") {
          v.muted = (volumen || 0) <= 0 || standby;
        }
      } catch {
        /* */
      }
    });
  }, [volumen, standby, modoEvento, evtIdx]);

  if (standby) {
    return (
      <div className="tv-standby" data-tv={tvId} aria-label="Pantalla en reposo">
        <div className="tv-standby-dot" />
        <p className="tv-standby-label">
          TV #{tvId} · En reposo
          <span>Centro de Control → encender pantalla</span>
        </p>
      </div>
    );
  }

  if (modoEvento) {
    if (eventTemplate) {
      const item = eventoItems[evtIdx % Math.max(1, eventoItems.length)];
      return (
        <EventTemplateStage
          key={`evt-tpl-${eventTemplate.id || "x"}-${evtRev}`}
          template={eventTemplate}
          item={item}
          volumen={volumen}
          embed={embed}
        />
      );
    }
    const item = eventoItems[evtIdx % Math.max(1, eventoItems.length)];
    if (!item) {
      return (
        <div className="tv-event-empty bg-black text-ivory">
          <p className="font-display text-3xl">Modo Evento</p>
          <p className="mt-2 text-cream/60">
            Elija una plantilla en el Centro de Control o suba media
          </p>
        </div>
      );
    }
    return (
      <EventMediaStage
        key={`evt-media-${item.id || item.media_url || evtIdx}-${evtRev}`}
        item={item}
        volumen={volumen}
      />
    );
  }

  return (
    <div
      className="relative h-full w-full"
      data-tv={tvId}
      data-vol={volumen}
      data-embed={embed ? "1" : "0"}
    >
      {!embed && (
        <ContentLoadingOverlay
          tvId={tvId}
          phase={sync.phase}
          progress={sync.progress}
          etaSec={sync.etaSec}
          message={sync.message}
          detail={sync.detail}
          queueInfo={sync.queueInfo}
          fromCache={sync.fromCache}
          onRetry={() => sync.resync?.()}
          onDismiss={
            sync.blocking
              ? () => {
                  /* force show: parent re-renders via hasShownContent on next cycle;
                     also allow seeing children by treating as degraded via resync path */
                  sync.resync?.();
                }
              : undefined
          }
        />
      )}
      {renderError && !embed && (
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
      {/* Siempre montar children si ya hubo contenido o no está bloqueando el 1.er arranque */}
      {embed || !sync.blocking ? children : (
        <div className="flex h-full min-h-[50vh] items-center justify-center bg-[#0a0705] text-cream/40">
          <p className="text-sm">Preparando TV #{tvId}…</p>
        </div>
      )}
    </div>
  );
}

function EventMediaStage({ item, volumen }) {
  const vertical = item.orientacion === "vertical";
  const isVideo = item.media_tipo === "video";
  const url = item.media_url?.startsWith("http")
    ? item.media_url
    : item.media_url;
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="tv-event-empty bg-black text-ivory">
        <p className="font-display text-3xl">Modo Evento</p>
        <p className="mt-2 text-cream/60">Media no disponible</p>
      </div>
    );
  }

  return (
    <div className="tv-event-stage">
      {vertical && !isVideo && (
        <img
          src={url}
          alt=""
          className="tv-event-blur-bg"
          aria-hidden
          onError={() => setFailed(true)}
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
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            src={url}
            alt={item.titulo || ""}
            className="tv-event-media"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {item.titulo && (
        <p className="tv-event-caption font-display">{item.titulo}</p>
      )}
    </div>
  );
}
