import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { api } from "../lib/api";

/** Plantillas de recorte */
const TEMPLATES = {
  hero: {
    id: "hero",
    label: "Hero 1:1 (columna central)",
    aspect: 1,
    outW: 900,
    outH: 900,
    hint: "Cuadrada — se muestra grande al rotar en el centro",
  },
  card: {
    id: "card",
    label: "Tarjeta ancha (listas laterales)",
    aspect: 2.4,
    outW: 960,
    outH: 400,
    hint: "Panorámica — fondo de la tarjeta con fade",
  },
};

const FILTER_PRESETS = [
  { id: "none", label: "Original", f: {} },
  { id: "vivid", label: "Vívido", f: { brightness: 1.08, contrast: 1.15, saturate: 1.35 } },
  { id: "warm", label: "Cálido", f: { brightness: 1.05, contrast: 1.05, saturate: 1.15, warmth: 18 } },
  { id: "cool", label: "Frío", f: { brightness: 1.02, contrast: 1.08, saturate: 0.95, warmth: -16 } },
  { id: "soft", label: "Suave", f: { brightness: 1.06, contrast: 0.92, saturate: 0.9, blur: 0.6 } },
  { id: "drama", label: "Dramático", f: { brightness: 0.95, contrast: 1.35, saturate: 1.1 } },
  { id: "food", label: "Food", f: { brightness: 1.1, contrast: 1.12, saturate: 1.25, warmth: 10 } },
  { id: "bw", label: "B/N", f: { saturate: 0, contrast: 1.15 } },
];

const DEFAULT_FILTERS = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  warmth: 0,
  blur: 0,
  preset: "none",
};

/**
 * Modal pro: filtros estilo teléfono + 2 plantillas de recorte (hero 1:1 y tarjeta ancha)
 * + opción quitar fondo (rembg en servidor).
 */
