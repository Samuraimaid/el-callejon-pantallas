import { useCallback, useEffect, useState } from "react";
import { useArrowScroll } from "../hooks/useArrowScroll";
import { api } from "../lib/api";
import ImageCropUploadModal from "./ImageCropUploadModal";

const ZONAS = [
  {
    id: "TV3",
    label: "TV #3 · Barra",
    desc: "50″ · bebidas, picada y barra · /tv/3",
    icon: "🍹",
  },
  {
    id: "TV4",
    label: "TV #4 · Parrilla",
    desc: "50″ · asados y costilla · /tv/4",
    icon: "🔥",
  },
  {
    id: "TV5",
    label: "TV #5 · VIP Ambiente",
    desc: "60″ · salón y ambiente · /tv/5",
    icon: "✨",
  },
  {
    id: "TV6",
    label: "TV #6 · VIP Platillos",
    desc: "60″ · platillos y especiales · /tv/6",
    icon: "🍽️",
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
 * Multi-video, perfiles, plantillas editables, progreso 1080p.
 */
export default function PublicidadAdminPanel({ onSaved }) {
  const [zona, setZona] = useState("TV3");
  const [campana, setCampana] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [uploadFor, setUploadFor] = useState(null);
  const [perfiles, setPerfiles] = useState([]);
  const [perfilClave, setPerfilClave] = useState("restaurante_diario");
  const [perfilEdit, setPerfilEdit] = useState(null);
  const [targetZonas, setTargetZonas] = useState({
    TV3: true,
    TV4: true,
    TV5: true,
    TV6: true,
  });
  const [batch, setBatch] = useState(null);
  const [batchPoll, setBatchPoll] = useState(null);
  const [liteMode, setLiteMode] = useState(false);
  const [togglingLite, setTogglingLite] = useState(false);
  const scroll = useArrowScroll(true);

  const loadLite = useCallback(async () => {
    try {
      const res = await api.publicidadLite();
      setLiteMode(!!res.publicidad_lite_mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadLite();
  }, [loadLite]);

  async function handleToggleLite() {
    setTogglingLite(true);
    setMsg("");
    setErr("");
    try {
      const next = !liteMode;
      const res = await api.publicidadLiteSet(next);
      setLiteMode(!!res.publicidad_lite_mode);
      setMsg(
        next
          ? "Modo Smart TV Básico ACTIVADO: Las pantallas mostrarán fotos fijas cada 20s y omitirán videos."
          : "Modo Smart TV Básico DESACTIVADO: Vuelven los videos y efectos completos."
      );
      onSaved?.();
    } catch (e) {
      setErr(e.message || "Error al cambiar modo básico");
    } finally {
      setTogglingLite(false);
    }
  }

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

  const loadPerfiles = useCallback(async () => {
    try {
      const data = await api.getPerfiles();
      setPerfiles(data.perfiles || []);
    } catch {
      /* tabla aún no migrada */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPerfiles();
  }, [loadPerfiles]);

  useEffect(() => {
    if (!batchPoll) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const b = await api.getVideoBatch(batchPoll);
        if (!alive) return;
        setBatch(b);
        if (b.status === "ready" || b.status === "partial" || b.status === "error") {
          setBatchPoll(null);
          setMsg(b.message || "Procesamiento de videos finalizado.");
          load();
          onSaved?.();
        }
      } catch {
        /* ignore poll errors */
      }
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [batchPoll, load, onSaved]);

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
          media_tipo: s.media_tipo || (s.video_url ? "video" : "image"),
          imagen_url: (s.imagen_url || "").split("?")[0],
          video_url: (s.video_url || "").split("?")[0],
          texto_principal: s.texto_principal || "",
          texto_secundario: s.texto_secundario || "",
          animacion_texto: s.animacion_texto || "fade-in-up",
          tamano_texto: s.tamano_texto || "mediano",
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
    const prev = campana?.slides?.find((s) => s.id === uploadFor);
    const result = await api.uploadPublicidadSlide(zona, blob, {
      texto_principal: prev?.texto_principal || "",
      texto_secundario: prev?.texto_secundario || "",
      animacion_texto: prev?.animacion_texto || "fade-in-up",
      tamano_texto: prev?.tamano_texto || "mediano",
    });
    if (result.campana?.slides) {
      const slides = result.campana.slides;
      const last = slides[slides.length - 1];
      const withoutLast = slides.slice(0, -1);
      const isVideo =
        last.media_tipo === "video" ||
        !!last.video_url ||
        result.media_tipo === "video";
      const patched = withoutLast.map((s) =>
        s.id === uploadFor
          ? {
              ...s,
              media_tipo: isVideo ? "video" : "image",
              imagen_url: isVideo
                ? ""
                : last.imagen_url || result.imagen_url || s.imagen_url || "",
              video_url: isVideo
                ? last.video_url || result.video_url || ""
                : "",
            }
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
      setMsg(isVideo ? "Video del slide actualizado." : "Foto del slide actualizada.");
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

        {/* —— Modo Smart TV Básico (Ahorro de Memoria RAM) —— */}
        <section className="mb-4 rounded-xl border border-sky-800/50 bg-gradient-to-r from-stone-900 via-sky-950/25 to-stone-900 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-2xl">
                ⚡
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-sky-100">
                    Modo Smart TV Básico (Anti-reinicio por RAM)
                  </h3>
                  {liteMode ? (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/40">
                      ✓ ACTIVO (20s)
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-700/40 px-2.5 py-0.5 text-xs font-semibold text-stone-400 border border-stone-600/40">
                      Desactivado (Estándar)
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-stone-300 max-w-2xl">
                  Proyecta <strong className="text-amber-200">imágenes fijas durante 20 segundos</strong>, omite por completo los videos y desactiva filtros pesados de GPU. Evita que los Smart TVs básicos (webOS, Tizen, TV Box de 1GB RAM) se cuelguen o reinicien.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={togglingLite}
              onClick={handleToggleLite}
              className={`tap rounded-xl px-5 py-2.5 text-sm font-bold transition-all shadow-md ${
                liteMode
                  ? "bg-sky-500 text-stone-950 hover:bg-sky-400"
                  : "bg-stone-800 text-stone-200 hover:bg-stone-700 border border-stone-600"
              }`}
            >
              {togglingLite
                ? "Guardando…"
                : liteMode
                ? "✓ Modo Básico Activo"
                : "Activar Modo Básico"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 border-t border-stone-800/80 pt-3 text-xs">
            <div className="flex items-center gap-2 text-stone-300">
              <span className="font-bold text-emerald-400">✓</span>
              <span>20s por diapositiva fija</span>
            </div>
            <div className="flex items-center gap-2 text-stone-300">
              <span className="font-bold text-emerald-400">✓</span>
              <span>Videos omitidos (sin crash)</span>
            </div>
            <div className="flex items-center gap-2 text-stone-300">
              <span className="font-bold text-emerald-400">✓</span>
              <span>1 sola imagen en DOM (ahorro RAM)</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-300">
              <span className="text-stone-400">URL para TV:</span>
              <code className="rounded bg-stone-950 px-1.5 py-0.5 text-[11px] font-mono text-amber-200 border border-stone-800">
                /tv/{zona === "TV3" ? 3 : zona === "TV4" ? 4 : zona === "TV5" ? 5 : 6}?lite=1
              </code>
            </div>
          </div>
        </section>

        {/* —— Multi-video + perfiles —— */}
        <section className="mb-4 space-y-3 rounded-xl border border-amber-700/40 bg-gradient-to-br from-stone-900 to-amber-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-amber-100">
                🎬 Videos multi-pantalla · 1080p
              </h3>
              <p className="text-xs text-stone-400">
                Sube varios MP4 a la vez. Se reescalan a 1080p y se publican con
                textos automáticos del perfil. Se mostrarán al terminar el
                post-proceso.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  setSaving(true);
                  const r = await api.repairEncoding();
                  setMsg(
                    `Textos UTF-8 reparados en ${Object.keys(r.zonas || {}).length} zonas.`
                  );
                  load();
                } catch (e) {
                  setErr(e.message || "No se pudo reparar encoding");
                } finally {
                  setSaving(false);
                }
              }}
              className="tap rounded-lg border border-stone-600 px-3 py-1.5 text-xs text-stone-300"
            >
              Reparar acentos
            </button>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-stone-400">
              Pantallas destino
            </p>
            <div className="flex flex-wrap gap-3">
              {ZONAS.map((z) => (
                <label
                  key={z.id}
                  className="tap flex cursor-pointer items-center gap-2 rounded-lg border border-stone-700 bg-stone-950/60 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!targetZonas[z.id]}
                    onChange={() =>
                      setTargetZonas((t) => ({ ...t, [z.id]: !t[z.id] }))
                    }
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span>
                    {z.icon} {z.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-stone-400">
                Perfil / plantillas
              </span>
              <select
                value={perfilClave}
                onChange={async (e) => {
                  const c = e.target.value;
                  setPerfilClave(c);
                  try {
                    const p = await api.getPerfil(c);
                    setPerfilEdit(p);
                    const zmap = { TV3: false, TV4: false, TV5: false, TV6: false };
                    for (const z of p.zonas || []) zmap[z] = true;
                    setTargetZonas(zmap);
                  } catch {
                    setPerfilEdit(null);
                  }
                }}
                className="tap mt-1 w-full rounded-xl border border-stone-600 bg-stone-950 px-3 py-2.5 text-sm text-ivory"
              >
                {perfiles.length === 0 && (
                  <option value="restaurante_diario">Restaurante · Diario</option>
                )}
                {perfiles.map((p) => (
                  <option key={p.clave} value={p.clave}>
                    {p.tipo === "festivo" ? "🎉 " : p.tipo === "evento" ? "🎈 " : "🍽 "}
                    {p.nombre}
                  </option>
                ))}
              </select>
              {perfilEdit?.descripcion && (
                <p className="mt-1 text-[11px] text-stone-500">
                  {perfilEdit.descripcion}
                </p>
              )}
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="tap cursor-pointer rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-stone-950">
                ＋ Varios videos
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const list = Array.from(e.target.files || []);
                    if (!list.length) return;
                    const zonas = Object.entries(targetZonas)
                      .filter(([, on]) => on)
                      .map(([k]) => k);
                    if (!zonas.length) {
                      setErr("Marca al menos una pantalla destino");
                      e.target.value = "";
                      return;
                    }
                    try {
                      setSaving(true);
                      setErr("");
                      setMsg(
                        `Subiendo ${list.length} video(s)… se reescalarán a 1080p. Cuando terminen aparecerán en las TVs.`
                      );
                      const result = await api.uploadVideosMulti(list, {
                        zonas,
                        perfil: perfilClave,
                        append: true,
                        modo_evento: perfilEdit?.modo_evento ? true : "",
                      });
                      setBatch(result.batch || null);
                      setBatchPoll(result.batch_id);
                      setMsg(result.message || "Procesando videos…");
                      onSaved?.();
                    } catch (ex) {
                      setErr(ex.message || "Error al subir videos");
                    } finally {
                      setSaving(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const zonas = Object.entries(targetZonas)
                    .filter(([, on]) => on)
                    .map(([k]) => k);
                  try {
                    setSaving(true);
                    await api.applyPerfil(perfilClave, {
                      zonas,
                      replace_slides: true,
                      apply_mensajes: true,
                    });
                    setMsg(`Perfil «${perfilClave}» aplicado a ${zonas.join(", ")}`);
                    load();
                    onSaved?.();
                  } catch (ex) {
                    setErr(ex.message || "No se pudo aplicar perfil");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="tap rounded-xl border border-amber-700/60 bg-stone-900 px-4 py-3 text-sm font-semibold text-amber-100"
              >
                Aplicar textos del perfil
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const p = await api.getPerfil(perfilClave);
                    setPerfilEdit(p);
                  } catch (ex) {
                    setErr(ex.message);
                  }
                }}
                className="tap rounded-xl border border-stone-600 px-3 py-3 text-sm text-stone-300"
              >
                Editar plantillas
              </button>
            </div>
          </div>

          {batch && (
            <div className="rounded-xl border border-stone-600 bg-stone-950/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-amber-200">
                  {batch.status === "processing"
                    ? "⏳ Post-procesando…"
                    : batch.status === "ready"
                      ? "✅ Videos listos"
                      : "📋 Lote de videos"}
                </span>
                <span className="tabular-nums text-stone-400">
                  {batch.progress ?? 0}% · {batch.ready ?? 0}/{batch.total ?? 0}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.max(2, batch.progress || 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-stone-400">{batch.message}</p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-stone-500">
                {(batch.jobs || []).map((j) => (
                  <li key={j.id} className="flex justify-between gap-2">
                    <span className="truncate">{j.filename}</span>
                    <span>
                      {j.status} {j.progress}% · {j.stage}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {perfilEdit && (
            <details className="rounded-xl border border-stone-700 bg-stone-950/50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-amber-100">
                Plantillas de «{perfilEdit.nombre}» (editables)
              </summary>
              <div className="mt-3 space-y-3">
                {ZONAS.map((z) => {
                  const pairs = perfilEdit.plantillas?.[z.id] || [];
                  return (
                    <div key={z.id}>
                      <p className="mb-1 text-xs font-bold text-stone-400">
                        {z.label}
                      </p>
                      {(pairs.length ? pairs : [{ principal: "", secundario: "" }]).map(
                        (pair, i) => (
                          <div
                            key={i}
                            className="mb-2 grid gap-2 sm:grid-cols-2"
                          >
                            <input
                              value={pair.principal || ""}
                              onChange={(e) => {
                                setPerfilEdit((p) => {
                                  const pl = {
                                    ...(p.plantillas || {}),
                                    [z.id]: [
                                      ...((p.plantillas || {})[z.id] || [
                                        { principal: "", secundario: "" },
                                      ]),
                                    ],
                                  };
                                  if (!pl[z.id][i]) {
                                    pl[z.id][i] = {
                                      principal: "",
                                      secundario: "",
                                    };
                                  }
                                  pl[z.id][i] = {
                                    ...pl[z.id][i],
                                    principal: e.target.value,
                                  };
                                  return { ...p, plantillas: pl };
                                });
                              }}
                              placeholder="Texto principal"
                              className="tap rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-sm"
                            />
                            <input
                              value={pair.secundario || ""}
                              onChange={(e) => {
                                setPerfilEdit((p) => {
                                  const pl = {
                                    ...(p.plantillas || {}),
                                    [z.id]: [
                                      ...((p.plantillas || {})[z.id] || [
                                        { principal: "", secundario: "" },
                                      ]),
                                    ],
                                  };
                                  if (!pl[z.id][i]) {
                                    pl[z.id][i] = {
                                      principal: "",
                                      secundario: "",
                                    };
                                  }
                                  pl[z.id][i] = {
                                    ...pl[z.id][i],
                                    secundario: e.target.value,
                                  };
                                  return { ...p, plantillas: pl };
                                });
                              }}
                              placeholder="Texto secundario"
                              className="tap rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-sm"
                            />
                          </div>
                        )
                      )}
                      <button
                        type="button"
                        className="text-xs text-amber-400 underline"
                        onClick={() => {
                          setPerfilEdit((p) => {
                            const pl = { ...(p.plantillas || {}) };
                            pl[z.id] = [
                              ...(pl[z.id] || []),
                              { principal: "", secundario: "" },
                            ];
                            return { ...p, plantillas: pl };
                          });
                        }}
                      >
                        ＋ par de textos en {z.id}
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      setSaving(true);
                      const updated = await api.putPerfil(perfilEdit.clave, {
                        nombre: perfilEdit.nombre,
                        descripcion: perfilEdit.descripcion,
                        plantillas: perfilEdit.plantillas,
                        mensajes: perfilEdit.mensajes,
                        zonas: perfilEdit.zonas,
                        modo_evento: perfilEdit.modo_evento,
                      });
                      setPerfilEdit(updated);
                      setMsg("Plantillas guardadas.");
                      loadPerfiles();
                    } catch (ex) {
                      setErr(ex.message || "Error al guardar plantillas");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="tap rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
                >
                  Guardar plantillas del perfil
                </button>
              </div>
            </details>
          )}
        </section>

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
                hint="Ignora el efecto fijo; 1 de 10 al azar. Si el sistema tiene modo lite global (Ambiente), las TVs #3–#6 no usan efectos."
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-amber-100">
                Diapositivas ({campana.slides?.length || 0})
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setUploadFor("new")}
                  className="tap rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold"
                >
                  ＋ Foto
                </button>
                <label className="tap cursor-pointer rounded-xl bg-amber-800/70 px-4 py-2 text-sm font-semibold text-amber-50">
                  ＋ Video MP4/WebM
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setSaving(true);
                        const result = await api.uploadPublicidadSlide(zona, f, {
                          texto_principal: "Video",
                          texto_secundario: "El Callejón",
                          animacion_texto: "fade-in-up",
                          filename: f.name || "video.mp4",
                        });
                        setCampana(normalizeCampana(result.campana));
                        setMsg("Video agregado a la campaña.");
                        onSaved?.();
                      } catch (err) {
                        setErr(err.message || "Error subiendo video");
                      } finally {
                        setSaving(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <ul className="space-y-3">
              {(campana.slides || []).map((s, idx) => (
                <li
                  key={s.id || idx}
                  className="rounded-xl border border-stone-700 bg-stone-900/60 p-3"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-800">
                      {s.media_tipo === "video" || s.video_url ? (
                        <div className="flex h-full items-center justify-center bg-stone-900 text-2xl">
                          🎬
                        </div>
                      ) : (
                        <img
                          src={s.imagen_url || "/images/slides/slide1-buffet.jpg"}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              "/images/slides/slide1-buffet.jpg";
                          }}
                        />
                      )}
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
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={s.animacion_texto || "fade-in-up"}
                          onChange={(e) =>
                            updateSlide(s.id, {
                              animacion_texto: e.target.value,
                            })
                          }
                          className="tap rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-xs text-ivory"
                        >
                          <option value="fade-in-up">Fade up</option>
                          <option value="fade">Fade</option>
                          <option value="bounce">Bounce</option>
                          <option value="marquee">Marquesina</option>
                          <option value="slide-left">Slide</option>
                          <option value="zoom">Zoom</option>
                          <option value="none">Sin animación</option>
                        </select>
                        <select
                          value={s.tamano_texto || "mediano"}
                          onChange={(e) =>
                            updateSlide(s.id, { tamano_texto: e.target.value })
                          }
                          className="tap rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-xs text-ivory"
                        >
                          <option value="pequeno">Texto peq.</option>
                          <option value="mediano">Texto med.</option>
                          <option value="grande">Texto grande</option>
                        </select>
                      </div>
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
