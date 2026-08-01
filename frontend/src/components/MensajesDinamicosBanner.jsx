import { useEffect, useMemo, useState } from "react";

const LABELS = {
  chef: "Recomendaciones del Chef",
  sabias: "¿Sabías qué? de El Callejón",
};

const ICONS = {
  chef: "👨‍🍳",
  sabias: "✨",
};

/**
 * Banner flotante inferior: rota mensajes del admin (Chef / ¿Sabías qué?).
 * Ligero para Smart TV — solo CSS + timers.
 */
export default function MensajesDinamicosBanner({
  mensajes = [],
  duracionMs = 9000,
  enabled = true,
}) {
  const list = useMemo(
    () =>
      (mensajes || []).filter((m) => (m?.texto || "").trim().length > 0),
    [mensajes]
  );

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [list.length, duracionMs]);

  useEffect(() => {
    if (!enabled || list.length <= 1) return undefined;
    const hold = Math.max(3000, Number(duracionMs) || 9000);
    const fade = 450;

    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % list.length);
        setVisible(true);
      }, fade);
    }, hold);

    return () => window.clearInterval(id);
  }, [enabled, list.length, duracionMs]);

  if (!enabled || !list.length) return null;

  const msg = list[index % list.length];
  const cat = msg.categoria === "sabias" ? "sabias" : "chef";
  const label = LABELS[cat];
  const icon = ICONS[cat];

  return (
    <div
      className={`msg-banner-wrap pointer-events-none z-30 transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      aria-live="polite"
    >
      <div className="msg-banner flex w-full max-w-[min(92vw,24rem)] items-start gap-2.5 rounded-2xl border border-amber-400/25 bg-black/75 px-3.5 py-3 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-inner ${
            cat === "chef"
              ? "bg-gradient-to-br from-amber-600/90 to-orange-800/90"
              : "bg-gradient-to-br from-[#a33a28]/90 to-amber-700/80"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/95">
            {label}
          </p>
          <p className="mt-0.5 font-display text-base leading-snug text-white sm:text-lg">
            {msg.texto}
          </p>
        </div>
        {list.length > 1 && (
          <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
            {list.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  i === index % list.length
                    ? "h-3 bg-amber-400"
                    : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
