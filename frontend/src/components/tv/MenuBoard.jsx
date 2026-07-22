import { useEffect, useMemo, useState } from "react";
import {
  fallbackImageForProduct,
  formatC,
  imageForProduct,
} from "../../lib/constants";
import { isAgotado } from "../../hooks/useMenuTv";

export const MENU_FX = [
  "zoom-in",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "giro-3d",
  "persiana",
  "scale-soft",
  "blur",
  "flip-h",
];

/** Orden: numero_combo, luego fallback por índice */
export function sortMenuItems(list) {
  return [...(list || [])].sort((a, b) => {
    const na = a.num ?? a.numero_combo ?? 999;
    const nb = b.num ?? b.numero_combo ?? 999;
    if (na !== nb) return na - nb;
    return String(a.n || "").localeCompare(String(b.n || ""), "es");
  });
}

export function displayNumber(p, fallbackIndex) {
  const n = p?.num ?? p?.numero_combo;
  if (n != null && n !== "") return Number(n);
  return fallbackIndex + 1;
}

/**
 * Fila estilo menú board McD: número grande + foto + nombre + precio.
 */
export function MenuBoardItem({ p, index = 0, flash = false, dense = false }) {
  const agotado = isAgotado(p);
  const num = displayNumber(p, index);
  const img = p.img || imageForProduct(p.c, p.tp, p.imgV);

  return (
    <article
      className={`menu-board-item relative flex items-stretch gap-3 overflow-hidden rounded-xl border transition ${
        agotado
          ? "border-rose-800/40 bg-black/35"
          : "border-[rgba(232,197,106,0.22)] bg-[rgba(20,5,3,0.72)]"
      } ${flash ? "ring-2 ring-gold anim-in" : ""} ${
        dense ? "min-h-[88px] px-2.5 py-2" : "min-h-[108px] px-3 py-2.5"
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center font-display font-black leading-none text-gold drop-shadow ${
          dense ? "w-10 text-3xl" : "w-12 text-4xl"
        }`}
      >
        {num}
      </div>

      <div
        className={`relative shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10 ${
          dense ? "h-16 w-16" : "h-20 w-20"
        }`}
      >
        <img
          key={`${p.c}-${p.imgV || "0"}`}
          src={img}
          alt=""
          className={`h-full w-full object-cover ${
            agotado ? "opacity-45 grayscale" : ""
          }`}
          onError={(e) => {
            e.currentTarget.src = fallbackImageForProduct(p.c, p.tp);
          }}
        />
        {agotado && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="rounded bg-rose-600 px-1 text-[9px] font-black text-white">
              AGOTADO
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p
          className={`line-clamp-2 font-bold leading-tight ${
            dense ? "text-lg" : "text-xl"
          } ${agotado ? "text-cream/45" : "text-ivory"}`}
        >
          {p.n}
        </p>
        <p
          className={`font-display mt-0.5 font-semibold ${
            dense ? "text-xl" : "text-2xl"
          } ${agotado ? "text-cream/35 line-through" : "text-gold"}`}
        >
          {formatC(p.pr)}
        </p>
      </div>
    </article>
  );
}

/**
 * Hero foto grande: rota por TODOS los productos del pool con FX aleatorio.
 * Si un ítem es destacado (dst), se etiqueta como «Promoción del día».
 */
export function MenuBoardHero({
  products = [],
  intervalMs = 5500,
  title = "Menú del día",
  includeAgotados = false,
}) {
  const pool = useMemo(() => {
    const raw = products || [];
    if (includeAgotados) return raw.filter(Boolean);
    const avail = raw.filter((p) => p && !isAgotado(p));
    return avail.length ? avail : raw.filter(Boolean);
  }, [products, includeAgotados]);

  const [idx, setIdx] = useState(0);
  const [fx, setFx] = useState("fade");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [pool.length]);

  useEffect(() => {
    if (pool.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setFx(MENU_FX[Math.floor(Math.random() * MENU_FX.length)]);
      setIdx((i) => (i + 1) % pool.length);
      setTick((t) => t + 1);
    }, Math.max(3500, intervalMs));
    return () => window.clearInterval(id);
  }, [pool.length, intervalMs]);

  if (!pool.length) {
    return (
      <div className="panel-oak-deep flex h-full min-h-[320px] items-center justify-center rounded-2xl p-6">
        <p className="text-center text-xl text-cream/50">Sin platillos</p>
      </div>
    );
  }

  const safeIdx = idx % pool.length;
  const p = pool[safeIdx];
  const img = p.img || imageForProduct(p.c, p.tp, p.imgV);
  const num = displayNumber(p, safeIdx);
  const isPromo = p.dst === 1 || p.dst === true || p.destacado === true;
  const badge = isPromo ? "Promoción del día" : title;
  const total = pool.length;

  return (
    <div className="panel-oak-deep relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <img
          key={`${p.id || p.c}-${tick}-${fx}`}
          src={img}
          alt={p.n}
          className={`absolute inset-0 h-full w-full object-cover ${heroFxClass(fx)}`}
          onError={(e) => {
            e.currentTarget.src = fallbackImageForProduct(p.c, p.tp);
          }}
        />
        {fx === "persiana" && (
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_14px,rgba(0,0,0,0.35)_14px_18px)] opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/20" />

        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ring-1 ${
              isPromo
                ? "bg-gradient-to-r from-[#a33a28] to-[#d4a84b] text-[#1a120c] ring-amber-300/50"
                : "bg-black/45 text-amber-200/90 ring-amber-400/30"
            }`}
          >
            {badge}
          </span>
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-cream/80 ring-1 ring-white/15">
            {safeIdx + 1} / {total}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end gap-3">
            <span className="font-display text-6xl font-black leading-none text-gold drop-shadow-lg md:text-7xl">
              {num}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="font-display text-3xl font-bold leading-tight text-ivory drop-shadow md:text-4xl">
                {p.n}
              </h2>
              <p className="font-display mt-1 text-3xl text-gold md:text-4xl">
                {formatC(p.pr)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1 bg-black/45 px-2 py-2">
          {total <= 16
            ? pool.map((item, i) => (
                <span
                  key={item.id || item.c || i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === safeIdx ? "w-5 bg-amber-400" : "w-1.5 bg-white/30"
                  }`}
                />
              ))
            : (
              <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${((safeIdx + 1) / total) * 100}%` }}
                />
              </div>
            )}
        </div>
      )}

      <style>{`
        @keyframes mbFade {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mbZoom {
          from { opacity: 0.4; transform: scale(1.18); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mbSlideL {
          from { opacity: 0; transform: translateX(8%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes mbSlideR {
          from { opacity: 0; transform: translateX(-8%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes mbSlideU {
          from { opacity: 0; transform: translateY(10%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mbBlur {
          from { opacity: 0; filter: blur(14px); transform: scale(1.06); }
          to { opacity: 1; filter: blur(0); transform: scale(1); }
        }
        @keyframes mbFlip {
          from { opacity: 0.2; transform: rotateY(75deg); }
          to { opacity: 1; transform: rotateY(0); }
        }
        @keyframes mbGiro {
          from { opacity: 0; transform: perspective(900px) rotateY(-28deg) scale(0.92); }
          to { opacity: 1; transform: perspective(900px) rotateY(0) scale(1); }
        }
        @keyframes mbScale {
          from { opacity: 0.5; transform: scale(0.88); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function heroFxClass(fx) {
  switch (fx) {
    case "zoom-in":
      return "animate-[mbZoom_0.75s_ease-out_both]";
    case "slide-left":
      return "animate-[mbSlideL_0.65s_ease-out_both]";
    case "slide-right":
      return "animate-[mbSlideR_0.65s_ease-out_both]";
    case "slide-up":
      return "animate-[mbSlideU_0.65s_ease-out_both]";
    case "blur":
      return "animate-[mbBlur_0.7s_ease-out_both]";
    case "flip-h":
      return "animate-[mbFlip_0.7s_ease-out_both]";
    case "giro-3d":
      return "animate-[mbGiro_0.7s_ease-out_both]";
    case "scale-soft":
      return "animate-[mbScale_0.7s_ease-out_both]";
    case "persiana":
    case "fade":
    default:
      return "animate-[mbFade_0.65s_ease-out_both]";
  }
}

/** Panel de sección con título tipo franquicia */
export function MenuBoardPanel({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`panel-oak-deep flex flex-col overflow-hidden rounded-2xl ${className}`}
    >
      <header className="shrink-0 border-b border-[rgba(232,197,106,0.2)] bg-black/35 px-4 py-3">
        <h2 className="font-display text-2xl font-bold tracking-wide text-gold md:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-cream/65">{subtitle}</p>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-2 p-3">{children}</div>
    </section>
  );
}