export default function ImageCropUploadModal({
  open,
  product,
  onClose,
  onUploaded,
  customUpload,
}) {
  const [src, setSrc] = useState(null);
  const [filteredSrc, setFilteredSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState("filters"); // filters | hero | card
  const [heroBlob, setHeroBlob] = useState(null);
  const [cardBlob, setCardBlob] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [removeBg, setRemoveBg] = useState(false);

  const template = TEMPLATES[step === "card" ? "card" : "hero"];

  const reset = useCallback(() => {
    setSrc(null);
    setFilteredSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setBusy(false);
    setErr("");
    setDragOver(false);
    setStep("filters");
    setHeroBlob(null);
    setCardBlob(null);
    setFilters(DEFAULT_FILTERS);
    setRemoveBg(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose?.();
  };

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setErr("Seleccione un archivo de imagen");
      return;
    }
    setErr("");
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(String(reader.result));
      setFilteredSrc(null);
      setStep("filters");
      setHeroBlob(null);
      setCardBlob(null);
      setFilters(DEFAULT_FILTERS);
    };
    reader.readAsDataURL(file);
  }

  // Aplicar filtros al canvas cuando cambian
  useEffect(() => {
    if (!src || step !== "filters") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await applyFiltersToDataUrl(src, filters);
        if (!cancelled) setFilteredSrc(dataUrl);
      } catch {
        if (!cancelled) setFilteredSrc(src);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, filters, step]);

  const previewSrc = filteredSrc || src;

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function applyPreset(presetId) {
    const p = FILTER_PRESETS.find((x) => x.id === presetId) || FILTER_PRESETS[0];
    setFilters({
      ...DEFAULT_FILTERS,
      ...p.f,
      preset: presetId,
    });
  }

  async function confirmCropStep() {
    if (!previewSrc || !croppedAreaPixels) {
      setErr("Ajuste el recorte antes de continuar");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const tpl = step === "card" ? TEMPLATES.card : TEMPLATES.hero;
      const blob = await getCroppedBlob(
        previewSrc,
        croppedAreaPixels,
        tpl.outW,
        tpl.outH
      );
      if (step === "hero" || step === "filters") {
        // Si venimos de filters, ir a hero; si en hero, guardar y pasar a card
        if (step === "filters") {
          setStep("hero");
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setCroppedAreaPixels(null);
        } else {
          setHeroBlob(blob);
          setStep("card");
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setCroppedAreaPixels(null);
        }
      } else {
        setCardBlob(blob);
        await doUpload(heroBlob, blob);
      }
    } catch (e) {
      setErr(e.message || "Error en el recorte");
    } finally {
      setBusy(false);
    }
  }

  async function doUpload(hero, card) {
    if (!customUpload && !product?.id) {
      setErr("Producto no válido");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      let result;
      if (customUpload) {
        // Publicidad: solo un recorte (hero)
        result = await customUpload(hero || card);
      } else {
        result = await api.uploadProductoImagen(
          product.id,
          hero,
          `${product.codigo || "producto"}.jpg`,
          { cardBlob: card, removeBg }
        );
      }
      onUploaded?.(result);
      handleClose();
    } catch (e) {
      setErr(e.message || "Error al subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  // Publicidad: flujo simple 1:1 sin dual
  const isPublicidad = !!customUpload;

  async function handleSimpleUpload() {
    if (!previewSrc || !croppedAreaPixels) {
      setErr("Recorte la imagen antes de subir");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const blob = await getCroppedBlob(previewSrc, croppedAreaPixels, 900, 900);
      const result = await customUpload(blob);
      onUploaded?.(result);
      handleClose();
    } catch (e) {
      setErr(e.message || "Error al subir");
    } finally {
      setBusy(false);
    }
  }

  const stepLabel = useMemo(() => {
    if (isPublicidad) return "Recorte 1:1";
    if (step === "filters") return "1/3 · Filtros y retoque";
    if (step === "hero") return "2/3 · Recorte hero 1:1";
    return "3/3 · Recorte tarjeta ancha";
  }, [step, isPublicidad]);

  if (!open || (!product && !customUpload)) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 sm:p-3">
      <div className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-600 bg-stone-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-700 px-4 py-3">
          <div>
            <h3 className="font-bold text-amber-100">📷 Estudio de foto</h3>
            <p className="text-xs text-stone-400">
              {product?.nombre || "Imagen"} · {stepLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="tap rounded-lg bg-stone-800 px-3 py-1.5 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!src ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                loadFile(e.dataTransfer.files?.[0]);
              }}
              className={`tap flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition ${
                dragOver
                  ? "border-amber-500 bg-amber-950/30"
                  : "border-stone-600 bg-stone-900/50"
              }`}
            >
              <span className="text-4xl">🖼️</span>
              <span className="mt-3 font-semibold text-stone-200">
                Arrastre una imagen aquí
              </span>
              <span className="mt-1 text-sm text-stone-500">
                o toque para seleccionar
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
            </label>
          ) : step === "filters" && !isPublicidad ? (
            <div className="space-y-3">
              <div className="relative h-56 w-full overflow-hidden rounded-xl bg-stone-900">
                <img
                  src={previewSrc}
                  alt="Vista previa"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200/80">
                  Filtros rápidos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={`tap rounded-full px-2.5 py-1 text-xs font-semibold ${
                        filters.preset === p.id
                          ? "bg-amber-500/30 text-amber-100 ring-1 ring-amber-400/50"
                          : "bg-stone-800 text-stone-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Slider
                  label="Brillo"
                  min={0.5}
                  max={1.6}
                  step={0.02}
                  value={filters.brightness}
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, brightness: v, preset: "custom" }))
                  }
                />
                <Slider
                  label="Contraste"
                  min={0.5}
                  max={1.8}
                  step={0.02}
                  value={filters.contrast}
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, contrast: v, preset: "custom" }))
                  }
                />
                <Slider
                  label="Saturación"
                  min={0}
                  max={2}
                  step={0.02}
                  value={filters.saturate}
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, saturate: v, preset: "custom" }))
                  }
                />
                <Slider
                  label="Temperatura (frío ↔ cálido)"
                  min={-40}
                  max={40}
                  step={1}
                  value={filters.warmth}
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, warmth: v, preset: "custom" }))
                  }
                />
                <Slider
                  label="Desenfoque"
                  min={0}
                  max={4}
                  step={0.1}
                  value={filters.blur}
                  onChange={(v) =>
                    setFilters((f) => ({ ...f, blur: v, preset: "custom" }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="accent-amber-500"
                />
                Quitar fondo (rembg en servidor) · recomendado en hero 1:1
              </label>

              <button
                type="button"
                onClick={() => {
                  setSrc(null);
                  setFilteredSrc(null);
                }}
                className="tap text-sm text-amber-400 underline"
              >
                Elegir otra imagen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-stone-400">
                {isPublicidad
                  ? "Recorte cuadrado para la diapositiva"
                  : template.hint}
              </p>
              <div className="relative h-72 w-full overflow-hidden rounded-xl bg-stone-900">
                <Cropper
                  image={previewSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={isPublicidad ? 1 : template.aspect}
                  cropShape="rect"
                  showGrid
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <label className="block text-sm text-stone-400">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-1 w-full accent-amber-500"
                />
              </label>
              {!isPublicidad && (
                <div className="flex gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      heroBlob
                        ? "bg-emerald-900/50 text-emerald-200"
                        : "bg-stone-800 text-stone-400"
                    }`}
                  >
                    Hero {heroBlob ? "✓" : "…"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      cardBlob
                        ? "bg-emerald-900/50 text-emerald-200"
                        : "bg-stone-800 text-stone-400"
                    }`}
                  >
                    Tarjeta {cardBlob ? "✓" : "…"}
                  </span>
                </div>
              )}
            </div>
          )}

          {err && (
            <p className="mt-3 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
              {err}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-stone-700 p-3">
          <button
            type="button"
            onClick={handleClose}
            className="tap rounded-xl border border-stone-600 px-4 py-3 font-semibold"
          >
            Cancelar
          </button>
          {src && step === "filters" && !isPublicidad && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("hero");
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCroppedAreaPixels(null);
              }}
              className="tap flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-700 py-3 font-bold text-stone-950"
            >
              Continuar a recortes →
            </button>
          )}
          {src && (step === "hero" || step === "card") && !isPublicidad && (
            <>
              {step === "card" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("hero");
                    setCroppedAreaPixels(null);
                  }}
                  className="tap rounded-xl border border-stone-600 px-3 py-3 text-sm"
                >
                  ← Hero
                </button>
              )}
              {step === "hero" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("filters");
                  }}
                  className="tap rounded-xl border border-stone-600 px-3 py-3 text-sm"
                >
                  ← Filtros
                </button>
              )}
              <button
                type="button"
                disabled={!croppedAreaPixels || busy}
                onClick={confirmCropStep}
                className="tap flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-700 py-3 font-bold text-stone-950 disabled:opacity-40"
              >
                {busy
                  ? "Procesando…"
                  : step === "hero"
                    ? "Guardar hero y seguir →"
                    : "Subir ambas fotos"}
              </button>
            </>
          )}
          {src && isPublicidad && (
            <button
              type="button"
              disabled={!croppedAreaPixels || busy}
              onClick={handleSimpleUpload}
              className="tap flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-700 py-3 font-bold text-stone-950 disabled:opacity-40"
            >
              {busy ? "Procesando…" : "Subir foto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <label className="block text-xs text-stone-400">
      {label}: {typeof value === "number" ? value.toFixed(2) : value}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-amber-500"
      />
    </label>
  );
}

async function applyFiltersToDataUrl(imageSrc, f) {
  const image = await loadImage(imageSrc);
  const maxSide = 1400;
  let { width: w, height: h } = image;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  const blur = Number(f.blur) || 0;
  const parts = [
    `brightness(${f.brightness ?? 1})`,
    `contrast(${f.contrast ?? 1})`,
    `saturate(${f.saturate ?? 1})`,
  ];
  if (blur > 0.05) parts.push(`blur(${blur}px)`);
  ctx.filter = parts.join(" ");
  ctx.drawImage(image, 0, 0, w, h);
  ctx.filter = "none";

  // Temperatura: capa naranja/azul
  const warmth = Number(f.warmth) || 0;
  if (Math.abs(warmth) > 0.5) {
    ctx.globalCompositeOperation = warmth > 0 ? "soft-light" : "soft-light";
    const a = Math.min(0.45, Math.abs(warmth) / 90);
    ctx.fillStyle =
      warmth > 0
        ? `rgba(255, 160, 60, ${a})`
        : `rgba(60, 120, 255, ${a})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function getCroppedBlob(imageSrc, pixelCrop, outW, outH) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo generar el recorte"));
        else resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () =>
      reject(new Error("No se pudo leer la imagen"))
    );
    img.src = src;
  });
}
