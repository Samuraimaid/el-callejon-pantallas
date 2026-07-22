import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useArrowScroll } from "../hooks/useArrowScroll";

const DAYS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mié" },
  { v: 4, l: "Jue" },
  { v: 5, l: "Vie" },
  { v: 6, l: "Sáb" },
];

const EMPTY = {
  comidas: {
    leftTitle: "",
    rightTitle: "",
    showTitles: false,
    showSubtitles: false,
    leftMaxCards: 5,
    rightMaxCards: 5,
    heroTitle: "Menú del día",
    heroIntervalMs: 5000,
    showClock: true,
    showMarquee: true,
    showLogo: true,
  },
  complementos: {
    leftTitle: "",
    rightTitle: "",
    showTitles: false,
    showSubtitles: false,
    leftMaxCards: 6,
    rightMaxCards: 6,
    heroTitle: "Complementos",
    heroIntervalMs: 5000,
    showClock: false,
    showMarquee: true,
    showLogo: true,
  },
  layout: {
    logoSizePx: 110,
    logoAlign: "left",
    logoOutlinePx: 2,
    textOutlinePx: 1.5,
    marqueeIntervalMs: 5200,
    showFicoshaOnPublicidad: true,
    ficoshaCorto: "Ficosha · 35% de descuento en tu cuenta · sin mínimo",
    ficoshaTag: "Alianza Ficosha",
  },
  promos: [],
};

