import { useEffect, useMemo, useState } from "react";
import {
  fallbackImageForProduct,
  formatC,
  imageForProduct,
  imageForProductCard,
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
  const num =
    n != null && n !== "" ? Number(n) : Number(fallbackIndex) + 1;
  // Prefijo # para que no se confunda con cantidad (ej. "#4" no "4 platos")
  return `#${num}`;
}

/** Contorno de texto legible sobre fotos claras/oscuras con fade-out suave (sin bordes dentados) */
function textStrokeStyle(px = 1.5, color = "rgba(0,0,0,0.92)") {
  const n = Math.max(0, Math.min(10, Number(px) || 0));
  if (n <= 0) return undefined;
  return {
    textShadow: [
      `0 0 1px ${color}`,
      `0 0 ${Math.max(1, n * 0.8)}px ${color}`,
      `0 0 ${n * 1.5}px rgba(0, 0, 0, 0.85)`,
      `0 2px ${n * 2.2}px rgba(0, 0, 0, 0.70)`,
    ].join(", "),
  };
}

/**
 * Contorno negro de 5px con fade-out progresivo para columna central (hero).
 * Otorga definición y contraste perfecto sobre la foto a pleno brillo sin verse tosco.
 */
function heroTextStrokeStyle(px = 5, color = "rgba(0,0,0,0.95)") {
  const n = Math.max(1, Math.min(12, Number(px) || 5));
  return {
    textShadow: [
      `0 0 1.5px ${color}`,
      `0 0 3px ${color}`,
      `0 0 ${n}px rgba(0, 0, 0, 0.95)`,
      `0 2px ${n * 1.5}px rgba(0, 0, 0, 0.85)`,
      `0 4px ${n * 2.5}px rgba(0, 0, 0, 0.75)`,
    ].join(", "),
  };
}

/**
 * Tarjeta menú: foto de fondo a todo el ancho, fade a la derecha (madera),
 * número + nombre, precio alineado a la derecha.
 */
export function MenuBoardItem({
  p,
  index = 0,
  flash = false,
  dense = false,
  active = false,
  maxSlots = 5,
  textOutlinePx = 1.5,
  nameSizePx = null,
  priceSizePx = null,
  numSizePx = null,
}) {
  const agotado = isAgotado(p);
  const num = displayNumber(p, index);
  const imgCard =
    p.imgCard || imageForProductCard(p.c, p.tp, p.imgV) || p.img || imageForProduct(p.c, p.tp, p.imgV);
  const slots = Math.max(3, Math.min(12, Number(maxSlots) || 5));
  const slotH = `calc((100% - ${(slots - 1) * 0.28}rem) / ${slots} * 0.92)`;
  const stroke = textStrokeStyle(textOutlinePx);

  return (
    <article
      data-code={p?.c || ""}
      data-active={active ? "1" : "0"}
      style={{
        flex: `0 0 ${slotH}`,
        minHeight: 0,
        maxHeight: slotH,
      }}
      className={`menu-board-item menu-board-item--bleed relative overflow-hidden rounded-xl border transition-all duration-500 ease-out ${
        active ? "menu-board-shine menu-board-item--active" : ""
      } ${
        agotado
          ? "border-rose-800/40"
          : active
            ? "border-amber-300/70"
            : "border-[rgba(232,197,106,0.22)]"
      } ${flash ? "ring-2 ring-gold anim-in" : ""}`}
    >
      {/* Fondo foto platillo */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={imgCard}
          alt=""
          aria-hidden="true"
          className={`h-full w-full object-cover object-center ${
            agotado ? "grayscale opacity-40" : "opacity-85"
          }`}
          onError={(e) => {
            e.currentTarget.src = fallbackImageForProduct(p.c, p.tp);
          }}
        />
        {/* Fade horizontal → madera */}
        <div className="menu-board-bg-fade pointer-events-none absolute inset-0" />
        {agotado && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
              AGOTADO
            </span>
          </div>
        )}
      </div>

      {/* Contenido encima */}
      <div
        className={`relative z-[1] flex h-full items-center gap-2 ${
          dense ? "px-2 py-1 sm:px-2.5 sm:py-1.5" : "px-3 py-2"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center font-display font-black leading-none text-gold ${
            dense ? "w-7 text-xl sm:w-9 sm:text-2xl" : "w-12 text-4xl"
          }`}
          style={{
            ...stroke,
            ...(numSizePx
              ? {
                  fontSize: `${numSizePx}px`,
                  width: `${Math.max(28, numSizePx * 1.35)}px`,
                }
              : {}),
          }}
        >
          {num}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden pr-1">
          <p
            className={`line-clamp-2 font-bold leading-tight ${
              dense ? "text-xs sm:text-base" : "text-xl"
            } ${agotado ? "text-cream/50" : "text-ivory"}`}
            style={{
              ...stroke,
              ...(nameSizePx ? { fontSize: `${nameSizePx}px` } : {}),
            }}
          >
            {p.n}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`font-display font-semibold tabular-nums ${
              dense ? "text-sm sm:text-lg" : "text-2xl"
            } ${agotado ? "text-cream/40 line-through" : "text-gold"}`}
            style={{
              ...stroke,
              ...(priceSizePx ? { fontSize: `${priceSizePx}px` } : {}),
            }}
          >
            {formatC(p.pr)}
          </p>
        </div>
      </div>
    </article>
  );
}

