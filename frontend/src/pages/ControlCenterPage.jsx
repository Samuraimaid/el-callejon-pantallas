import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GestionarMenuPanel from "../components/GestionarMenuPanel";
import Logo from "../components/Logo";
import MenuBoardConfigPanel from "../components/MenuBoardConfigPanel";
import MonitoreoPantallasPanel from "../components/MonitoreoPantallasPanel";
import PublicidadAdminPanel from "../components/PublicidadAdminPanel";
import AmbientMusicPanel from "../components/AmbientMusicPanel";
import AmbientMiniPlayer from "../components/AmbientMiniPlayer";
import { useWebSocket } from "../hooks/useWebSocket";
import { clearSession, getUser } from "../lib/auth";

const TABS = [
  { id: "monitor", label: "Monitoreo", short: "TVs", icon: "📡" },
  { id: "menu", label: "Menú del día", short: "Menú", icon: "🍽️" },
  { id: "board", label: "Diseño TV1–2", short: "Diseño", icon: "🖼️" },
  { id: "publicidad", label: "Campañas", short: "Ads", icon: "📺" },
  { id: "ambient", label: "Ambiente", short: "Música", icon: "♪" },
];

/**
 * Centro de Control — optimizado PC + móvil portrait (iPhone/Android).
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
      setFlash(`Menú: ${ev.c || ev.n || ev.id}`);
      window.setTimeout(() => setFlash(""), 2000);
    }
    if (ev.t === "+") {
      setFlash(`Creado: ${ev.n || ev.c}`);
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "-") {
      setFlash(`Eliminado: ${ev.c || ev.id}`);
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "pub") {
      setFlash(`Campaña ${ev.zona}`);
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "cfg") {
      setFlash("Diseño TV actualizado");
      window.setTimeout(() => setFlash(""), 2500);
    }
    if (ev.t === "ctrl") {
      setFlash("Control enviado");
      window.setTimeout(() => setFlash(""), 1500);
    }
    if (ev.t === "evt_tpl") {
      setFlash(
        ev.template_id
          ? `Plantilla evento: ${ev.template_id}`
          : "Plantilla evento limpia"
      );
      window.setTimeout(() => setFlash(""), 2200);
    }
    // now_playing: NO flash en admin (mueve el layout); va al mini-reproductor
  });

  function logout() {
    clearSession();
    nav("/login", { replace: true });
  }

  return (
    <div className="bg-oak-wood flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden text-ivory">
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-[rgba(232,197,106,0.2)] bg-black/45 px-2.5 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Logo size="sm" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
          <div className="min-w-0">
            <h1 className="font-display truncate text-base leading-tight text-ivory sm:text-xl">
              Control
            </h1>
            <p className="truncate text-[10px] text-cream/55 sm:text-[11px]">
              {user?.nombre || "Operador"}
              <span
                className={
                  wsStatus === "on"
                    ? "ml-1 text-emerald-400"
                    : "ml-1 text-amber-400"
                }
              >
                · {wsStatus === "on" ? "vivo" : "…"}
              </span>
            </p>
          </div>
        </div>

        {/* Mini player: centro, no desplaza columnas del monitoreo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
          <div className="pointer-events-auto">
            <AmbientMiniPlayer />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <a
            href="/"
            className="tap rounded-lg border border-stone-600 px-2.5 py-2 text-[11px] text-cream/80 sm:px-3 sm:text-xs"
          >
            Inicio
          </a>
          <button
            type="button"
            onClick={logout}
            className="tap rounded-lg bg-stone-800 px-2.5 py-2 text-[11px] font-semibold text-stone-200 sm:px-3 sm:text-xs"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Mini player en móvil: fila propia sin empujar el grid de TVs */}
      <div className="flex shrink-0 justify-center border-b border-stone-800/60 bg-black/30 px-2 py-1.5 sm:hidden">
        <AmbientMiniPlayer />
      </div>

      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-emerald-900/95 px-3 py-1.5 text-center text-xs text-emerald-100 shadow-lg sm:top-16 sm:text-sm">
          {flash}
        </div>
      )}

      {/* Tabs: 2×2 en móvil, fila en desktop */}
      <div className="admin-tabs flex shrink-0 gap-1 border-b border-stone-800 bg-black/35 p-1.5 sm:gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`tap flex flex-1 flex-col items-center justify-center rounded-lg px-1 py-2 font-bold sm:flex-row sm:gap-1 sm:px-2 sm:text-sm ${
              tab === t.id
                ? "bg-gradient-to-r from-[#a33a28] to-[#d4a84b] text-[#1a120c]"
                : "bg-stone-800/80 text-stone-300"
            }`}
          >
            <span className="text-base leading-none sm:text-sm">{t.icon}</span>
            <span className="mt-0.5 text-[10px] sm:mt-0 sm:hidden">
              {t.short}
            </span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <main className="admin-main flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "monitor" && <MonitoreoPantallasPanel />}
        {tab === "menu" && <GestionarMenuPanel embedded />}
        {tab === "board" && <MenuBoardConfigPanel />}
        {tab === "publicidad" && <PublicidadAdminPanel />}
        {tab === "ambient" && <AmbientMusicPanel />}
      </main>
    </div>
  );
}
