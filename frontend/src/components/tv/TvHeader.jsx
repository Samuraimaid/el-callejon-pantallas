import { LOGO_URL } from "../../lib/constants";

/** Cabecera compacta (~100–110px) para dejar 160px total con la franja de promo */
export default function TvHeader({ subtitle, wsStatus, clock }) {
  return (
    <header className="flex h-[112px] shrink-0 items-center justify-between gap-4 border-b border-[rgba(232,197,106,0.28)] bg-[rgba(30,6,3,0.55)] px-5 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={LOGO_URL}
          alt="El Callejón"
          className="h-14 w-14 shrink-0 rounded-full object-cover shadow-lg ring-2 ring-[rgba(232,197,106,0.45)]"
        />
        <div className="min-w-0">
          <h1 className="font-display truncate text-3xl tracking-tight text-ivory drop-shadow">
            El Callejón
          </h1>
          <p className="truncate text-base text-cream/80">{subtitle}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-2xl text-gold">
          {clock.toLocaleTimeString("es-NI", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="text-xs text-cream/60">
          WS {wsStatus === "live" ? "● en vivo" : "○ reconectando"}
        </p>
      </div>
    </header>
  );
}