function SideForm({ label, value, onChange }) {
  const v = value || {};
  const set = (key, val) => onChange({ ...v, [key]: val });

  return (
    <div className="panel-oak rounded-2xl p-4">
      <h3 className="font-display text-lg text-gold">{label}</h3>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-cream/85">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.showLogo}
            onChange={(e) => set("showLogo", e.target.checked)}
            className="accent-amber-500"
          />
          Mostrar logo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.showClock}
            onChange={(e) => set("showClock", e.target.checked)}
            className="accent-amber-500"
          />
          Mostrar reloj
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.showMarquee}
            onChange={(e) => set("showMarquee", e.target.checked)}
            className="accent-amber-500"
          />
          Marquesina de promos
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-cream/70">Tarjetas visibles · izquierda</span>
          <input
            type="number"
            min={3}
            max={12}
            value={v.leftMaxCards ?? 5}
            onChange={(e) => set("leftMaxCards", Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
          />
        </label>
        <label className="block text-sm">
          <span className="text-cream/70">Tarjetas visibles · derecha</span>
          <input
            type="number"
            min={3}
            max={12}
            value={v.rightMaxCards ?? 5}
            onChange={(e) => set("rightMaxCards", Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-cream/70">Título del hero central</span>
          <input
            type="text"
            maxLength={40}
            value={v.heroTitle || ""}
            onChange={(e) => set("heroTitle", e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-cream/70">Segundos entre fotos del hero</span>
          <input
            type="number"
            min={3}
            max={20}
            value={Math.round((v.heroIntervalMs || 5000) / 1000)}
            onChange={(e) =>
              set(
                "heroIntervalMs",
                Math.max(3, Number(e.target.value) || 5) * 1000
              )
            }
            className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-cream/80">
          <input
            type="checkbox"
            checked={!!v.showTitles}
            onChange={(e) => set("showTitles", e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          Títulos de columnas
        </label>
        <label className="flex items-center gap-2 text-sm text-cream/80">
          <input
            type="checkbox"
            checked={!!v.showSubtitles}
            onChange={(e) => set("showSubtitles", e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          Subtítulos (1–6…)
        </label>
      </div>

      {v.showTitles && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-cream/70">Título izquierda</span>
            <input
              type="text"
              maxLength={40}
              value={v.leftTitle || ""}
              onChange={(e) => set("leftTitle", e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
            />
          </label>
          <label className="block text-sm">
            <span className="text-cream/70">Título derecha</span>
            <input
              type="text"
              maxLength={40}
              value={v.rightTitle || ""}
              onChange={(e) => set("rightTitle", e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function PromoRow({ promo, onChange, onRemove }) {
  const p = promo || {};
  const set = (k, v) => onChange({ ...p, [k]: v });
  const dias = Array.isArray(p.dias) ? p.dias : null;
  const allDays = dias == null;

  function toggleDay(d) {
    if (allDays) {
      set("dias", [d]);
      return;
    }
    const has = dias.includes(d);
    const next = has ? dias.filter((x) => x !== d) : [...dias, d].sort();
    set("dias", next.length ? next : null);
  }

  return (
    <div className="rounded-xl border border-stone-700/80 bg-black/30 p-3">
      <div className="grid gap-2 sm:grid-cols-6">
        <label className="text-xs sm:col-span-1">
          <span className="text-cream/55">Icono</span>
          <input
            value={p.icon || ""}
            onChange={(e) => set("icon", e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-stone-600 bg-black/40 px-2 py-1.5 text-center text-lg text-ivory"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="text-cream/55">Etiqueta</span>
          <input
            value={p.tag || ""}
            onChange={(e) => set("tag", e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-stone-600 bg-black/40 px-2 py-1.5 text-ivory"
          />
        </label>
        <label className="text-xs sm:col-span-3">
          <span className="text-cream/55">Texto corto (marquesina / banner)</span>
          <input
            value={p.corto || ""}
            maxLength={160}
            onChange={(e) => set("corto", e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-stone-600 bg-black/40 px-2 py-1.5 text-ivory"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-cream/80">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!p.activo}
            onChange={(e) => set("activo", e.target.checked)}
            className="accent-amber-500"
          />
          Activo
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!p.enMarquesina}
            onChange={(e) => set("enMarquesina", e.target.checked)}
            className="accent-amber-500"
          />
          Marquesina menú
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!p.enPublicidad}
            onChange={(e) => set("enPublicidad", e.target.checked)}
            className="accent-amber-500"
          />
          Banner publicidad
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-rose-300 hover:text-rose-200"
        >
          Eliminar
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-cream/50">Días:</span>
        <button
          type="button"
          onClick={() => set("dias", null)}
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            allDays
              ? "bg-amber-500/30 text-amber-100"
              : "bg-stone-800 text-cream/60"
          }`}
        >
          Todos
        </button>
        {DAYS.map((d) => (
          <button
            key={d.v}
            type="button"
            onClick={() => toggleDay(d.v)}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              !allDays && dias.includes(d.v)
                ? "bg-amber-500/30 text-amber-100"
                : "bg-stone-800 text-cream/60"
            }`}
          >
            {d.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MenuBoardConfigPanel() {
  const [cfg, setCfg] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const scroll = useArrowScroll(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api.getMenuBoardConfig();
      setCfg({
        comidas: { ...EMPTY.comidas, ...(data.comidas || {}) },
        complementos: { ...EMPTY.complementos, ...(data.complementos || {}) },
        layout: { ...EMPTY.layout, ...(data.layout || {}) },
        promos: Array.isArray(data.promos) ? data.promos : [],
      });
    } catch (e) {
      setErr(e.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const saved = await api.putMenuBoardConfig(cfg);
      setCfg({
        comidas: { ...EMPTY.comidas, ...(saved.comidas || {}) },
        complementos: { ...EMPTY.complementos, ...(saved.complementos || {}) },
        layout: { ...EMPTY.layout, ...(saved.layout || {}) },
        promos: Array.isArray(saved.promos) ? saved.promos : [],
      });
      setMsg("Guardado. Las TVs se actualizan en vivo.");
      window.setTimeout(() => setMsg(""), 3500);
    } catch (e) {
      setErr(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function addPromo() {
    setCfg((c) => ({
      ...c,
      promos: [
        ...(c.promos || []),
        {
          id: `promo-${Date.now()}`,
          tag: "Nueva",
          icon: "✨",
          corto: "Texto de la promoción",
          activo: true,
          dias: null,
          enMarquesina: true,
          enPublicidad: false,
        },
      ],
    }));
  }

  const layout = cfg.layout || EMPTY.layout;

  return (
    <div
      ref={scroll.ref}
      tabIndex={0}
      className="scrollbar-none min-h-0 flex-1 overflow-y-auto p-4 outline-none"
    >
      <div className="mx-auto max-w-3xl space-y-4 pb-10">
        <div>
          <h2 className="font-display text-2xl text-ivory">
            Configuración del menú en TV
          </h2>
          <p className="mt-1 text-sm text-cream/60">
            Logo, reloj, marquesina, tarjetas y textos de promociones (Ficosha,
            martes, jueves…). Cambios en vivo a las pantallas.
          </p>
        </div>

        {loading && <p className="text-cream/50">Cargando…</p>}
        {err && (
          <p className="rounded-xl bg-rose-900/50 px-3 py-2 text-sm text-rose-100">
            {err}
          </p>
        )}
        {msg && (
          <p className="rounded-xl bg-emerald-900/50 px-3 py-2 text-sm text-emerald-100">
            {msg}
          </p>
        )}

        {!loading && (
          <>
            <div className="panel-oak rounded-2xl p-4">
              <h3 className="font-display text-lg text-gold">
                Logo, reloj y marquesina (global)
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="text-cream/70">
                    Tamaño del logo (px): {layout.logoSizePx}
                  </span>
                  <input
                    type="range"
                    min={48}
                    max={160}
                    value={layout.logoSizePx || 96}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: {
                          ...c.layout,
                          logoSizePx: Number(e.target.value),
                        },
                      }))
                    }
                    className="mt-2 w-full accent-amber-500"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-cream/70">Alineación del logo</span>
                  <select
                    value={layout.logoAlign || "left"}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: { ...c.layout, logoAlign: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
                  >
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-cream/70">
                    Contorno blanco del logo (px): {layout.logoOutlinePx ?? 2}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={layout.logoOutlinePx ?? 2}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: {
                          ...c.layout,
                          logoOutlinePx: Number(e.target.value),
                        },
                      }))
                    }
                    className="mt-2 w-full accent-amber-500"
                  />
                  <span className="mt-0.5 block text-[11px] text-cream/45">
                    0 = sin contorno · recomendado 1–3 px
                  </span>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-cream/70">
                    Contorno de textos en tarjetas/hero (px):{" "}
                    {layout.textOutlinePx ?? 1.5}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.25}
                    value={layout.textOutlinePx ?? 1.5}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: {
                          ...c.layout,
                          textOutlinePx: Number(e.target.value),
                        },
                      }))
                    }
                    className="mt-2 w-full accent-amber-500"
                  />
                  <span className="mt-0.5 block text-[11px] text-cream/45">
                    Mejora legibilidad sobre fotos claras u oscuras
                  </span>
                </label>
                <label className="block text-sm">
                  <span className="text-cream/70">
                    Segundos entre mensajes de marquesina
                  </span>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={Math.round((layout.marqueeIntervalMs || 5200) / 1000)}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: {
                          ...c.layout,
                          marqueeIntervalMs:
                            Math.max(3, Number(e.target.value) || 5) * 1000,
                        },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-cream/80 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={!!layout.showFicoshaOnPublicidad}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: {
                          ...c.layout,
                          showFicoshaOnPublicidad: e.target.checked,
                        },
                      }))
                    }
                    className="accent-amber-500"
                  />
                  Mostrar banner Ficosha en pantallas de publicidad (TV #3–#6)
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-cream/70">Texto corto Ficosha (banner)</span>
                  <input
                    value={layout.ficoshaCorto || ""}
                    maxLength={120}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: { ...c.layout, ficoshaCorto: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-cream/70">Etiqueta Ficosha</span>
                  <input
                    value={layout.ficoshaTag || ""}
                    maxLength={40}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        layout: { ...c.layout, ficoshaTag: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-stone-600 bg-black/40 px-3 py-2 text-ivory"
                  />
                </label>
              </div>
            </div>

            <SideForm
              label="TV #1 · Menú Comidas"
              value={cfg.comidas}
              onChange={(comidas) => setCfg((c) => ({ ...c, comidas }))}
            />
            <SideForm
              label="TV #2 · Complementos"
              value={cfg.complementos}
              onChange={(complementos) =>
                setCfg((c) => ({ ...c, complementos }))
              }
            />

            <div className="panel-oak rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg text-gold">
                  Textos de promociones y bienvenida
                </h3>
                <button
                  type="button"
                  onClick={addPromo}
                  className="tap rounded-xl border border-amber-400/40 px-3 py-1.5 text-sm text-amber-100"
                >
                  + Agregar
                </button>
              </div>
              <p className="mt-1 text-xs text-cream/55">
                Elija días (p. ej. solo martes), si va en marquesina del menú y/o
                en publicidad. Ficosha suele marcarse en ambos.
              </p>
              <div className="mt-3 space-y-3">
                {(cfg.promos || []).map((p, i) => (
                  <PromoRow
                    key={p.id || i}
                    promo={p}
                    onChange={(next) =>
                      setCfg((c) => {
                        const promos = [...(c.promos || [])];
                        promos[i] = next;
                        return { ...c, promos };
                      })
                    }
                    onRemove={() =>
                      setCfg((c) => ({
                        ...c,
                        promos: (c.promos || []).filter((_, j) => j !== i),
                      }))
                    }
                  />
                ))}
                {!cfg.promos?.length && (
                  <p className="text-sm text-cream/45">
                    Sin promociones. Agregue una o guarde para restaurar
                    predeterminadas.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="tap w-full rounded-2xl bg-gradient-to-r from-[#a33a28] to-[#d4a84b] py-3.5 text-lg font-bold text-[#1a120c] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar y avisar pantallas"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
