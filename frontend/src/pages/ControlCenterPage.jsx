import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GestionarMenuPanel from "../components/GestionarMenuPanel";
import Logo from "../components/Logo";
import MenuBoardConfigPanel from "../components/MenuBoardConfigPanel";
import MonitoreoPantallasPanel from "../components/MonitoreoPantallasPanel";
import PublicidadAdminPanel from "../components/PublicidadAdminPanel";
import { useWebSocket } from "../hooks/useWebSocket";
import { clearSession, getUser } from "../lib/auth";

const TABS = [
  { id: "monitor", label: "Monitoreo TVs", icon: "📡" },
  { id: "menu", label: "Menú del Día", icon: "🍽️" },
  { id: "board", label: "Diseño TV #1–#2", icon: "🖼️" },
  { id: "publicidad", label: "Campañas TV #3–#6", icon: "📺" },
];

/**
 * Centro de Control de Pantallas — único panel administrador.
 * Pestaña 1: existencias/precios/nombres → WS a TVs 50" menú
 * Pestaña 2: tarjetas visibles / títulos del menú board
 * Pestaña 3: campañas TV3–TV6 independientes
 */
export default function ControlCenterPage() {
  const nav = useNavigate();
  const user = getUser();
  const [tab, setTab] = useState("monitor");
  const [wsStatus, setWsStatus] = useState("off");
  const [flash, setFlash] = useState("");

  useWebSocket("admin,pantallas", (ev) => {
    if (!ev?.t) return;
    if (ev.t === "h") setWsStatus("on");
    if (ev.t === "p" || ev.t === "z") {
      setFlash(`Menú actualizado: ${ev.c || ev.n || ev.id}`);
      window.setTimeout(() => setFlash(""), 2000);
    }
    if (ev.t === "+") {
      setFlash(`Producto creado: ${ev.n || ev.c}`);
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "-") {
      setFlash(`Producto eliminado: ${ev.c || ev.id}`);
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "pub") {
      setFlash(`Campaña ${ev.zona} publicada en TVs`);
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "cfg") {
      setFlash("Diseño de menú TV actualizado");
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "hb") {
      /* silencioso — panel de monitoreo se refresca solo */
    }
    if (ev.t === "ctrl") {
      setFlash("Control remoto enviado a pantallas");
      window.setTimeout(() => setFlash(""), 1800);
    }
  });

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

  return (
    <div className="bg-oak-wood flex h-screen max-h-screen flex-col overflow-hidden text-ivory">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[rgba(232,197,106,0.2)] bg-black/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div>
            <h1 className="font-display text-xl text-ivory sm:text-2xl">
              Centro de Control de Pantallas
            </h1>
            <p className="text-xs text-cream/60">
              {user?.nombre || "Operador"} ·{" "}
              <span
                className={
                  wsStatus === "on" ? "text-emerald-400" : "text-amber-400"
                }
              >
                WS {wsStatus === "on" ? "en vivo" : "conectando…"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/"
            className="tap rounded-xl border border-stone-600 px-3 py-2 text-sm text-cream/80"
          >
            Inicio
          </a>
          <button
            type="button"
            onClick={logout}
            className="tap rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-stone-200"
          >
            Salir
          </button>
        </div>
      </header>

      {flash && (
        <div className="shrink-0 bg-emerald-900/80 px-4 py-2 text-center text-sm text-emerald-100">
          {flash}
        </div>
      )}

      <div className="flex shrink-0 gap-2 border-b border-stone-800 bg-black/30 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`tap flex-1 rounded-xl px-3 py-3 text-sm font-bold sm:text-base ${
              tab === t.id
                ? "bg-gradient-to-r from-[#a33a28] to-[#d4a84b] text-[#1a120c]"
                : "bg-stone-800/80 text-stone-300"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Área flexible: scroll interno + flechas del teclado */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "monitor" && <MonitoreoPantallasPanel />}
        {tab === "menu" && <GestionarMenuPanel embedded />}
        {tab === "board" && <MenuBoardConfigPanel />}
        {tab === "publicidad" && <PublicidadAdminPanel />}
      </main>
    </div>
  );
}