/**
 * Hero foto grande 1:1 / full: rota productos del pool.
 */
export function MenuBoardHero({
  products = [],
  intervalMs = 5500,
  title = "Menú del día",
  includeAgotados = false,
  onActiveChange,
  textOutlinePx = 2,
  nameSizePx = null,
  priceSizePx = null,
  numSizePx = null,
  badgeSizePx = null,
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

  const safeIdx = pool.length ? idx % pool.length : 0;
  const activeProduct = pool.length ? pool[safeIdx] : null;

  useEffect(() => {
    if (!onActiveChange) return;
    onActiveChange(activeProduct || null);
  }, [activeProduct?.id, activeProduct?.c, onActiveChange]);

  if (!pool.length) {
    return (
      <div className="panel-oak-deep flex h-full min-h-0 items-center justify-center rounded-2xl p-6">
        <p className="text-center text-xl text-cream/50">Sin platillos</p>
      </div>
    );
  }

  const p = activeProduct;
  const img = p.img || imageForProduct(p.c, p.tp, p.imgV);
  const num = displayNumber(p, safeIdx);
  const isPromo = p.dst === 1 || p.dst === true || p.destacado === true;
  const badge = isPromo ? "Promoción del día" : title;
  const total = pool.length;
  const stroke = heroTextStrokeStyle(Math.max(5, Number(textOutlinePx) || 5));

  return (
    <div className="panel-oak-deep relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
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

        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ring-1 ${
              isPromo
                ? "bg-gradient-to-r from-[#a33a28] to-[#d4a84b] text-[#1a120c] ring-amber-300/50"
                : "bg-black/45 text-amber-200/90 ring-amber-400/30"
            }`}
            style={badgeSizePx ? { fontSize: `${badgeSizePx}px` } : undefined}
          >
            {badge}
          </span>
          <span
            className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-cream/80 ring-1 ring-white/15"
            style={badgeSizePx ? { fontSize: `${Math.round(badgeSizePx * 0.9)}px` } : undefined}
          >
            {safeIdx + 1} / {total}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end gap-3">
            <span
              className="font-display text-6xl font-black leading-none text-gold md:text-7xl"
              style={{
                ...stroke,
                ...(numSizePx ? { fontSize: `${numSizePx}px` } : {}),
              }}
            >
              {num}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <h2
                className="font-display text-3xl font-bold leading-tight text-ivory md:text-4xl"
                style={{
                  ...stroke,
                  ...(nameSizePx ? { fontSize: `${nameSizePx}px` } : {}),
                }}
              >
                {p.n}
              </h2>
              <p
                className="font-display mt-1 text-3xl text-gold md:text-4xl"
                style={{
                  ...stroke,
                  ...(priceSizePx ? { fontSize: `${priceSizePx}px` } : {}),
                }}
              >
                {formatC(p.pr)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1 bg-black/45 px-2 py-2">
          {total <= 16 ? (
            pool.map((item, i) => (
              <span
                key={item.id || item.c || i}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIdx ? "w-5 bg-amber-400" : "w-1.5 bg-white/30"
                }`}
              />
            ))
          ) : (
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

/** Panel de sección; si no hay title/subtitle, solo el listado. */
export function MenuBoardPanel({
  title = "",
  subtitle = "",
  titleSizePx = null,
  children,
  className = "",
}) {
  const showHead = Boolean(
    (title && String(title).trim()) || (subtitle && String(subtitle).trim())
  );
  return (
    <section
      className={`panel-oak-deep flex min-h-0 flex-col overflow-hidden rounded-2xl ${className}`}
    >
      {showHead && (
        <header className="shrink-0 border-b border-[rgba(232,197,106,0.2)] bg-black/35 px-3 py-2 sm:px-4 sm:py-2.5">
          {title && String(title).trim() && (
            <h2
              className="font-display text-xl font-bold tracking-wide text-gold sm:text-2xl md:text-3xl"
              style={titleSizePx ? { fontSize: `${titleSizePx}px` } : undefined}
            >
              {title}
            </h2>
          )}
          {subtitle && String(subtitle).trim() && (
            <p
              className="mt-0.5 text-xs text-cream/65 sm:text-sm"
              style={
                titleSizePx
                  ? { fontSize: `${Math.max(11, Math.round(titleSizePx * 0.55))}px` }
                  : undefined
              }
            >
              {subtitle}
            </p>
          )}
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-2.5">{children}</div>
    </section>
  );
}
