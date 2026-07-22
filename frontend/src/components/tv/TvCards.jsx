import {
  fallbackImageForProduct,
  formatC,
  imageForProduct,
} from "../../lib/constants";
import { isAgotado } from "../../hooks/useMenuTv";

/** Tarjeta de platillo con foto — actualizable en caliente (WS t=img|p|z) */
export function PlatilloCard({ p, flash, large = false }) {
  const agotado = isAgotado(p);
  const img = p.img || imageForProduct(p.c, p.tp, p.imgV);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border shadow-lg transition duration-300 ${
        agotado
          ? "border-rose-700/50"
          : "border-[rgba(232,197,106,0.28)]"
      } ${flash ? "ring-2 ring-gold anim-in" : ""} ${
        large ? "col-span-1" : ""
      }`}
    >
      <div className={`relative w-full ${large ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
        <img
          key={`${p.c}-${p.imgV || p.img || "0"}`}
          src={img}
          alt={p.n}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
            agotado ? "scale-105 opacity-50 grayscale" : ""
          }`}
          onError={(e) => {
            e.currentTarget.src = fallbackImageForProduct(p.c, p.tp);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {agotado && (
          <>
            <div className="absolute inset-0 bg-[rgba(40,8,4,0.45)] backdrop-blur-sm" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-8deg] rounded-xl border-4 border-rose-500 bg-rose-600/95 px-4 py-2 text-2xl font-black tracking-widest text-white shadow-2xl">
                AGOTADO
              </span>
            </div>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p
            className={`line-clamp-2 font-bold leading-tight drop-shadow ${
              large ? "text-2xl" : "text-lg"
            } ${agotado ? "text-cream/60" : "text-ivory"}`}
          >
            {p.n}
          </p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p
              className={`font-display ${large ? "text-3xl" : "text-2xl"} ${
                agotado ? "text-cream/40 line-through" : "text-gold"
              }`}
            >
              {formatC(p.pr)}
            </p>
            {!agotado && (
              <span className="rounded-full bg-emerald-700/85 px-2 py-0.5 text-xs font-semibold uppercase text-ivory">
                Disponible
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Fila con miniatura para complementos */
export function ComplementoCard({ p, flash }) {
  const agotado = isAgotado(p);
  const img = p.img || imageForProduct(p.c, p.tp, p.imgV);

  return (
    <div
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 transition ${
        agotado
          ? "border-rose-800/50 bg-black/30"
          : "border-[rgba(232,197,106,0.22)] bg-black/25"
      } ${flash ? "ring-2 ring-gold anim-in" : ""}`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-[rgba(232,197,106,0.25)]">
        <img
          key={`${p.c}-${p.imgV || p.img || "0"}`}
          src={img}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover ${
            agotado ? "opacity-50 grayscale" : ""
          }`}
          onError={(e) => {
            e.currentTarget.src = fallbackImageForProduct(p.c, p.tp);
          }}
        />
        {agotado && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-lg font-semibold ${
            agotado ? "text-cream/50" : "text-ivory"
          }`}
        >
          {p.n}
        </p>
        {agotado ? (
          <p className="text-sm font-bold uppercase tracking-wide text-rose-400">
            Agotado
          </p>
        ) : (
          <p className="font-display text-xl text-gold">{formatC(p.pr)}</p>
        )}
      </div>
      {agotado && (
        <span className="shrink-0 rounded-lg bg-rose-600 px-2 py-1 text-xs font-black text-white">
          AGOTADO
        </span>
      )}
    </div>
  );
}
