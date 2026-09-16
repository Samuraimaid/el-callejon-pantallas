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
    fontScale: 100,
    cardNameSizePx: 18,
    cardPriceSizePx: 22,
    cardNumSizePx: 26,
    heroNameSizePx: 38,
    heroPriceSizePx: 38,
    heroNumSizePx: 68,
    heroBadgeSizePx: 13,
    clockSizePx: 30,
    marqueeSizePx: 17,
    colTitleSizePx: 24,
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
            max={20}
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
                Math.max(3, Number(e.target.value) || 5) * 1000,
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
          <span className="text-cream/55">
            Texto corto (marquesina / banner)
          </span>
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
          className={
            allDays
              ? "rounded-full px-2 py-0.5 text-[11px] bg-amber-500/30 text-amber-100"
              : "rounded-full px-2 py-0.5 text-[11px] bg-stone-800 text-cream/60"
          }
        >
          Todos
        </button>
        {DAYS.map((d) => (
          <button
            key={d.v}
            type="button"
            onClick={() => toggleDay(d.v)}
            className={
              !allDays && dias.includes(d.v)
                ? "rounded-full px-2 py-0.5 text-[11px] bg-amber-500/30 text-amber-100"
                : "rounded-full px-2 py-0.5 text-[11px] bg-stone-800 text-cream/60"
            }
          >
            {d.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypographySection({ layout = {}, onChange }) {
  const [activeTab, setActiveTab] = useState("general");

  const fontScale = Number(layout.fontScale) || 100;
  const scaleMult = Math.max(0.7, Math.min(1.6, fontScale / 100));

  const cardNameSizePx = Number(layout.cardNameSizePx) || 18;
  const cardPriceSizePx = Number(layout.cardPriceSizePx) || 22;
  const cardNumSizePx = Number(layout.cardNumSizePx) || 26;

  const heroNameSizePx = Number(layout.heroNameSizePx) || 38;
  const heroPriceSizePx = Number(layout.heroPriceSizePx) || 38;
  const heroNumSizePx = Number(layout.heroNumSizePx) || 68;
  const heroBadgeSizePx = Number(layout.heroBadgeSizePx) || 13;

  const clockSizePx = Number(layout.clockSizePx) || 30;
  const marqueeSizePx = Number(layout.marqueeSizePx) || 17;
  const colTitleSizePx = Number(layout.colTitleSizePx) || 24;

  const setVal = (key, val) => {
    onChange({ ...layout, [key]: val });
  };

  const resetDefaults = () => {
    onChange({
      ...layout,
      fontScale: 100,
      cardNameSizePx: 18,
      cardPriceSizePx: 22,
      cardNumSizePx: 26,
      heroNameSizePx: 38,
      heroPriceSizePx: 38,
      heroNumSizePx: 68,
      heroBadgeSizePx: 13,
      clockSizePx: 30,
      marqueeSizePx: 17,
      colTitleSizePx: 24,
    });
  };

  // Tamaños efectivos calculados con el multiplicador global
  const effCardName = Math.round(cardNameSizePx * scaleMult);
  const effCardPrice = Math.round(cardPriceSizePx * scaleMult);
  const effCardNum = Math.round(cardNumSizePx * scaleMult);
  const effHeroName = Math.round(heroNameSizePx * scaleMult);
  const effHeroPrice = Math.round(heroPriceSizePx * scaleMult);
  const effHeroNum = Math.round(heroNumSizePx * scaleMult);
  const effHeroBadge = Math.round(heroBadgeSizePx * scaleMult);
  const effClock = Math.round(clockSizePx * scaleMult);
  const effMarquee = Math.round(marqueeSizePx * scaleMult);

  return (
    <div className="panel-oak rounded-2xl p-4 border border-amber-500/25">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔤</span>
          <div>
            <h3 className="font-display text-lg text-gold flex items-center gap-2">
              Tipografía y Tamaños de Pantalla
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/30">
                En vivo en TVs
              </span>
            </h3>
            <p className="text-xs text-cream/60">
              Ajusta cada elemento para óptima visibilidad a distancia sin depender del zoom de fábrica de la TV.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="tap rounded-xl border border-stone-600 bg-black/40 px-2.5 py-1 text-xs text-cream/75 hover:bg-black/60 hover:text-white"
          title="Restablecer fuentes al tamaño estándar del sistema"
        >
          ↺ Restablecer estándar
        </button>
      </div>

      {/* Selector de sub-pestañas */}
      <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-black/30 p-1">
        {[
          { id: "general", label: "Zoom Maestro", icon: "🌐" },
          { id: "cards", label: "Tarjetas Laterales", icon: "📋" },
          { id: "hero", label: "Platillo Hero", icon: "⭐" },
          { id: "header", label: "Cabecera y Reloj", icon: "⏱️" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`tap flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === t.id
                ? "bg-amber-600 text-ivory shadow"
                : "text-cream/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido de pestañas */}
      <div className="mt-4">
        {activeTab === "general" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-cream/80">
                  Multiplicador Global de Tamaño:
                </span>
                <span className="font-display font-bold text-amber-400 text-base">
                  {fontScale}% {fontScale !== 100 && `(x${scaleMult.toFixed(2)})`}
                </span>
              </div>
              <input
                type="range"
                min={70}
                max={150}
                step={5}
                value={fontScale}
                onChange={(e) => setVal("fontScale", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <p className="mt-1 text-[11px] text-cream/45">
                Escala armónicamente todos los textos de la TV a la vez. Recomendado: 100% (normal) o 115%–125% para salas grandes.
              </p>
            </div>

            {/* Presets rápidos */}
            <div>
              <span className="block text-xs font-semibold text-cream/70 mb-1.5">
                Ajustes rápidos:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 85, l: "85% Compacto" },
                  { v: 100, l: "100% Estándar" },
                  { v: 115, l: "115% Grande" },
                  { v: 130, l: "130% Extra Grande" },
                ].map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => setVal("fontScale", p.v)}
                    className={`rounded-lg px-2.5 py-1 text-xs border transition-colors ${
                      fontScale === p.v
                        ? "border-amber-400 bg-amber-500/20 text-amber-200 font-bold"
                        : "border-stone-700 bg-black/40 text-cream/70 hover:border-stone-500"
                    }`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "cards" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-cream/70">
                Nombre de Platillo (px):{" "}
                <strong className="text-amber-400">{cardNameSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effCardName}px)</span>
                )}
              </span>
              <input
                type="range"
                min={12}
                max={32}
                step={1}
                value={cardNameSizePx}
                onChange={(e) => setVal("cardNameSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 18px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Precio en Tarjeta (px):{" "}
                <strong className="text-amber-400">{cardPriceSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effCardPrice}px)</span>
                )}
              </span>
              <input
                type="range"
                min={14}
                max={36}
                step={1}
                value={cardPriceSizePx}
                onChange={(e) => setVal("cardPriceSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 22px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Número # (px):{" "}
                <strong className="text-amber-400">{cardNumSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effCardNum}px)</span>
                )}
              </span>
              <input
                type="range"
                min={16}
                max={44}
                step={1}
                value={cardNumSizePx}
                onChange={(e) => setVal("cardNumSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 26px</span>
            </label>
          </div>
        )}

        {activeTab === "hero" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-cream/70">
                Nombre en Platillo Central (px):{" "}
                <strong className="text-amber-400">{heroNameSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effHeroName}px)</span>
                )}
              </span>
              <input
                type="range"
                min={24}
                max={64}
                step={2}
                value={heroNameSizePx}
                onChange={(e) => setVal("heroNameSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 38px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Precio en Platillo Central (px):{" "}
                <strong className="text-amber-400">{heroPriceSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effHeroPrice}px)</span>
                )}
              </span>
              <input
                type="range"
                min={24}
                max={64}
                step={2}
                value={heroPriceSizePx}
                onChange={(e) => setVal("heroPriceSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 38px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Número # Gigante (px):{" "}
                <strong className="text-amber-400">{heroNumSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effHeroNum}px)</span>
                )}
              </span>
              <input
                type="range"
                min={40}
                max={96}
                step={2}
                value={heroNumSizePx}
                onChange={(e) => setVal("heroNumSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 68px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Etiqueta Badge Superior (px):{" "}
                <strong className="text-amber-400">{heroBadgeSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effHeroBadge}px)</span>
                )}
              </span>
              <input
                type="range"
                min={10}
                max={22}
                step={1}
                value={heroBadgeSizePx}
                onChange={(e) => setVal("heroBadgeSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 13px</span>
            </label>
          </div>
        )}

        {activeTab === "header" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-cream/70">
                Reloj Digital (px):{" "}
                <strong className="text-amber-400">{clockSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effClock}px)</span>
                )}
              </span>
              <input
                type="range"
                min={18}
                max={50}
                step={1}
                value={clockSizePx}
                onChange={(e) => setVal("clockSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 30px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Texto Marquesina (px):{" "}
                <strong className="text-amber-400">{marqueeSizePx}px</strong>
                {fontScale !== 100 && (
                  <span className="text-[11px] text-stone-400"> (efectivo: {effMarquee}px)</span>
                )}
              </span>
              <input
                type="range"
                min={12}
                max={28}
                step={1}
                value={marqueeSizePx}
                onChange={(e) => setVal("marqueeSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 17px</span>
            </label>

            <label className="block text-sm">
              <span className="text-cream/70">
                Título de Columnas (px):{" "}
                <strong className="text-amber-400">{colTitleSizePx}px</strong>
              </span>
              <input
                type="range"
                min={16}
                max={36}
                step={1}
                value={colTitleSizePx}
                onChange={(e) => setVal("colTitleSizePx", Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
              />
              <span className="text-[11px] text-cream/45">Estándar: 24px</span>
            </label>
          </div>
        )}
      </div>

      {/* Mini-Previsualizador en Tiempo Real */}
      <div className="mt-4 rounded-xl border border-amber-500/20 bg-black/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <span>👁️</span> Previsualización en Vivo de Fuentes
          </span>
          <span className="text-[11px] text-cream/50">
            Escala: {fontScale}% (x{scaleMult.toFixed(2)})
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Muestra Tarjeta Lateral */}
          <div className="rounded-lg border border-[rgba(232,197,106,0.25)] bg-stone-900/90 p-2.5 flex items-center gap-2.5 overflow-hidden">
            <div
              className="font-display font-black text-gold shrink-0 text-center leading-none"
              style={{
                fontSize: `${effCardNum}px`,
                width: `${Math.max(28, effCardNum * 1.35)}px`,
              }}
            >
              #1
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-bold text-ivory leading-tight truncate"
                style={{ fontSize: `${effCardName}px` }}
              >
                Cordon Bleu de Pollo
              </p>
            </div>
            <div
              className="font-display font-semibold text-gold shrink-0 text-right leading-none"
              style={{ fontSize: `${effCardPrice}px` }}
            >
              C$ 180.00
            </div>
          </div>

          {/* Muestra Hero Central */}
          <div className="rounded-lg border border-amber-500/30 bg-stone-900/90 p-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="rounded-full bg-amber-500/20 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-200 border border-amber-400/30"
                style={{ fontSize: `${effHeroBadge}px` }}
              >
                Menú del día
              </span>
            </div>
            <div className="flex items-end gap-2.5">
              <span
                className="font-display font-black text-gold leading-none"
                style={{ fontSize: `${effHeroNum}px` }}
              >
                #1
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="font-display font-bold text-ivory leading-tight truncate"
                  style={{ fontSize: `${effHeroName}px` }}
                >
                  Cordon Bleu de Pollo
                </p>
                <p
                  className="font-display text-gold mt-0.5 leading-none"
                  style={{ fontSize: `${effHeroPrice}px` }}
                >
                  C$ 180.00
                </p>
              </div>
            </div>
          </div>
        </div>
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
                    value={Math.round(
                      (layout.marqueeIntervalMs || 5200) / 1000,
                    )}
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
                  <span className="text-cream/70">
                    Texto corto Ficosha (banner)
                  </span>
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

            <TypographySection
              layout={layout}
              onChange={(l) => setCfg((c) => ({ ...c, layout: l }))}
            />

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
                Elija días (p. ej. solo martes), si va en marquesina del menú
                y/o en publicidad. Ficosha suele marcarse en ambos.
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
