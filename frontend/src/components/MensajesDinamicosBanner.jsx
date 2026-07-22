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
      className={`pointer-events-none absolute bottom-10 left-8 right-8 z-40 flex justify-start sm:left-auto sm:right-8 sm:max-w-xl transition-all duration-500 ease-out ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-5 opacity-0"
      }`}
      aria-live="polite"
    >
      <div className="msg-banner flex w-full max-w-xl items-start gap-3 rounded-2xl border border-amber-400/25 bg-black/70 px-4 py-3.5 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-inner ${
            cat === "chef"
              ? "bg-gradient-to-br from-amber-600/90 to-orange-800/90"
              : "bg-gradient-to-br from-[#a33a28]/90 to-amber-700/80"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/95">
            {label}
          </p>
          <p className="mt-1 font-display text-lg leading-snug text-white sm:text-xl">
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
      <style>{`
        .msg-banner {
          animation: msgGlow 4s ease-in-out infinite alternate;
        }
        @keyframes msgGlow {
          from { box-shadow: 0 12px 40px rgba(0,0,0,0.45); }
          to { box-shadow: 0 12px 48px rgba(212,168,75,0.22); }
        }
      `}</style>
    </div>
  );
}
