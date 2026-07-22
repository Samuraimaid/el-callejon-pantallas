/** URL pública del logotipo */
export const LOGO_URL = "/logo-el-callejon.jpg";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

export const MENU_GROUPS = [
  { id: "platillos", label: "Platillos", icon: "🍽️", tipo: "plato_preestablecido" },
  { id: "extras", label: "Extras", icon: "➕", tipo: "extra" },
  { id: "jugos", label: "Jugos", icon: "🧃", tipo: "bebida_jugo" },
  { id: "bebidas", label: "Bebidas", icon: "🥤", tipo: "bebida_soda" },
  { id: "cafes", label: "Cafés", icon: "☕", tipo: "cafe" },
  { id: "licores", label: "Licores", icon: "🍸", tipo: "licor" },
];

// ---------------------------------------------------------------------------
// Fotos locales por código (seed)
// ---------------------------------------------------------------------------

export const PLATILLO_IMAGES = {
  "PLT-CORDON": "/images/platillos/cordon-bleu.jpg",
  "PLT-CANELON": "/images/platillos/canelones.jpg",
  "PLT-LASANA": "/images/platillos/relleno.jpg",
  "PLT-CARNE-ASA": "/images/platillos/carne-asada.jpg",
  "PLT-POLLO-PLAN": "/images/platillos/pollo-asado.jpg",
  "PLT-CHULETA": "/images/platillos/lomo-cerdo.jpg",
  "PLT-PESCADO": "/images/platillos/pollo-asado.jpg",
  "PLT-BISTEC": "/images/platillos/churrasco.jpg",
  "PLT-CAMARONES": "/images/platillos/relleno.jpg",
  "PLT-COSTILLA": "/images/platillos/carne-asada.jpg",
  "PLT-BUFFET-A": "/images/slides/slide1-buffet.jpg",
  "PLT-BUFFET-N": "/images/slides/slide1-buffet.jpg",
};

export const PLATILLO_IMAGE_DEFAULT = "/images/slides/slide1-buffet.jpg";

export const CATEGORIA_IMAGES = {
  extra: "/images/platillos/pollo-asado.jpg",
  bebida_jugo: "/images/bebidas/jugos-naturales.jpg",
  bebida_soda: "/images/bebidas/jugos-naturales.jpg",
  cafe: "/images/slides/slide8-barra.jpg",
  licor: "/images/slides/slide8-barra.jpg",
  default: "/images/slides/slide1-buffet.jpg",
};

const BEBIDA_TIPOS = new Set(["bebida_jugo", "bebida_soda", "cafe", "licor"]);

/** Ruta dinámica de foto subida (rembg + blanco) */
export function productUploadPath(codigo, tipo) {
  if (!codigo) return null;
  const folder = BEBIDA_TIPOS.has(tipo) ? "bebidas" : "platillos";
  return `/images/${folder}/${String(codigo).toUpperCase()}.jpg`;
}

/**
 * URL de imagen para cards TV / control.
 * Prioridad: foto subida → mapa estático → default.
 */
export function imageForProduct(codigo, tipo, version) {
  if (codigo) {
    const uploaded = productUploadPath(codigo, tipo);
    if (uploaded) {
      return version != null ? `${uploaded}?v=${version}` : uploaded;
    }
  }
  if (codigo && PLATILLO_IMAGES[codigo]) return PLATILLO_IMAGES[codigo];
  if (tipo && CATEGORIA_IMAGES[tipo]) return CATEGORIA_IMAGES[tipo];
  return PLATILLO_IMAGE_DEFAULT;
}

export function fallbackImageForProduct(codigo, tipo) {
  if (codigo && PLATILLO_IMAGES[codigo]) return PLATILLO_IMAGES[codigo];
  if (tipo && CATEGORIA_IMAGES[tipo]) return CATEGORIA_IMAGES[tipo];
  return PLATILLO_IMAGE_DEFAULT;
}

export function formatC(value) {
  const n = Number(value) || 0;
  return `C$ ${n.toFixed(2)}`;
}
