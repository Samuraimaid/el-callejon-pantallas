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

  async function run(mode) {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      let r;
      if (mode === "content") r = await api.backupRunContent();
      else if (mode === "full") r = await api.backupRunFull();
      else if (mode === "migrate") r = await api.backupRunMigrate();
      else r = await api.backupRun({ mode: cfg?.mode || "content" });
      setMsg(r.message || "Encolado");
      window.setTimeout(() => setMsg(""), 6000);
      await load();
    } catch (e) {
      setErr(e.message || "Error al encolar");
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
          <h2 className="font-display text-xl text-amber-100">
            Respaldos automáticos
          </h2>
          <p className="mt-1 text-sm text-cream/60">
            Incremental · horario personalizable · sin software / con software /
            paquete migración. El worker de Windows ejecuta la copia (no Docker).
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
        <section className="rounded-xl border border-stone-700/80 bg-black/35 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Último respaldo
          </h3>
          <dl className="mt-2 grid gap-1 text-sm text-cream/80 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase text-stone-500">Estado</dt>
              <dd className="font-semibold">
                {status?.last_status || cfg.last_status || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-stone-500">Cuando</dt>
              <dd>{fmtTs(status?.last_run || cfg.last_run)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase text-stone-500">Ruta</dt>
              <dd className="break-all font-mono text-xs text-lime-200/80">
                {status?.last_path || cfg.last_path || "—"}
              </dd>
            </div>
            {status?.pending_request?.status === "pending" && (
              <div className="sm:col-span-2 text-amber-200">
                Petición pendiente en worker…
              </div>
            )}
          </dl>
        </section>

        {/* Horario */}
        <section className="rounded-xl border border-stone-700/80 bg-black/35 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Programación
          </h3>
          <label className="mt-3 flex items-center justify-between gap-2 text-sm text-cream/85">
            <span>Respaldo automático activado</span>
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              disabled={busy}
              onChange={(e) => patchLocal({ enabled: e.target.checked })}
            />
          </label>
          <label className="mt-3 block text-sm text-cream/85">
            Hora (local, 24h)
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-ivory"
              value={cfg.time || "15:30"}
              disabled={busy}
              onChange={(e) => patchLocal({ time: e.target.value })}
            />
          </label>
          <div className="mt-3">
            <p className="text-[10px] uppercase text-stone-500">Días</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  patchLocal({ days: [0, 1, 2, 3, 4, 5, 6] })
                }
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  allDays
                    ? "bg-amber-500/30 text-amber-100"
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
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      on
                        ? "bg-emerald-600/40 text-emerald-100"
                        : "bg-stone-800 text-cream/55"
                    }`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="mt-3 block text-sm text-cream/85">
            Carpeta destino (vacío = snapshots\daily)
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 font-mono text-xs text-ivory"
              placeholder="C:\EL_CALLEJON_POS\snapshots\daily"
              value={cfg.destination || ""}
              disabled={busy}
              onChange={(e) => patchLocal({ destination: e.target.value })}
            />
          </label>
        </section>

        {/* Modo */}
        <section className="rounded-xl border border-stone-700/80 bg-black/35 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Tipo de respaldo (programado)
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  patchLocal({
                    mode: m.id,
                    migrate_bundle: m.id === "migrate",
                  })
                }
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  cfg.mode === m.id
                    ? "border-amber-400/70 bg-amber-950/40"
                    : "border-stone-700 bg-black/30 hover:border-stone-500"
                }`}
              >
                <p className="font-bold text-ivory">{m.title}</p>
                <p className="mt-1 text-[11px] text-cream/55">{m.desc}</p>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between gap-2 text-sm text-cream/85">
            <span>
              Incremental
              <span className="mt-0.5 block text-[10px] font-normal text-cream/45">
                Solo escribe archivos nuevos o modificados (espejo + journal)
              </span>
            </span>
            <input
              type="checkbox"
              checked={cfg.incremental !== false}
              disabled={busy}
              onChange={(e) => patchLocal({ incremental: e.target.checked })}
            />
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-sm text-cream/85">
              Conservar journal (días)
              <input
                type="number"
                min={1}
                max={365}
                className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2"
                value={cfg.keep_days ?? 14}
                disabled={busy}
                onChange={(e) =>
                  patchLocal({ keep_days: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm text-cream/85">
              Copias full/migrate a conservar
              <input
                type="number"
                min={1}
                max={30}
                className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2"
                value={cfg.keep_full_count ?? 3}
                disabled={busy}
                onChange={(e) =>
                  patchLocal({ keep_full_count: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </section>

        {/* Includes finos */}
        <section className="rounded-xl border border-stone-700/80 bg-black/35 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Contenido incluido
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-cream/85 sm:grid-cols-3">
            {[
              ["music", "Música (Music/)"],
              ["images", "Fotos / public"],
              ["videos", "Videos campañas"],
              ["postgres", "Base de datos"],
              ["env", ".env"],
              ["config", "Configs (app/data)"],
              ["source_code", "Código fuente"],
              ["installer", "Scripts instalador"],
              ["docker_compose", "docker-compose"],
            ].map(([k, lab]) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cfg.include?.[k] !== false}
                  disabled={busy}
                  onChange={(e) => patchInclude(k, e.target.checked)}
                />
                <span className="text-[12px]">{lab}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="tap rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 disabled:opacity-50"
          >
            Guardar configuración
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("content")}
            className="tap rounded-xl border border-stone-600 px-3 py-2.5 text-sm font-semibold text-cream/90"
          >
            Ahora · sin software
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("full")}
            className="tap rounded-xl border border-stone-600 px-3 py-2.5 text-sm font-semibold text-cream/90"
          >
            Ahora · con software
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("migrate")}
            className="tap rounded-xl border border-violet-600/60 bg-violet-950/40 px-3 py-2.5 text-sm font-semibold text-violet-100"
          >
            Ahora · migrar PC
          </button>
        </div>

        <p className="text-[11px] text-cream/45">
          API: <code className="text-lime-400/80">GET/PUT /api/backup/config</code>{" "}
          · <code className="text-lime-400/80">POST /api/backup/run</code> ·{" "}
          <code className="text-lime-400/80">/run/content</code> ·{" "}
          <code className="text-lime-400/80">/run/full</code> ·{" "}
          <code className="text-lime-400/80">/run/migrate</code>
          <br />
          Windows: <code className="text-lime-400/80">scripts\Register-DailyBackup.ps1</code>{" "}
          · <code className="text-lime-400/80">Backup-Callejon.bat</code>
        </p>

        {status?.history?.length > 0 && (
          <section className="rounded-xl border border-stone-700/80 bg-black/35 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
              Historial
            </h3>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px] text-cream/70">
              {status.history.map((h, i) => (
                <li key={i} className="border-b border-stone-800/80 py-1">
                  <span className="text-amber-200/80">{fmtTs(h.ts)}</span> ·{" "}
                  {h.status} · {h.mode || "—"}
                  {h.path && (
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-stone-500">
                      {h.path}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
