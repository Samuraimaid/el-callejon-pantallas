import { useEffect, useRef, useState } from "react";

/**
 * Escenario de plantilla de evento: tema, tipografía, animación y música.
 */
export default function EventTemplateStage({
  template,
  item,
  volumen = 25,
  embed = false,
}) {
  const audioRef = useRef(null);
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = template?.imagenes?.length
    ? template.imagenes
    : item?.media_url
      ? [item.media_url]
      : ["/images/eventos/templates/cumpleanos.jpg"];

  useEffect(() => {
    if (!template?.imagenes?.length || template.imagenes.length <= 1) return undefined;
    const ms = Math.max(4000, Number(template.duracion_slide_ms) || 7000);
    const id = window.setInterval(() => {
      setImgIdx((i) => (i + 1) % template.imagenes.length);
    }, ms);
    return () => window.clearInterval(id);
  }, [template]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || embed) return undefined;
    if (!template?.musica_url || template.musica_activa === false) {
      a.pause();
      return undefined;
    }
    a.volume = Math.max(0, Math.min(1, (volumen || 0) / 100));
    a.loop = template.musica_loop !== false;
    a.play?.().catch(() => {
      /* autoplay bloqueado sin gesto */
    });
    return () => {
      try {
        a.pause();
      } catch {
        /* */
      }
    };
  }, [template, volumen, embed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, (volumen || 0) / 100));
    }
  }, [volumen]);

  const tema = template?.tema || {};
  const tip = template?.tipografia || {};
  const textos = template?.textos || {};
  const anim = `evt-anim-${template?.animacion || "fade-up"}`;
  const mediaAnim = `anim-${template?.animacion_media || "fade"}`;
  const src = imgs[imgIdx % imgs.length];

  return (
    <div
      className="evt-stage"
      style={{
        background: `linear-gradient(160deg, ${tema.bg_from || "#111"}, ${tema.bg_to || "#000"})`,
      }}
    >
      <img
        key={src}
        src={src}
        alt=""
        className={`evt-bg-photo ${mediaAnim}`}
      />
      <div
        className="evt-overlay"
        style={{
          background: `linear-gradient(to top, ${tema.overlay || "rgba(0,0,0,0.7)"}, transparent 55%, ${tema.overlay || "rgba(0,0,0,0.35)"})`,
        }}
      />
      <div className={`evt-content ${anim}`} style={{ color: tema.text || "#fff" }}>
        <p
          className={`${tip.titulo || "font-display"} ${tip.titulo_size || "text-5xl"} ${tip.weight || "font-bold"} evt-title`}
          style={{ color: tema.accent || tema.text }}
        >
          {textos.titulo || item?.titulo || "Evento"}
        </p>
        {textos.subtitulo && (
          <p
            className={`${tip.subtitulo || "font-sans"} ${tip.subtitulo_size || "text-xl"} evt-sub`}
          >
            {textos.subtitulo}
          </p>
        )}
        {textos.pie && (
          <p className="evt-pie" style={{ color: tema.accent }}>
            {textos.pie}
          </p>
        )}
      </div>
      {!embed && template?.musica_url && template.musica_activa !== false && (
        <audio
          ref={audioRef}
          src={template.musica_url}
          preload="auto"
          loop={template.musica_loop !== false}
        />
      )}
    </div>
  );
}
