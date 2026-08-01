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

const SHORT_LABEL = {
  1: "Menú Comidas",
  2: "Complementos",
  3: "Barra",
  4: "Parrilla",
  5: "VIP Ambiente",
  6: "VIP Platillos",
};

const FALLBACK_PREVIEW = {
  1: "/images/slides/slide-platos-mixtos.jpg",
  2: "/images/bebidas/jugos-naturales.jpg",
  3: "/images/slides/slide8-barra.jpg",
  4: "/images/slides/slide-costilla-bbq.jpg",
  5: "/images/slides/slide3-salon.jpg",
  6: "/images/slides/slide-platos-mixtos.jpg",
};

function StatusBadge({ estado }) {
  const map = {
    online: { c: "bg-emerald-500", t: "En línea" },
    weak: { c: "bg-amber-400", t: "Débil" },
    offline: { c: "bg-rose-600", t: "Offline" },
    error: { c: "bg-orange-500", t: "Error" },
    standby: { c: "bg-stone-500", t: "Stand-by" },
  };
  const m = map[estado] || map.offline;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cream/90">
      <span className={`h-2 w-2 rounded-full ${m.c} shadow`} />
      {m.t}
    </span>
  );
}

function Switch({ on, onToggle, label, tone = "emerald" }) {
  const onCls = tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <label className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-black/40 px-2.5 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition ${
          on ? onCls : "bg-stone-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            on ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromLocalInputValue(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Capturas por defecto. Máx. 1 TV en vivo (botón por tarjeta).
 * Modo evento: switch maestro + programación inicio/fin.
 */
export default function MonitoreoPantallasPanel() {
  const [data, setData] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [evtBusy, setEvtBusy] = useState(false);
  const [contentStatus, setContentStatus] = useState(null);
  /** Solo UNA TV puede estar en vivo; null = todas capturas */
  const [liveTvId, setLiveTvId] = useState(null);
  const [schedule, setSchedule] = useState({
    enabled: false,
    titulo: "",
    starts_at: null,
    ends_at: null,
  });
  const [schedDraft, setSchedDraft] = useState({
    titulo: "",
    starts_at: "",
    ends_at: "",
  });
  const [showSched, setShowSched] = useState(false);
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaActiva, setPlantillaActiva] = useState(null);
  const [showTpl, setShowTpl] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = await api.getPantallasEstado();
      setData(st);
      if (st.evento_schedule) {
        setSchedule(st.evento_schedule);
        setSchedDraft({
          titulo: st.evento_schedule.titulo || "",
          starts_at: toLocalInputValue(st.evento_schedule.starts_at),
          ends_at: toLocalInputValue(st.evento_schedule.ends_at),
        });
      }
      setErr("");
    } catch (e) {
      setErr(e.message || "No se pudo cargar estado");
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
        /* */
      }
    }
  }, []);

  const loadPlantillas = useCallback(async () => {
    try {
      const list = await api.getEventoPlantillas();
      setPlantillas(list.plantillas || []);
      const act = await api.getEventoPlantillaActiva();
      setPlantillaActiva(act.template || null);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    load();
    loadContent();
    loadPlantillas();
    const id = window.setInterval(load, 5000);
    const id2 = window.setInterval(loadContent, 5000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(id2);
    };
  }, [load, loadContent, loadPlantillas]);

  // Si el sensor pasa a hot, quitar el único vivo
  useEffect(() => {
    const lvl =
      contentStatus?.policy?.level ||
      contentStatus?.resources?.level ||
      contentStatus?.resources?.policy?.level;
    if ((lvl === "hot" || lvl === "warm") && liveTvId != null) {
      setLiveTvId(null);
    }
  }, [contentStatus, liveTvId]);

  useWebSocket("admin,pantallas", (ev) => {
    if (ev?.t === "hb" || ev?.t === "ctrl") load();
  });

  async function sendControl(body) {
    try {
      const st = await api.controlPantallas(body);
      setData(st);
      setMsg("OK");
      window.setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setErr(e.message || "Error de control");
    }
  }

  async function onEventFile(file) {
    if (!file) return;
    setEvtBusy(true);
    try {
      await api.uploadEventoMedia(file, file.name);
      setMsg("Media subida");
      window.setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setErr(e.message || "Error subiendo media");
    } finally {
      setEvtBusy(false);
    }
  }

  async function saveSchedule(enable) {
    try {
      const body = {
        enabled: enable,
        titulo: schedDraft.titulo || "Evento",
        starts_at: fromLocalInputValue(schedDraft.starts_at),
        ends_at: fromLocalInputValue(schedDraft.ends_at),
      };
      if (enable && (!body.starts_at || !body.ends_at)) {
        setErr("Indique inicio y fin del evento");
        return;
      }
      if (
        enable &&
        body.starts_at &&
        body.ends_at &&
        new Date(body.ends_at) <= new Date(body.starts_at)
      ) {
        setErr("La hora de fin debe ser posterior al inicio");
        return;
      }
      const s = await api.putEventoSchedule(body);
      setSchedule(s);
      setMsg(
        enable
          ? "Evento programado: se activará y apagará solo"
          : "Programación guardada"
      );
      window.setTimeout(() => setMsg(""), 2500);
      load();
    } catch (e) {
      setErr(e.message || "No se pudo guardar la programación");
    }
  }

  async function clearSchedule() {
    try {
      const s = await api.putEventoSchedule({ clear: true });
      setSchedule(s);
      setSchedDraft({ titulo: "", starts_at: "", ends_at: "" });
      setMsg("Programación cancelada");
      window.setTimeout(() => setMsg(""), 2000);
      load();
    } catch (e) {
      setErr(e.message || "Error al cancelar");
    }
  }

  const master = data.master_power !== false;
  const pantallas = data.pantallas || EMPTY.pantallas;
  const anyEvento = pantallas.some((p) => p.modo_evento);

  const policy = contentStatus?.policy || contentStatus?.resources?.policy || {};
  const level = policy.level || contentStatus?.resources?.level || "ok";
  const liveBlocked = level === "hot" || level === "warm";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-700/80 bg-black/40 px-3 py-2">
        <Switch
          label="Maestro"
          on={master}
          onToggle={() => sendControl({ master_power: !master, all_tvs: true })}
        />

        <Switch
          label="Evento"
          tone="amber"
          on={anyEvento}
          onToggle={() => {
            const next = !anyEvento;
            sendControl({ all_tvs: true, modo_evento: next });
            // Plantillas solo con modo evento ON (ahorra espacio)
            setShowTpl(next);
            if (!next) setShowSched(false);
          }}
        />

        {anyEvento && (
          <>
            <button
              type="button"
              onClick={() => setShowTpl((v) => !v)}
              className={`tap rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
                plantillaActiva || showTpl
                  ? "border-violet-500/50 bg-violet-950/40 text-violet-100"
                  : "border-stone-600 text-cream/80"
              }`}
            >
              ✨ Plantillas
            </button>

            <button
              type="button"
              onClick={() => setShowSched((v) => !v)}
              className={`tap rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
                schedule.enabled
                  ? "border-amber-500/50 bg-amber-900/40 text-amber-100"
                  : "border-stone-600 text-cream/80"
              }`}
            >
              ⏱ Programar
            </button>

            <label className="tap cursor-pointer rounded-xl border border-stone-600 bg-stone-900/60 px-2.5 py-1.5 text-xs text-cream/90">
              {evtBusy ? "…" : "📷 Media"}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                disabled={evtBusy}
                onChange={(e) => onEventFile(e.target.files?.[0])}
              />
            </label>
          </>
        )}

        {liveTvId != null && (
          <button
            type="button"
            onClick={() => setLiveTvId(null)}
            className="tap rounded-xl border border-sky-600/50 bg-sky-950/40 px-2.5 py-1.5 text-xs text-sky-100"
          >
            Cerrar vivo (TV #{liveTvId})
          </button>
        )}

        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        {err && <span className="text-xs text-rose-300">{err}</span>}
      </div>

      {anyEvento && showTpl && (
        <div className="shrink-0 border-b border-stone-700/60 bg-black/55 px-2 py-2 sm:px-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-amber-100">
              Plantillas de evento (referencia)
            </p>
            {plantillaActiva && (
              <button
                type="button"
                className="text-[10px] text-rose-300 underline"
                onClick={async () => {
                  try {
                    await api.clearEventoPlantilla();
                    setPlantillaActiva(null);
                    setMsg("Plantilla desactivada");
                    load();
                  } catch (e) {
                    setErr(e.message);
                  }
                }}
              >
                Quitar activa
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible">
            {plantillas.map((t) => {
              const active = plantillaActiva?.id === t.id;
              const thumb = t.imagenes?.[0];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={async () => {
                    try {
                      setMsg("Aplicando…");
                      const r = await api.aplicarEventoPlantilla({
                        template_id: t.id,
                        activar_modo_evento: true,
                        musica_activa: true,
                      });
                      setPlantillaActiva(r.template);
                      setMsg(`${t.icono} ${t.nombre} activa en TVs`);
                      window.setTimeout(() => setMsg(""), 2500);
                      load();
                    } catch (e) {
                      setErr(e.message || "Error plantilla");
                    }
                  }}
                  className={`tap min-w-[7.5rem] shrink-0 overflow-hidden rounded-xl border text-left sm:min-w-0 ${
                    active
                      ? "border-amber-400 ring-1 ring-amber-400/60"
                      : "border-stone-700"
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-stone-900">
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-sm">
                      {t.icono}
                    </span>
                  </div>
                  <div className="p-1.5">
                    <p className="truncate text-[11px] font-bold text-ivory">
                      {t.nombre}
                    </p>
                    <p className="truncate text-[9px] text-cream/50">
                      {t.animacion} · {t.tipografia?.titulo?.replace("font-", "")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {anyEvento && showSched && (
        <div className="shrink-0 border-b border-stone-700/60 bg-black/50 px-3 py-2">
          <p className="mb-2 text-[11px] text-cream/60">
            El modo evento se enciende y apaga solo en el horario indicado
            (todas las TVs).
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] text-cream/55">
              Título
              <input
                value={schedDraft.titulo}
                onChange={(e) =>
                  setSchedDraft((d) => ({ ...d, titulo: e.target.value }))
                }
                placeholder="Cumpleaños, privado…"
                className="mt-0.5 block w-40 rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-xs text-ivory"
              />
            </label>
            <label className="text-[10px] text-cream/55">
              Inicio
              <input
                type="datetime-local"
                value={schedDraft.starts_at}
                onChange={(e) =>
                  setSchedDraft((d) => ({ ...d, starts_at: e.target.value }))
                }
                className="mt-0.5 block rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-xs text-ivory"
              />
            </label>
            <label className="text-[10px] text-cream/55">
              Fin
              <input
                type="datetime-local"
                value={schedDraft.ends_at}
                onChange={(e) =>
                  setSchedDraft((d) => ({ ...d, ends_at: e.target.value }))
                }
                className="mt-0.5 block rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-xs text-ivory"
              />
            </label>
            <button
              type="button"
              onClick={() => saveSchedule(true)}
              className="tap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-stone-950"
            >
              Activar programación
            </button>
            <button
              type="button"
              onClick={clearSchedule}
              className="tap rounded-lg border border-stone-600 px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
          {schedule.enabled && (
            <p className="mt-1.5 text-[11px] text-amber-200/90">
              Activo: {schedule.titulo || "Evento"} ·{" "}
              {schedule.starts_at
                ? new Date(schedule.starts_at).toLocaleString()
                : "?"}{" "}
              →{" "}
              {schedule.ends_at
                ? new Date(schedule.ends_at).toLocaleString()
                : "?"}
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ResourcePanel
          status={contentStatus}
          liveTvId={liveTvId}
          level={level}
          liveBlocked={liveBlocked}
        />
        <p className="mb-2 mt-2 text-[11px] text-cream/45">
          Previews = capturas (ahorro). Solo una TV puede verse en vivo. En
          cada televisor real: abra su URL y guarde en Favoritos.
        </p>
        <div className="monitor-grid grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pantallas.map((p) => (
            <TvTile
              key={p.id}
              p={p}
              master={master}
              onControl={sendControl}
              cacheInfo={contentStatus?.tv_cache?.[String(p.id)]}
              lease={contentStatus?.lease}
              videoTurn={contentStatus?.video_turn}
              isLive={liveTvId === p.id}
              liveBlocked={liveBlocked}
              onToggleLive={() => {
                if (liveBlocked) {
                  setErr("CPU/RAM ocupados: solo capturas por ahora");
                  window.setTimeout(() => setErr(""), 2500);
                  return;
                }
                setLiveTvId((cur) => (cur === p.id ? null : p.id));
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResourcePanel({ status, liveTvId, level, liveBlocked }) {
  if (!status?.resources && !status?.policy) return null;
  const r = status.resources || {};
  const pol = status.policy || r.policy || {};
  const lvl = level || pol.level || r.level || "ok";
  const levelColor =
    lvl === "hot"
      ? "border-rose-600/50 bg-rose-950/40"
      : lvl === "warm"
        ? "border-amber-600/40 bg-amber-950/30"
        : "border-emerald-700/40 bg-emerald-950/20";

  return (
    <div className={`rounded-xl border px-3 py-2 ${levelColor}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cream/85">
        <span className="font-bold text-amber-100">Sensor</span>
        <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] uppercase">
          {lvl}
        </span>
        <span>
          CPU <strong>{r.cpu_percent ?? "—"}%</strong>
        </span>
        <span>
          RAM <strong>{r.ram_percent ?? "—"}%</strong>
        </span>
        <span className="text-stone-300">
          Vivo:{" "}
          <strong className="text-ivory">
            {liveBlocked
              ? "bloqueado (carga)"
              : liveTvId
                ? `TV #${liveTvId}`
                : "ninguna (capturas)"}
          </strong>
        </span>
        <span className="text-stone-400">
          {status.lease ? `↓ TV #${status.lease.tv_id}` : "canal libre"}
        </span>
        {status.priority_order?.length > 0 && (
          <span className="text-stone-500" title="Solo pantallas en línea">
            Prioridad:{" "}
            {status.priority_order.map((id) => `TV${id}`).join(" → ")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] text-stone-500">
        {status.solo_publicidad
          ? "Modo solo publicidad: TV1–2 no disponibles; opera con las pantallas en línea."
          : "TV1–2 priorizan solo si están en línea; con 1 publicidad basta; offline no bloquea."}
      </p>
    </div>
  );
}

function TvTile({
  p,
  master,
  onControl,
  cacheInfo,
  lease,
  videoTurn,
  isLive,
  liveBlocked,
  onToggleLive,
}) {
  const on = p.power_on !== false && master;
  const isDownloading = lease && Number(lease.tv_id) === Number(p.id);
  const isVideoTurn =
    videoTurn && Number(videoTurn.tv_id) === Number(p.id);
  const label = SHORT_LABEL[p.id] || p.etiqueta || `TV #${p.id}`;
  const snap = p.snapshot || {};
  const previewUrl =
    snap.preview_url ||
    snap.thumb ||
    FALLBACK_PREVIEW[p.id] ||
    "/images/slides/slide5-bienvenidos.jpg";
  const useLive = isLive && on && !p.modo_evento && !liveBlocked;

  return (
    <div className="panel-oak flex flex-col overflow-hidden rounded-xl">
      <div className="relative aspect-video bg-black">
        {!on ? (
          <div className="flex h-full items-center justify-center bg-black">
            <span className="text-[10px] tracking-widest text-stone-600">
              STANDBY
            </span>
          </div>
        ) : p.modo_evento ? (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-amber-900/40 to-black">
            <span className="text-xl">🎉</span>
            <span className="mt-1 text-[10px] text-amber-200">EVENTO</span>
          </div>
        ) : useLive ? (
          <iframe
            title={`preview-${p.id}`}
            src={`${p.ruta || `/tv/${p.id}`}?embed=1`}
            className="pointer-events-none h-full w-full border-0 opacity-95"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
        ) : (
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover opacity-95"
            onError={(e) => {
              e.currentTarget.src =
                FALLBACK_PREVIEW[p.id] ||
                "/images/slides/slide5-bienvenidos.jpg";
            }}
          />
        )}
        <div className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5">
          <StatusBadge estado={p.estado} />
        </div>
        <div className="absolute right-1.5 top-1.5 rounded bg-black/65 px-1 py-0.5 text-[9px] text-cream/70">
          {useLive ? "LIVE" : "CAP"}
        </div>
        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
          {isDownloading && (
            <span className="rounded bg-sky-700/90 px-1 py-0.5 text-[9px] font-bold text-white">
              ↓
            </span>
          )}
          {isVideoTurn && (
            <span className="rounded bg-violet-700/90 px-1 py-0.5 text-[9px] font-bold text-white">
              ▶
            </span>
          )}
          {cacheInfo?.version && (
            <span className="rounded bg-black/70 px-1 py-0.5 text-[9px] text-emerald-200/90">
              cache
            </span>
          )}
        </div>
        {snap.label && !useLive && on && !p.modo_evento && (
          <div className="absolute bottom-1.5 right-1.5 max-w-[50%] truncate rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-cream/80">
            {snap.label}
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ivory">
            <span className="text-amber-300/90">{p.id}.</span> {label}
          </p>
          <button
            type="button"
            onClick={() => onControl({ tv_id: p.id, power_on: !p.power_on })}
            className={`tap shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              on ? "bg-emerald-600/80 text-white" : "bg-stone-700 text-stone-300"
            }`}
          >
            {on ? "ON" : "OFF"}
          </button>
        </div>

        <button
          type="button"
          disabled={!on || p.modo_evento || liveBlocked}
          onClick={onToggleLive}
          className={`tap w-full rounded-lg py-1.5 text-[11px] font-bold ${
            isLive
              ? "bg-sky-600 text-white"
              : "border border-stone-600 text-cream/80 disabled:opacity-40"
          }`}
          title={
            liveBlocked
              ? "Servidor ocupado: solo capturas"
              : "Solo una TV en vivo a la vez"
          }
        >
          {isLive ? "● En vivo (tocar para capturas)" : "Ver en vivo"}
        </button>

        <label className="block text-[10px] text-cream/50">
          Vol. {p.volumen ?? 25}%
          <input
            type="range"
            min={0}
            max={100}
            value={p.volumen ?? 25}
            onChange={(e) =>
              onControl({ tv_id: p.id, volumen: Number(e.target.value) })
            }
            className="mt-0.5 w-full accent-amber-500"
          />
        </label>

        <Switch
          label="Evento TV"
          tone="amber"
          on={!!p.modo_evento}
          onToggle={() =>
            onControl({ tv_id: p.id, modo_evento: !p.modo_evento })
          }
        />
      </div>
    </div>
  );
}
