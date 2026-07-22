import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { getPublicOrigin } from "../lib/constants";

/**
 * Enlaces cortos /tv/N para que cada Smart TV guarde su favorito
 * y abra la pantalla correcta al iniciar el navegador.
 */
const SCREENS = [
  {
    to: "/tv/1",
    num: "1",
    label: "Menú Comidas 50″",
    desc: "Platillos · autoscroll",
  },
  {
    to: "/tv/2",
    num: "2",
    label: "Complementos 50″",
    desc: "Jugos, refrescos y cafés",
  },
  {
    to: "/tv/3",
    num: "3",
    label: "Publicidad Barra 50″",
    desc: "Bebidas y picada",
  },
  {
    to: "/tv/4",
    num: "4",
    label: "Publicidad Parrilla 50″",
    desc: "Asados y costilla",
  },
  {
    to: "/tv/5",
    num: "5",
    label: "Publicidad VIP 60″",
    desc: "Salón y ambiente",
  },
  {
    to: "/tv/6",
    num: "6",
    label: "Platillos VIP 60″",
    desc: "Especiales VIP",
  },
];

function isLoopbackHost(hostname) {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export default function HomePage() {
  const [origin, setOrigin] = useState(() => getPublicOrigin());
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setOrigin(getPublicOrigin());
  }, []);

  const hostname = useMemo(() => {
    try {
      return new URL(origin).hostname;
    } catch {
      return "localhost";
    }
  }, [origin]);

  const isLan = !isLoopbackHost(hostname);

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="bg-oak-wood flex min-h-screen flex-col items-center justify-center gap-5 p-4 text-ivory sm:p-6">
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
        <Logo size="lg" showText />
        <div className="text-center sm:text-left">
          <h1 className="font-display text-2xl text-ivory sm:text-3xl">
            El Callejón · Pantallas Digitales
          </h1>
          <p className="text-sm text-cream/70">
            6 Smart TVs · León, Nicaragua
          </p>
        </div>
      </div>

      {/* Dirección de red para las TVs */}
      <div className="panel-oak w-full max-w-5xl rounded-2xl border border-amber-400/25 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
              Dirección en la red local
            </p>
            <p className="mt-1 break-all font-mono text-base text-ivory sm:text-lg">
              {origin}
            </p>
            <p className="mt-1 text-xs text-cream/60">
              {isLan
                ? "Las TVs de esta red pueden abrir esta IP y guardar su favorito."
                : "En las TVs use la IP del servidor (ipconfig → IPv4), no localhost."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText(origin, "hub")}
            className="tap shrink-0 rounded-xl border border-amber-400/40 bg-black/30 px-3 py-2 text-sm text-amber-100"
          >
            {copied === "hub" ? "Copiado ✓" : "Copiar hub"}
          </button>
        </div>
      </div>

      <div className="w-full max-w-5xl space-y-3">
        <Link
          to="/login"
          className="tap block rounded-2xl bg-gradient-to-r from-[#a33a28] to-[#d4a84b] py-3.5 text-center text-lg font-bold text-[#1a120c]"
        >
          Centro de Control de Pantallas
        </Link>

        <p className="text-center text-xs uppercase tracking-[0.2em] text-amber-300/80">
          Elija la pantalla de este televisor
        </p>

        {/* 3 columnas × 2 filas = 6 TVs, sin scroll largo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENS.map((s) => {
            const full = `${origin}${s.to}`;
            return (
              <div
                key={s.to}
                className="panel-oak flex h-full flex-col rounded-2xl px-3 py-3 transition hover:ring-1 hover:ring-amber-400/40"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#a33a28]/90 to-[#d4a84b]/80 font-display text-xl font-bold text-[#1a120c] shadow">
                    {s.num}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/80">
                      TV #{s.num}
                    </p>
                    <Link
                      to={s.to}
                      className="tap block text-base font-semibold leading-snug text-ivory hover:text-amber-200"
                    >
                      {s.label}
                    </Link>
                    <p className="mt-0.5 text-xs text-cream/55">{s.desc}</p>
                  </div>
                </div>

                <p className="mt-2 truncate font-mono text-[10px] text-amber-300/80">
                  {full}
                </p>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                  <Link
                    to={s.to}
                    className="tap flex-1 rounded-lg bg-amber-500/25 px-2 py-2 text-center text-xs font-bold text-amber-100"
                  >
                    Abrir
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyText(full, s.to)}
                    className="tap rounded-lg border border-stone-600 px-2 py-2 text-xs text-cream/75"
                  >
                    {copied === s.to ? "✓" : "Copiar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="max-w-5xl text-center text-xs leading-relaxed text-cream/45">
        En el TV: abra <strong className="text-cream/70">{origin}</strong> →
        elija su número →{" "}
        <strong className="text-cream/70">Favoritos</strong> o{" "}
        <strong className="text-cream/70">Página de inicio</strong>. Ejemplo:{" "}
        <span className="font-mono text-cream/60">{origin}/tv/3</span>
      </p>
    </div>
  );
}
