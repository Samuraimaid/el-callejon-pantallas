import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

const DAYS = [
  { v: 0, l: "Do" },
  { v: 1, l: "Lu" },
  { v: 2, l: "Ma" },
  { v: 3, l: "Mi" },
  { v: 4, l: "Ju" },
  { v: 5, l: "Vi" },
  { v: 6, l: "Sa" },
];

const MODES = [
  {
    id: "content",
    title: "Sin software",
    desc: "Multimedia, fotos, videos, campañas, BD y configs de usuario. Ideal diario.",
  },
  {
    id: "full",
    title: "Con software",
    desc: "Todo lo anterior + código, scripts y docker-compose.",
  },
  {
    id: "migrate",
    title: "Migrar equipo",
    desc: "Paquete completo + instalador (INSTALLAR.bat) para copiar a otro PC.",
  },
];

function fmtTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(Number(ts) * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Panel de respaldos automáticos personalizables.
 */
export default function BackupPanel() {
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const c = await api.backupConfig();
      setCfg(c.config || c);
      const s = await api.backupStatus();
      setStatus(s);
      setErr("");
    } catch (e) {
      setErr(e.message || "No se pudo cargar config de respaldo");
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  function patchLocal(p) {
    setCfg((prev) => ({ ...prev, ...p }));
  }

  function patchInclude(key, val) {
    setCfg((prev) => ({
      ...prev,
      include: { ...(prev?.include || {}), [key]: val },
    }));
  }

  async function save() {
    if (!cfg) return;
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const body = {
        enabled: !!cfg.enabled,
        time: cfg.time || "15:30",
        days: cfg.days || [0, 1, 2, 3, 4, 5, 6],
        destination: cfg.destination || "",
        mode: cfg.mode || "content",
        incremental: cfg.incremental !== false,
        keep_days: Number(cfg.keep_days) || 14,
        keep_full_count: Number(cfg.keep_full_count) || 3,
        include: cfg.include || {},
        migrate_bundle: !!cfg.migrate_bundle || cfg.mode === "migrate",
      };
      const r = await api.backupConfigUpdate(body);
      setCfg(r.config || r);
      setMsg(r.message || "Guardado");
      window.setTimeout(() => setMsg(""), 4000);
      await load();
    } catch (e) {
      setErr(e.message || "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  async function run(mode = "cloud") {
    setBusy(true);
    setMsg("Generando respaldo en Google Cloud Storage…");
    setErr("");
    try {
      const r = await api.backupRun({ mode });
      setMsg(r.message || "Respaldo guardado exitosamente en Google Cloud Storage.");
      window.setTimeout(() => setMsg(""), 6000);
      await load();
    } catch (e) {
      setErr(e.message || "Error al generar respaldo en la nube");
    } finally {
      setBusy(false);
    }
  }

  async function downloadManualNow() {
    setBusy(true);
    setMsg("Generando respaldo y preparando descarga manual…");
    setErr("");
    try {
      await api.downloadBackupNow();
      setMsg("Descarga del archivo ZIP iniciada exitosamente.");
      window.setTimeout(() => setMsg(""), 4000);
      await load();
    } catch (e) {
      setErr(e.message || "Error al descargar respaldo");
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(filename) {
    if (!filename) return;
    setBusy(true);
    setMsg(`Iniciando descarga de ${filename}…`);
    setErr("");
    try {
      await api.downloadBackupFile(filename);
      setMsg(`Descarga de ${filename} completada.`);
      window.setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setErr(e.message || "Error al descargar archivo");
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) {
    return (
      <div className="p-4 text-cream/70">
        {err || "Cargando config de respaldo…"}
      </div>
    );
  }

  const days = Array.isArray(cfg.days) ? cfg.days : [0, 1, 2, 3, 4, 5, 6];
  const allDays = days.length === 7;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <header>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl text-amber-100">
              Respaldos en Google Cloud Storage
            </h2>
            <span className="rounded-full bg-emerald-950/80 border border-emerald-600/50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
              ☁️ En la nube
            </span>
          </div>
          <p className="mt-1 text-sm text-cream/70">
            Administración centralizada en Google Cloud Storage (<code className="text-lime-300">gs://callejon-multimedia-pos/backups/</code>).
            No ocupa almacenamiento local en tu equipo salvo que realices una descarga manual.
          </p>
        </header>

        {msg && (
          <p className="rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
            {msg}
          </p>
        )}
        {err && (
          <p className="rounded-xl border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">
            {err}
          </p>
        )}

        {/* Estado */}
        <section className="rounded-xl border border-stone-700/80 bg-black/35 p-4 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90 flex items-center gap-1.5">
              <span>☁️</span> Estado del Último Respaldo
            </h3>
            {status?.last_size && (
              <span className="text-xs font-mono font-bold text-amber-300 bg-stone-900 border border-amber-600/30 px-2 py-0.5 rounded">
                {status.last_size}
              </span>
            )}
          </div>
          <dl className="mt-3 grid gap-2 text-sm text-cream/80 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase text-stone-500">Estado</dt>
              <dd className="font-semibold text-emerald-300">
                {status?.last_status === "success" ? "✓ Guardado con éxito en GCS" : (status?.last_status || "—")}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-stone-500">Fecha y Hora</dt>
              <dd>{fmtTs(status?.last_run || cfg.last_run)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-stone-500">Ubicación en Google Cloud</dt>
              <dd className="break-all font-mono text-xs text-lime-200/90 bg-black/50 p-2 rounded-lg border border-stone-800">
                {status?.last_path || "gs://callejon-multimedia-pos/backups/"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Horario y Destino Cloud */}
        <section className="rounded-xl border border-stone-700/80 bg-black/35 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Destino y Programación Automática
          </h3>

          <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-200">
                Destino en la Nube
              </span>
              <span className="rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Google Cloud Storage
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-lime-200/90 break-all">
              gs://callejon-multimedia-pos/backups/
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              Las copias de seguridad de base de datos Neon PostgreSQL y metadatos se guardan de forma redundante y permanente en Google Cloud.
            </p>
          </div>

          <label className="flex items-center justify-between gap-2 text-sm text-cream/85 pt-1">
            <span>Respaldo diario automático activado</span>
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              disabled={busy}
              onChange={(e) => patchLocal({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-stone-700 bg-stone-900 text-amber-600 focus:ring-amber-500"
            />
          </label>
          <label className="block text-sm text-cream/85">
            Hora de respaldo (24h)
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-ivory"
              value={cfg.time || "15:30"}
              disabled={busy}
              onChange={(e) => patchLocal({ time: e.target.value })}
            />
          </label>
          <div>
            <p className="text-[10px] uppercase text-stone-500">Días programados</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => patchLocal({ days: [0, 1, 2, 3, 4, 5, 6] })}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer ${
                  allDays
                    ? "bg-amber-500/30 text-amber-100 border border-amber-500/40"
                    : "bg-stone-800 text-cream/60"
                }`}
              >
                Todos
              </button>
              {DAYS.map((d) => {
                const on = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      let next = on
                        ? days.filter((x) => x !== d.v)
                        : [...days, d.v].sort((a, b) => a - b);
                      if (!next.length) next = [d.v];
                      patchLocal({ days: next });
                    }}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer ${
                      on
                        ? "bg-emerald-600/40 text-emerald-100 border border-emerald-500/40"
                        : "bg-stone-800 text-cream/55"
                    }`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Acciones Rápidas */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => run("cloud")}
            className="tap rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 px-5 py-3 text-sm font-bold text-stone-950 hover:brightness-110 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <span>☁️</span>
            <span>{busy ? "Procesando…" : "Hacer respaldo ahora en Google Cloud"}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={downloadManualNow}
            className="tap rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <span>📥</span>
            <span>Descargar respaldo manual (ZIP)</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="tap rounded-xl border border-stone-600 bg-stone-900/80 px-4 py-3 text-sm font-semibold text-stone-200 hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
          >
            Guardar horario
          </button>
        </div>

        {/* Historial en Google Cloud Storage con descarga */}
        {status?.history?.length > 0 && (
          <section className="rounded-xl border border-stone-700/80 bg-black/35 p-4 shadow-md">
            <div className="flex items-center justify-between border-b border-stone-700/60 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90 flex items-center gap-1.5">
                <span>☁️</span> Respaldos Disponibles en Google Cloud
              </h3>
              <span className="text-[11px] text-stone-400">
                {status.history.length} copia(s)
              </span>
            </div>
            <ul className="mt-3 divide-y divide-stone-800/80 max-h-64 overflow-y-auto pr-1">
              {status.history.map((h, i) => {
                const fname = h.filename || h.path?.split("/").pop() || `backup_${i}.zip`;
                return (
                  <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ivory truncate">
                          {fname}
                        </span>
                        {h.size_human && (
                          <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                            {h.size_human}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone-400">
                        📅 {fmtTs(h.created_at || h.ts)} · <span className="text-emerald-400 font-medium">Google Cloud Storage</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => downloadFile(fname)}
                      className="tap shrink-0 rounded-lg bg-emerald-950/70 border border-emerald-600/60 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>⬇️</span>
                      <span>Descargar</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
