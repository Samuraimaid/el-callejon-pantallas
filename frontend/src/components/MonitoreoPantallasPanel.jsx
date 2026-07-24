import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useWebSocket } from "../hooks/useWebSocket";

const EMPTY = {
  master_power: true,
  pantallas: [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    etiqueta: `TV #${id}`,
    ruta: `/tv/${id}`,
    estado: "offline",
    power_on: true,
    volumen: 25,
    modo_evento: false,
    latencia_ms: null,
    snapshot: {},
  })),
};

function StatusBadge({ estado }) {
  const map = {
    online: { c: "bg-emerald-500", t: "En línea" },
    weak: { c: "bg-amber-400", t: "Señal débil" },
    offline: { c: "bg-rose-600", t: "Fuera de línea" },
    error: { c: "bg-orange-500", t: "Error de visualización" },
    standby: { c: "bg-stone-500", t: "Stand-by" },
  };
  const m = map[estado] || map.offline;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cream/90">
      <span className={`h-2.5 w-2.5 rounded-full ${m.c} shadow`} />
      {m.t}
    </span>
  );
}

/**
 * Matriz de monitoreo industrial: 6 TVs, power, volumen, modo evento, heartbeats.
 */
export default function MonitoreoPantallasPanel() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [evtBusy, setEvtBusy] = useState(false);
  const [contentStatus, setContentStatus] = useState(null);

  const load = useCallback(async () => {
    try {
      const st = await api.getPantallasEstado();
      setData(st);
      setErr("");
    } catch (e) {
      setErr(e.message || "No se pudo cargar estado");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContent = useCallback(async () => {
    try {
      const st = await api.getContentStatus();
      setContentStatus(st);
    } catch {
      try {
        const r = await api.getContentResources();
        setContentStatus({ resources: r, policy: r.policy });
      } catch {
        /* endpoint aún no disponible */
      }
    }
  }, []);

  useEffect(() => {
    load();
    loadContent();
    const id = window.setInterval(load, 5000);
    const id2 = window.setInterval(loadContent, 4000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(id2);
    };
  }, [load, loadContent]);

  useWebSocket("admin,pantallas", (ev) => {
    if (ev?.t === "hb" || ev?.t === "ctrl") load();
  });

  async function sendControl(body) {
    try {
      const st = await api.controlPantallas(body);
      setData(st);
      setMsg("Control enviado");
      window.setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setErr(e.message || "Error de control");
    }
  }

  async function onEventFile(file) {
    if (!file) return;
    setEvtBusy(true);
    try {
      await api.uploadEventoMedia(file, file.name);
      setMsg("Media de evento subida");
      window.setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setErr(e.message || "Error subiendo media");
    } finally {
      setEvtBusy(false);
    }
  }

  const master = data.master_power !== false;
  const pantallas = data.pantallas || EMPTY.pantallas;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Barra maestra */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stone-700/80 bg-black/40 px-4 py-3">
        <label className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-black/40 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-amber-200">
            Maestro
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={master}
            onClick={() => sendControl({ master_power: !master, all_tvs: true })}
            className={`relative h-7 w-12 rounded-full transition ${
              master ? "bg-emerald-500" : "bg-stone-600"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                master ? "left-5" : "left-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-cream/80">
            {master ? "Todas ON" : "Todas OFF"}
          </span>
        </label>

        <label className="tap cursor-pointer rounded-xl border border-stone-600 bg-stone-900/60 px-3 py-2 text-sm text-cream/90">
          {evtBusy ? "Subiendo…" : "📷 Media modo evento"}
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            disabled={evtBusy}
            onChange={(e) => onEventFile(e.target.files?.[0])}
          />
        </label>

        <button
          type="button"
          onClick={() => sendControl({ all_tvs: true, modo_evento: true })}
          className="tap rounded-xl bg-amber-600/80 px-3 py-2 text-sm font-bold text-stone-950"
        >
          Activar evento (todas)
        </button>
        <button
          type="button"
          onClick={() => sendControl({ all_tvs: true, modo_evento: false })}
          className="tap rounded-xl border border-stone-600 px-3 py-2 text-sm"
        >
          Salir evento
        </button>

        {msg && <span className="text-sm text-emerald-300">{msg}</span>}
        {err && <span className="text-sm text-rose-300">{err}</span>}
        {loading && <span className="text-sm text-cream/50">Cargando…</span>}
      </div>

      {/* Matriz 6 TVs */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ResourcePanel status={contentStatus} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pantallas.map((p) => (
            <TvTile
              key={p.id}
              p={p}
              master={master}
              onControl={sendControl}
              cacheInfo={contentStatus?.tv_cache?.[String(p.id)]}
              lease={contentStatus?.lease}
              videoTurn={contentStatus?.video_turn}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourcePanel({ status }) {
  if (!status?.resources && !status?.policy) return null;
  const r = status.resources || {};
  const pol = status.policy || r.policy || {};
  const level = pol.level || r.level || "ok";
  const levelColor =
    level === "hot"
      ? "border-rose-600/50 bg-rose-950/40"
      : level === "warm"
        ? "border-amber-600/40 bg-amber-950/30"
        : "border-emerald-700/40 bg-emerald-950/20";
  const lease = status.lease;
  const q = status.queue || [];

  return (
    <div className={`rounded-xl border p-3 ${levelColor}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-amber-100">
          📡 Sensor de carga · entrega 1 TV a la vez
        </h3>
        <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cream/80">
          {level}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-cream/80">
        <span>
          CPU <strong className="text-ivory">{r.cpu_percent ?? "—"}%</strong>
        </span>
        <span>
          RAM <strong className="text-ivory">{r.ram_percent ?? "—"}%</strong>
          {r.ram_available_mb != null && (
            <span className="text-stone-500"> ({r.ram_available_mb} MB libres)</span>
          )}
        </span>
        <span className="text-stone-400">{pol.message}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone-400">
        <span>
          Descarga activa:{" "}
          {lease
            ? `TV #${lease.tv_id}`
            : "ninguna (canal libre)"}
        </span>
        <span>Cola: {q.length}</span>
        <span>
          Video turno:{" "}
          {status.video_turn
            ? `TV #${status.video_turn.tv_id}`
            : "fotos autónomas"}
        </span>
        <span>
          ffmpeg: {pol.allow_ffmpeg ? "sí" : "no"} · videos:{" "}
          {pol.allow_video_play ? "sí" : "pausados"}
        </span>
      </div>
    </div>
  );
}

function TvTile({ p, master, onControl, cacheInfo, lease, videoTurn }) {
  const on = p.power_on !== false && master;
  const snap = p.snapshot || {};
  const isDownloading = lease && Number(lease.tv_id) === Number(p.id);
  const isVideoTurn =
    videoTurn && Number(videoTurn.tv_id) === Number(p.id);
  const preview =
    snap.thumb ||
    (p.id <= 2
      ? "/images/slides/slide-platos-mixtos.jpg"
      : "/images/slides/slide5-bienvenidos.jpg");

  return (
    <div className="panel-oak flex flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-video bg-black">
        {!on ? (
          <div className="flex h-full items-center justify-center bg-black">
            <span className="text-xs text-stone-600">STANDBY</span>
          </div>
        ) : p.modo_evento ? (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-amber-900/40 to-black">
            <span className="text-2xl">🎉</span>
            <span className="mt-1 text-xs text-amber-200">MODO EVENTO</span>
          </div>
        ) : (
          <iframe
            title={p.etiqueta}
            src={`${p.ruta || `/tv/${p.id}`}?embed=1`}
            className="h-full w-full scale-[1] border-0 opacity-95"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5">
          <StatusBadge estado={p.estado} />
        </div>
        {p.latencia_ms != null && (
          <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-cream/70">
            {p.latencia_ms} ms
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {isDownloading && (
            <span className="rounded bg-sky-700/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              ↓ DESCARGANDO
            </span>
          )}
          {isVideoTurn && (
            <span className="rounded bg-violet-700/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              ▶ VIDEO TURNO
            </span>
          )}
          {cacheInfo?.version && (
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-emerald-200/90">
              caché v{String(cacheInfo.version).slice(0, 6)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-ivory">{p.etiqueta}</p>
            <p className="font-mono text-[11px] text-cream/45">{p.ruta}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              onControl({ tv_id: p.id, power_on: !p.power_on })
            }
            className={`tap rounded-full px-3 py-1 text-xs font-bold ${
              on ? "bg-emerald-600/80 text-white" : "bg-stone-700 text-stone-300"
            }`}
          >
            {on ? "ON" : "OFF"}
          </button>
        </div>

        <label className="block text-[11px] text-cream/55">
          Volumen {p.volumen ?? 25}%
          <input
            type="range"
            min={0}
            max={100}
            value={p.volumen ?? 25}
            onChange={(e) =>
              onControl({ tv_id: p.id, volumen: Number(e.target.value) })
            }
            className="mt-1 w-full accent-amber-500"
          />
        </label>

        <button
          type="button"
          onClick={() =>
            onControl({ tv_id: p.id, modo_evento: !p.modo_evento })
          }
          className={`tap w-full rounded-xl py-2 text-xs font-bold ${
            p.modo_evento
              ? "bg-amber-500 text-stone-950"
              : "border border-stone-600 text-cream/80"
          }`}
        >
          {p.modo_evento ? "Evento activo" : "Modo evento"}
        </button>

        {p.error_msg && (
          <p className="truncate text-[11px] text-rose-300">⚠️ {p.error_msg}</p>
        )}
        {snap.screen && (
          <p className="truncate text-[10px] text-cream/40">
            {snap.screen}
            {snap.slide != null ? ` · slide ${snap.slide}` : ""}
            {snap.n_platillos != null ? ` · ${snap.n_platillos} platos` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
