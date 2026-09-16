import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function LandingPageAdminPanel() {
  const [activeTab, setActiveTab] = useState("info"); // info | hero | menu | eventos | fotos
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [availableImages, setAvailableImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Cargar configuración
  useEffect(() => {
    let active = true;
    async function fetchConfig() {
      try {
        setLoading(true);
        const [conf, imgs] = await Promise.all([
          api.getLandingConfig().catch(() => null),
          api.getLandingImages().catch(() => ({ imagenes: [] })),
        ]);
        if (active) {
          if (conf) setConfig(conf);
          if (imgs?.imagenes) setAvailableImages(imgs.imagenes);
        }
      } catch (err) {
        if (active) setError(err.message || "Error al cargar configuración");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchConfig();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setError("");
      setSaveSuccess(false);
      const updated = await api.updateLandingConfig(config);
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setError(err.message || "Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const res = await api.uploadLandingImage(file);
      if (res?.url) {
        // Recargar imágenes
        const imgs = await api.getLandingImages().catch(() => ({ imagenes: [] }));
        if (imgs?.imagenes) setAvailableImages(imgs.imagenes);
        alert(`¡Imagen subida con éxito!\nURL: ${res.url}`);
      }
    } catch (err) {
      alert(`Error al subir imagen: ${err.message}`);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-cream/70">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e8c56a] border-t-transparent" />
          <span>Cargando configuración del Sitio Web...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 text-center text-rose-300">
        <p>No se pudo obtener la configuración del sitio web.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-black/40 px-4 py-2 text-xs text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black/25">
      {/* Barra de cabecera con pestañas y botón de guardado */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[rgba(232,197,106,0.15)] bg-black/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <h2 className="font-display text-base font-bold text-ivory">
              Gestor del Sitio Web (Landing Turística)
            </h2>
            <p className="text-[11px] text-cream/55">
              Edita textos, imágenes, eventos y menú compartidos en una sola base de datos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 animate-pulse">
              ✓ ¡Cambios guardados!
            </span>
          )}
          {error && (
            <span className="text-xs font-semibold text-rose-400">
              {error}
            </span>
          )}

          <button
            type="button"
            onClick={() => window.open("/restaurante", "_blank")}
            className="flex items-center gap-1.5 rounded-lg border border-[#e8c56a]/40 bg-[#211a14] px-3 py-1.5 text-xs font-semibold text-[#e8c56a] hover:bg-[#32281e] transition-colors"
          >
            <span>Ver Web</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#e8c56a] to-[#d49e37] px-4 py-1.5 text-xs font-bold text-black shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-black border-t-transparent" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>💾 Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-pestañas del panel CMS */}
      <div className="flex shrink-0 border-b border-[rgba(232,197,106,0.12)] bg-black/20 px-4">
        {[
          { id: "info", label: "Información General", icon: "🏢" },
          { id: "hero", label: "Portada & Textos", icon: "✨" },
          { id: "menu", label: "Platillos del Menú", icon: "🍽️" },
          { id: "eventos", label: "Eventos & Catering", icon: "🎉" },
          { id: "fotos", label: "Galería & Fotos", icon: "📸" },
        ].map((item) => (
          <button
            key={item.code || item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === item.id
                ? "border-[#e8c56a] text-[#e8c56a] bg-black/30"
                : "border-transparent text-cream/60 hover:text-cream hover:bg-black/15"
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Contenedor con scroll de cada sub-pestaña */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* PESTAÑA: INFORMACIÓN GENERAL */}
        {activeTab === "info" && (
          <div className="max-w-4xl space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-cream/80 mb-1">
                  Nombre Oficial del Restaurante
                </label>
                <input
                  type="text"
                  value={config.info_general?.nombre || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      info_general: { ...config.info_general, nombre: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cream/80 mb-1">
                  Eslogan / Lema
                </label>
                <input
                  type="text"
                  value={config.info_general?.eslogan || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      info_general: { ...config.info_general, eslogan: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-cream/80 mb-1">
                  WhatsApp Oficial (Visible en la web)
                </label>
                <input
                  type="text"
                  value={config.info_general?.whatsapp || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      info_general: { ...config.info_general, whatsapp: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cream/80 mb-1">
                  Número WhatsApp Directo (Solo dígitos, ej: 50585121494)
                </label>
                <input
                  type="text"
                  value={config.info_general?.whatsapp_raw || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      info_general: { ...config.info_general, whatsapp_raw: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-cream/80 mb-1">
                  Correo Electrónico de Reservaciones
                </label>
                <input
                  type="email"
                  value={config.info_general?.email || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      info_general: { ...config.info_general, email: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cream/80 mb-1">
                  URL Enlace a Google Maps
                </label>
                <input
                  type="text"
                  value={config.info_general?.google_maps_url || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      info_general: { ...config.info_general, google_maps_url: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                Dirección Oficial en León
              </label>
              <input
                type="text"
                value={config.info_general?.direccion || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    info_general: { ...config.info_general, direccion: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                Horarios de Atención
              </label>
              <input
                type="text"
                value={config.info_general?.horarios_texto || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    info_general: { ...config.info_general, horarios_texto: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                Descripción de la Empresa (Extracto Oficial)
              </label>
              <textarea
                rows={3}
                value={config.info_general?.descripcion_larga || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    info_general: { ...config.info_general, descripcion_larga: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* PESTAÑA: PORTADA & TEXTOS */}
        {activeTab === "hero" && (
          <div className="max-w-4xl space-y-5">
            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                Etiqueta Destacada (Badge superior)
              </label>
              <input
                type="text"
                value={config.hero?.badge || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    hero: { ...config.hero, badge: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                Título Principal
              </label>
              <input
                type="text"
                value={config.hero?.titulo || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    hero: { ...config.hero, titulo: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                Subtítulo / Mensaje de Bienvenida
              </label>
              <textarea
                rows={3}
                value={config.hero?.subtitulo || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    hero: { ...config.hero, subtitulo: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cream/80 mb-1">
                URL de Imagen de Fondo Hero
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.hero?.imagen_fondo || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      hero: { ...config.hero, imagen_fondo: e.target.value },
                    })
                  }
                  placeholder="/images/slides/slide-ambiente-salon-1.jpg"
                  className="flex-1 rounded-lg border border-[rgba(232,197,106,0.25)] bg-black/40 px-3 py-2 text-xs text-ivory focus:border-[#e8c56a] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: PLATILLOS DEL MENÚ */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-ivory">
                  Platillos Mostrados en la Web Turística
                </h3>
                <p className="text-[11px] text-cream/55">
                  Puedes editar precios en Córdobas (C$) y Dólares ($), descripciones y fotos
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nuevo = {
                    id: `dish-${Date.now()}`,
                    nombre: "Nuevo Platillo",
                    categoria: "Especialidades",
                    precio_nio: 180,
                    precio_usd: 5.0,
                    descripcion: "Descripción del platillo y acompañamientos.",
                    imagen: "/images/platillos/asados-casa-card.jpg",
                    destacado: false,
                  };
                  setConfig({
                    ...config,
                    menu_items: [nuevo, ...(config.menu_items || [])],
                  });
                }}
                className="rounded-lg bg-[#e8c56a] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#d49e37] transition-colors"
              >
                + Agregar Platillo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(config.menu_items || []).map((dish, idx) => (
                <div
                  key={dish.id || idx}
                  className="rounded-xl border border-[rgba(232,197,106,0.2)] bg-black/30 p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={dish.imagen || "/images/logo_callejon_catalog.jpg"}
                      alt={dish.nombre}
                      className="h-14 w-14 rounded-lg object-cover border border-[#e8c56a]/30"
                      onError={(e) => {
                        e.target.src = "/images/logo_callejon_catalog.jpg";
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={dish.nombre || ""}
                        onChange={(e) => {
                          const items = [...config.menu_items];
                          items[idx].nombre = e.target.value;
                          setConfig({ ...config, menu_items: items });
                        }}
                        className="w-full rounded border border-[rgba(232,197,106,0.25)] bg-black/50 px-2 py-1 text-xs font-bold text-ivory"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={dish.categoria || ""}
                          onChange={(e) => {
                            const items = [...config.menu_items];
                            items[idx].categoria = e.target.value;
                            setConfig({ ...config, menu_items: items });
                          }}
                          placeholder="Categoría"
                          className="w-28 rounded border border-white/10 bg-black/50 px-2 py-0.5 text-[11px] text-[#e8c56a]"
                        />
                        <label className="flex items-center gap-1 text-[11px] text-cream/70 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!dish.destacado}
                            onChange={(e) => {
                              const items = [...config.menu_items];
                              items[idx].destacado = e.target.checked;
                              setConfig({ ...config, menu_items: items });
                            }}
                          />
                          <span>Destacado ⭐</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar ${dish.nombre}?`)) {
                          const items = config.menu_items.filter((_, i) => i !== idx);
                          setConfig({ ...config, menu_items: items });
                        }
                      }}
                      className="text-rose-400 hover:text-rose-300 text-xs p-1"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-cream/60">Precio C$ (NIO)</span>
                      <input
                        type="number"
                        step="1"
                        value={dish.precio_nio || 0}
                        onChange={(e) => {
                          const items = [...config.menu_items];
                          items[idx].precio_nio = Number(e.target.value);
                          items[idx].precio_usd = Number((Number(e.target.value) / 36.7).toFixed(2));
                          setConfig({ ...config, menu_items: items });
                        }}
                        className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-ivory"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-cream/60">Precio $ (USD)</span>
                      <input
                        type="number"
                        step="0.05"
                        value={dish.precio_usd || 0}
                        onChange={(e) => {
                          const items = [...config.menu_items];
                          items[idx].precio_usd = Number(e.target.value);
                          setConfig({ ...config, menu_items: items });
                        }}
                        className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-ivory"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-cream/60">Descripción</span>
                    <textarea
                      rows={2}
                      value={dish.descripcion || ""}
                      onChange={(e) => {
                        const items = [...config.menu_items];
                        items[idx].descripcion = e.target.value;
                        setConfig({ ...config, menu_items: items });
                      }}
                      className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-ivory"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-cream/60">URL Imagen</span>
                    <input
                      type="text"
                      value={dish.imagen || ""}
                      onChange={(e) => {
                        const items = [...config.menu_items];
                        items[idx].imagen = e.target.value;
                        setConfig({ ...config, menu_items: items });
                      }}
                      placeholder="/images/platillos/canelones-card.jpg"
                      className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-cream/80"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA: EVENTOS & CATERING */}
        {activeTab === "eventos" && (
          <div className="space-y-6">
            <h3 className="font-display font-bold text-sm text-ivory">
              Celebraciones & Eventos Privados
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(config.eventos || []).map((evt, idx) => (
                <div
                  key={evt.id || idx}
                  className="rounded-xl border border-[rgba(232,197,106,0.2)] bg-black/30 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={evt.icono || "🎉"}
                      onChange={(e) => {
                        const evts = [...config.eventos];
                        evts[idx].icono = e.target.value;
                        setConfig({ ...config, eventos: evts });
                      }}
                      className="w-10 text-center rounded border border-white/10 bg-black/50 py-1 text-lg"
                    />
                    <input
                      type="text"
                      value={evt.titulo || ""}
                      onChange={(e) => {
                        const evts = [...config.eventos];
                        evts[idx].titulo = e.target.value;
                        setConfig({ ...config, eventos: evts });
                      }}
                      className="flex-1 rounded border border-[rgba(232,197,106,0.25)] bg-black/50 px-2 py-1 text-xs font-bold text-ivory"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-cream/60">Descripción</span>
                    <textarea
                      rows={2}
                      value={evt.descripcion || ""}
                      onChange={(e) => {
                        const evts = [...config.eventos];
                        evts[idx].descripcion = e.target.value;
                        setConfig({ ...config, eventos: evts });
                      }}
                      className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-ivory"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-cream/60">URL Imagen</span>
                    <input
                      type="text"
                      value={evt.imagen || ""}
                      onChange={(e) => {
                        const evts = [...config.eventos];
                        evts[idx].imagen = e.target.value;
                        setConfig({ ...config, eventos: evts });
                      }}
                      placeholder="/images/slides/slide-ambiente-salon-1.jpg"
                      className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-cream/80"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PESTAÑA: GALERÍA & FOTOS */}
        {activeTab === "fotos" && (
          <div className="space-y-6">
            {/* Subida directa */}
            <div className="rounded-xl border-2 border-dashed border-[#e8c56a]/40 bg-black/20 p-6 text-center">
              <span className="text-3xl block mb-2">📸</span>
              <p className="text-xs font-semibold text-ivory mb-1">
                Subir Nueva Imagen al Servidor
              </p>
              <p className="text-[11px] text-cream/55 mb-4">
                Se guardará en la carpeta unificada <code>/images/landing/</code>
              </p>
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-[#e8c56a] px-4 py-2 text-xs font-bold text-black hover:bg-[#d49e37] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
                {uploadingImage ? "Subiendo imagen..." : "Seleccionar Archivo"}
              </label>
            </div>

            {/* Biblioteca disponible */}
            <div>
              <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#e8c56a] mb-3">
                Imágenes Disponibles en el Repositorio ({availableImages.length})
              </h4>
              <p className="text-[11px] text-cream/50 mb-3">
                Haz clic en cualquier imagen para copiar su URL y pegarla en platillos, eventos o portada
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-96 overflow-y-auto p-1">
                {availableImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(img.url);
                      alert(`URL copiada al portapapeles:\n${img.url}`);
                    }}
                    className="group relative rounded-lg border border-white/10 overflow-hidden bg-black/40 h-24 hover:border-[#e8c56a] transition-all text-left"
                    title="Clic para copiar URL"
                  >
                    <img
                      src={img.url}
                      alt={img.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-[9px] text-cream/80 truncate">
                      {img.nombre}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
