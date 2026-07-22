import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { api } from "../lib/api";

/**
 * Modal: seleccionar / arrastrar imagen → recorte 1:1 → subida.
 * - product + default: api.uploadProductoImagen
 * - customUpload(blob): callback externo (publicidad, etc.)
 */
export default function ImageCropUploadModal({
  open,
  product,
  onClose,
  onUploaded,
  customUpload,
}) {
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setBusy(false);
    setErr("");
    setDragOver(false);
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
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleUpload() {
    if (!src || !croppedAreaPixels) {
      setErr("Recorte la imagen antes de subir");
      return;
    }
    if (!customUpload && !product?.id) {
      setErr("Producto no válido");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const blob = await getCroppedBlob(src, croppedAreaPixels);
      let result;
      if (customUpload) {
        result = await customUpload(blob);
      } else {
        result = await api.uploadProductoImagen(
          product.id,
          blob,
          `${product.codigo || "producto"}.jpg`
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

  if (!open || (!product && !customUpload)) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-600 bg-stone-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-700 px-4 py-3">
          <div>
            <h3 className="font-bold text-amber-100">📷 Foto del producto</h3>
            <p className="text-xs text-stone-400">
              {product.nombre} · recorte cuadrado 1:1 · fondo se limpia en servidor
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
                o toque para seleccionar desde la PC
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative h-72 w-full overflow-hidden rounded-xl bg-stone-900">
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
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
                  className="mt-1 w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setSrc(null);
                  setCroppedAreaPixels(null);
                }}
                className="tap text-sm text-amber-400 underline"
              >
                Elegir otra imagen
              </button>
            </div>
          )}

          {err && (
            <p className="mt-3 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
              {err}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-stone-700 p-3">
          <button
            type="button"
            onClick={handleClose}
            className="tap flex-1 rounded-xl border border-stone-600 py-3 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!src || !croppedAreaPixels || busy}
            onClick={handleUpload}
            className="tap flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-700 py-3 font-bold text-stone-950 disabled:opacity-40"
          >
            {busy ? "Procesando…" : "Subir foto"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Extrae un Blob JPEG del área recortada (1:1) */
async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = Math.max(pixelCrop.width, pixelCrop.height);
  // Salida cuadrada limpia
  const out = 800;
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    out,
    out
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
    img.addEventListener("error", () => reject(new Error("No se pudo leer la imagen")));
    img.src = src;
  });
}
