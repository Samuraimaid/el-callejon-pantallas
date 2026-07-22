import { useCallback, useEffect, useState } from "react";
import { useArrowScroll } from "../hooks/useArrowScroll";
import { api } from "../lib/api";
import ImageCropUploadModal from "./ImageCropUploadModal";

const ZONAS = [
  {
    id: "BARRA_BEBIDAS",
    label: "Barra de Bebidas",
    desc: "TVs #3 y #4 · 50″ · licores y ambiente barra",
    icon: "🍹",
  },
  {
    id: "SALON_VIP",
    label: "Área VIP",
    desc: "TVs #5 y #6 · 60″ · ambiente privado climatizado",
    icon: "✨",
  },
];

const EFECTOS = [
  { id: "zoom-in", label: "Zoom In" },
  { id: "fade", label: "Desvanecer (fade)" },
  { id: "slide-left", label: "Desplazar izquierda" },
  { id: "slide-right", label: "Desplazar derecha" },
  { id: "slide-up", label: "Desplazar arriba" },
  { id: "giro-3d", label: "Giro 3D" },
  { id: "persiana", label: "Efecto persiana" },
  { id: "scale-soft", label: "Escalado suave" },
  { id: "blur", label: "Desenfoque progresivo" },
  { id: "flip-h", label: "Flip horizontal" },
];

const FUENTES = [
  { id: "pequeno", label: "Pequeño" },
  { id: "mediano", label: "Mediano" },
  { id: "grande", label: "Grande" },
];

const CAT_MSG = [
  { id: "chef", label: "Recomendaciones del Chef" },
  { id: "sabias", label: "¿Sabías qué? de El Callejón" },
];

function normalizeCampana(data) {
  return {
    ...data,
    slides: (data.slides || []).map((s) => ({ ...s })),
    mensajes: (data.mensajes || []).map((m) => ({
      id: m.id || crypto.randomUUID?.()?.slice(0, 8) || String(Date.now()),
      categoria: m.categoria === "sabias" ? "sabias" : "chef",
      texto: m.texto || "",
    })),
    segundos: Math.round((data.duracion_slide || 7000) / 1000),
    msgSegundos: Math.round((data.duracion_mensaje || 9000) / 1000),
    mostrar_logo: data.mostrar_logo !== false,
    tamano_fuente: data.tamano_fuente || "mediano",
    efectos_aleatorios: !!data.efectos_aleatorios,
    mostrar_mensajes: data.mostrar_mensajes !== false,
  };
}

/**
 * Administración de campañas publicitarias + mensajes dinámicos por zona.
 */
