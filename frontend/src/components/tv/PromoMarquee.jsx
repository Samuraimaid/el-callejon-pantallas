import { useEffect, useMemo, useState } from "react";
import { getMensajesMarquesina } from "../../lib/promociones";
import { useAmbientUiConfig } from "../../hooks/useAmbientUiConfig";
import OverflowMarquee from "../OverflowMarquee";

/**
 * Marquesina de promos — textos y ritmo vienen de config del operador.
 * Si un mensaje es más largo que el ancho, se desliza el texto.
 */
export default function PromoMarquee({
  config = null,
  intervalMs = 5500,
}) {
  const { cfg: amb } = useAmbientUiConfig();
  const marqueeOn = amb.banner_marquee_enabled !== false;
  const marqueeSpeed = Number(amb.banner_marquee_speed_px_s) || 42;

  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  const [idx, setIdx] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const k = new Date().toDateString();
      if (k !== dayKey) setDayKey(k);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [dayKey]);

  const mensajes = useMemo(
    () => getMensajesMarquesina(config, new Date()),
    [config, dayKey]
  );

  useEffect(() => {
    setIdx(0);
  }, [mensajes.length, intervalMs]);

  useEffect(() => {
    if (mensajes.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % mensajes.length);
      setTick((t) => t + 1);
    }, Math.max(3000, intervalMs));
    return () => window.clearInterval(id);
  }, [mensajes.length, intervalMs]);

  if (!mensajes.length) return null;
  const msg = mensajes[idx % mensajes.length];

  return (
    <div className="promo-marquee" role="status" aria-live="polite">
      <div className="promo-marquee-track">
        <div
          key={`${msg.id}-${tick}`}
          className="promo-marquee-item promo-marquee-in"
        >
          <span className="promo-marquee-icon" aria-hidden>
            {msg.icon || "✨"}
          </span>
          <span className="promo-marquee-tag">{msg.tag}</span>
          <span className="promo-marquee-sep" aria-hidden>
            ·
          </span>
          <OverflowMarquee
            className="promo-marquee-text"
            enabled={marqueeOn}
            speedPxS={marqueeSpeed}
            title={msg.corto}
          >
            {msg.corto}
          </OverflowMarquee>
        </div>
      </div>
      {mensajes.length > 1 && (
        <div className="promo-marquee-dots" aria-hidden>
          {mensajes.map((m, i) => (
            <span
              key={m.id || i}
              className={`promo-marquee-dot ${
                i === idx % mensajes.length ? "is-on" : ""
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