export default function PublicidadAdminPanel({ onSaved }) {
  const [zona, setZona] = useState("BARRA_BEBIDAS");
  const [campana, setCampana] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [uploadFor, setUploadFor] = useState(null);
  const scroll = useArrowScroll(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await api.getPublicidad(zona);
      setCampana(normalizeCampana(data));
    } catch (e) {
      setErr(e.message || "Error al cargar campaña");
      setCampana(null);
    } finally {
      setLoading(false);
    }
  }, [zona]);

  useEffect(() => {
    load();
  }, [load]);

  function updateSlide(id, patch) {
    setCampana((c) => {
      if (!c) return c;
      return {
        ...c,
        slides: c.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      };
    });
  }

  function removeSlide(id) {
    setCampana((c) => {
      if (!c) return c;
      return { ...c, slides: c.slides.filter((s) => s.id !== id) };
    });
  }

  function moveSlide(id, dir) {
    setCampana((c) => {
      if (!c) return c;
      const slides = [...c.slides];
      const i = slides.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= slides.length) return c;
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...c, slides };
    });
  }

  function updateMensaje(id, patch) {
    setCampana((c) => {
      if (!c) return c;
      return {
        ...c,
        mensajes: c.mensajes.map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      };
    });
  }

  function addMensaje() {
    setCampana((c) => {
      if (!c) return c;
      return {
        ...c,
        mensajes: [
          ...c.mensajes,
          {
            id: `m${Date.now().toString(36)}`,
            categoria: "chef",
            texto: "",
          },
        ],
      };
    });
  }

  function removeMensaje(id) {
    setCampana((c) => {
      if (!c) return c;
      return { ...c, mensajes: c.mensajes.filter((m) => m.id !== id) };
    });
  }

  async function handleSave() {
    if (!campana) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const body = {
        activo: campana.activo,
        duracion_slide: Math.round((campana.segundos || 7) * 1000),
        efecto_visual: campana.efecto_visual,
        mostrar_logo: !!campana.mostrar_logo,
        tamano_fuente: campana.tamano_fuente || "mediano",
        efectos_aleatorios: !!campana.efectos_aleatorios,
        mostrar_mensajes: campana.mostrar_mensajes !== false,
        duracion_mensaje: Math.round((campana.msgSegundos || 9) * 1000),
        mensajes: (campana.mensajes || [])
          .filter((m) => (m.texto || "").trim())
          .map((m) => ({
            id: m.id,
            categoria: m.categoria === "sabias" ? "sabias" : "chef",
            texto: (m.texto || "").trim(),
          })),
        slides: campana.slides.map((s) => ({
          id: s.id,
          imagen_url: (s.imagen_url || "").split("?")[0],
          texto_principal: s.texto_principal || "",
          texto_secundario: s.texto_secundario || "",
        })),
      };
      const updated = await api.putPublicidad(zona, body);
      setCampana(normalizeCampana(updated));
      setMsg("Guardado y sincronizado en pantallas de la zona.");
      onSaved?.();
    } catch (e) {
      setErr(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSlideUpload(blob) {
    if (uploadFor === "new") {
      const result = await api.uploadPublicidadSlide(zona, blob, {
        texto_principal: "Nuevo anuncio",
        texto_secundario: "El Callejón",
      });
      setCampana(normalizeCampana(result.campana));
      setMsg("Slide agregado y sincronizado.");
      onSaved?.();
      return result;
    }
    const result = await api.uploadPublicidadSlide(zona, blob, {
      texto_principal: "",
      texto_secundario: "",
    });
    if (result.campana?.slides) {
      const slides = result.campana.slides;
      const last = slides[slides.length - 1];
      const withoutLast = slides.slice(0, -1);
      const patched = withoutLast.map((s) =>
        s.id === uploadFor
          ? { ...s, imagen_url: last.imagen_url || result.imagen_url }
          : s
      );
      await api.putPublicidad(zona, {
        slides: patched,
        duracion_slide: campana.duracion_slide,
        efecto_visual: campana.efecto_visual,
        activo: campana.activo,
        mostrar_logo: campana.mostrar_logo,
        tamano_fuente: campana.tamano_fuente,
        efectos_aleatorios: campana.efectos_aleatorios,
        mostrar_mensajes: campana.mostrar_mensajes,
        duracion_mensaje: campana.duracion_mensaje,
        mensajes: campana.mensajes,
      });
      await load();
      setMsg("Foto del slide actualizada.");
      onSaved?.();
    }
    return result;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-2 border-b border-stone-800 p-3">
        {ZONAS.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => setZona(z.id)}
            className={`tap flex-1 rounded-xl px-3 py-3 text-left ${
              zona === z.id
                ? "bg-amber-600 text-stone-950"
                : "bg-stone-800 text-stone-200"
            }`}
          >
            <span className="text-xl">{z.icon}</span>
            <span className="mt-1 block text-sm font-bold">{z.label}</span>
            <span className="block text-[11px] opacity-80">{z.desc}</span>
          </button>
        ))}
      </div>

      <div
        ref={scroll.ref}
        tabIndex={scroll.tabIndex}
        onKeyDown={scroll.onKeyDown}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 ${scroll.className}`}
        data-control-scroll="publicidad"
      >
        {loading && (
          <p className="py-10 text-center text-stone-500">Cargando campaña…</p>
        )}
        {err && (
          <p className="mb-3 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}
        {msg && (
          <p className="mb-3 rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
            {msg}
          </p>
        )}

        {campana && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-stone-700 bg-stone-900/70 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block sm:col-span-1">
                <span className="text-xs font-semibold uppercase text-stone-400">
                  Segundos por slide
                </span>
                <input
                  type="range"
                  min={3}
                  max={20}
                  step={1}
                  value={campana.segundos || 7}
                  onChange={(e) =>
                    setCampana((c) => ({
                      ...c,
                      segundos: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full"
                />
                <span className="mt-1 block text-center font-display text-2xl text-amber-300">
                  {campana.segundos || 7}s
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase text-stone-400">
                  Efecto visual
                </span>
                <select
                  value={campana.efecto_visual || "fade"}
                  disabled={!!campana.efectos_aleatorios}
                  onChange={(e) =>
                    setCampana((c) => ({
                      ...c,
                      efecto_visual: e.target.value,
                    }))
                  }
                  className="tap mt-2 w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-3 text-base text-ivory disabled:opacity-40"
                >
                  {EFECTOS.map((ef) => (
                    <option key={ef.id} value={ef.id}>
                      {ef.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase text-stone-400">
                  Tamaño del texto
                </span>
                <select
                  value={campana.tamano_fuente || "mediano"}
                  onChange={(e) =>
                    setCampana((c) => ({
                      ...c,
                      tamano_fuente: e.target.value,
                    }))
                  }
                  className="tap mt-2 w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-3 text-base text-ivory"
                >
                  {FUENTES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>

              <Toggle
                label="Efectos aleatorios"
                hint="Ignora el efecto fijo; 1 de 10 al azar"
                on={!!campana.efectos_aleatorios}
                onToggle={() =>
                  setCampana((c) => ({
                    ...c,
                    efectos_aleatorios: !c.efectos_aleatorios,
                  }))
                }
              />

              <Toggle
                label="Mostrar logotipo en pantalla"
                hint="Esquina superior · El Callejón"
                on={campana.mostrar_logo !== false}
                onToggle={() =>
                  setCampana((c) => ({
                    ...c,
                    mostrar_logo: !c.mostrar_logo,
                  }))
                }
              />

              <Toggle
                label="Campaña activa"
                hint="Si está off, las TVs muestran vacío"
                on={!!campana.activo}
                onToggle={() =>
                  setCampana((c) => ({ ...c, activo: !c.activo }))
                }
              />
            </div>

            {/* Mensajes dinámicos */}
            <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-amber-200">
                    💬 Mensajes dinámicos (banner TV)
                  </h3>
                  <p className="text-xs text-stone-400">
                    Reemplaza el espacio del banner de música · esquina inferior
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addMensaje}
                  className="tap rounded-xl bg-stone-800 px-3 py-2 text-sm font-semibold"
                >
                  ＋ Agregar mensaje
                </button>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Toggle
                  label="Mostrar banner en TV"
                  hint="Rotación Chef / ¿Sabías qué?"
                  on={campana.mostrar_mensajes !== false}
                  onToggle={() =>
                    setCampana((c) => ({
                      ...c,
                      mostrar_mensajes: !c.mostrar_mensajes,
                    }))
                  }
                />
                <label className="block rounded-xl border border-stone-700 bg-stone-950/50 px-3 py-3">
                  <span className="text-xs font-semibold uppercase text-stone-400">
                    Segundos por mensaje
                  </span>
                  <input
                    type="range"
                    min={4}
                    max={20}
                    step={1}
                    value={campana.msgSegundos || 9}
                    onChange={(e) =>
                      setCampana((c) => ({
                        ...c,
                        msgSegundos: Number(e.target.value),
                      }))
                    }
                    className="mt-2 w-full"
                  />
                  <span className="mt-1 block text-center font-display text-xl text-amber-300">
                    {campana.msgSegundos || 9}s
                  </span>
                </label>
              </div>

              <ul className="space-y-2">
                {(campana.mensajes || []).map((m, idx) => (
                  <li
                    key={m.id || idx}
                    className="rounded-xl border border-stone-700 bg-stone-900/70 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <select
                        value={m.categoria || "chef"}
                        onChange={(e) =>
                          updateMensaje(m.id, { categoria: e.target.value })
                        }
                        className="tap shrink-0 rounded-lg border border-stone-600 bg-stone-950 px-2 py-2 text-sm text-ivory"
                      >
                        {CAT_MSG.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={m.texto || ""}
                        onChange={(e) =>
                          updateMensaje(m.id, { texto: e.target.value })
                        }
                        rows={2}
                        maxLength={280}
                        placeholder="Ej: Prueba nuestros jugos naturales 100% frescos elaborados al instante"
                        className="tap min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-ivory outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeMensaje(m.id)}
                        className="tap shrink-0 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
                {!campana.mensajes?.length && (
                  <p className="py-4 text-center text-sm text-stone-500">
                    Sin mensajes · agrega recomendaciones o datos curiosos
                  </p>
                )}
              </ul>
            </section>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-100">
                Diapositivas ({campana.slides?.length || 0})
              </h3>
              <button
                type="button"
                onClick={() => setUploadFor("new")}
                className="tap rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold"
              >
                ＋ Agregar slide con foto
              </button>
            </div>

            <ul className="space-y-3">
              {(campana.slides || []).map((s, idx) => (
                <li
                  key={s.id || idx}
                  className="rounded-xl border border-stone-700 bg-stone-900/60 p-3"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-800">
                      <img
                        src={s.imagen_url || "/images/slides/slide1-buffet.jpg"}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src =
                            "/images/slides/slide1-buffet.jpg";
                        }}
                      />
                      <button
                        type="button"
                        title="Cambiar foto"
                        onClick={() => setUploadFor(s.id)}
                        className="tap absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-sm"
                      >
                        📷
                      </button>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        type="text"
                        value={s.texto_principal || ""}
                        onChange={(e) =>
                          updateSlide(s.id, {
                            texto_principal: e.target.value,
                          })
                        }
                        placeholder="Texto principal"
                        className="tap w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-base font-semibold text-ivory outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={s.texto_secundario || ""}
                        onChange={(e) =>
                          updateSlide(s.id, {
                            texto_secundario: e.target.value,
                          })
                        }
                        placeholder="Texto secundario"
                        className="tap w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-sm text-ivory outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveSlide(s.id, -1)}
                        className="tap rounded bg-stone-800 px-2 py-1 text-xs"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlide(s.id, 1)}
                        className="tap rounded bg-stone-800 px-2 py-1 text-xs"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSlide(s.id)}
                        className="tap rounded bg-rose-950/60 px-2 py-1 text-xs text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-stone-700 bg-stone-900 p-3">
        <button
          type="button"
          disabled={saving || !campana}
          onClick={handleSave}
          className="tap w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-700 py-4 text-base font-bold text-stone-950 disabled:opacity-40"
        >
          {saving ? "Sincronizando…" : "Guardar y Sincronizar Pantallas"}
        </button>
      </div>

      <ImageCropUploadModal
        open={!!uploadFor}
        product={
          uploadFor
            ? {
                id: uploadFor,
                codigo: zona,
                nombre:
                  uploadFor === "new"
                    ? "Nuevo slide publicitario"
                    : "Foto del slide",
              }
            : null
        }
        customUpload={handleSlideUpload}
        onClose={() => setUploadFor(null)}
        onUploaded={() => setUploadFor(null)}
      />
    </div>
  );
}

function Toggle({ label, hint, on, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-700 bg-stone-950/50 px-3 py-3">
      <div>
        <p className="text-sm font-semibold text-stone-100">{label}</p>
        {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`tap relative h-10 w-16 shrink-0 rounded-full ${
          on ? "bg-emerald-600" : "bg-stone-600"
        }`}
      >
        <span
          className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${
            on ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
