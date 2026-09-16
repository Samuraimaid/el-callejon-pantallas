/** URL pública del logotipo (PNG con fondo transparente) */
export const LOGO_URL = "/logo-el-callejon.png";
/** Fallback JPG por si el PNG no carga */
export const LOGO_URL_FALLBACK = "/logo-el-callejon.jpg";

/**
 * Resuelve API y WebSocket según cómo se abrió la página.
 *
 * - Si entra por IP de red (ej. http://192.168.1.129:5173), usa el mismo host
 *   vía proxy de Vite (mismo origen → no hace falta abrir el puerto 8000 en las TVs).
 * - Si VITE_API_URL / VITE_WS_URL son URLs absolutas fijas, se respetan.
 * - En localhost de desarrollo, por defecto también same-origin (proxy).
 */
function resolveRuntimeEndpoints() {
  const envApi = (import.meta.env.VITE_API_URL || "").trim();
  const envWs = (import.meta.env.VITE_WS_URL || "").trim();
  const forceAbsolute =
    envApi &&
    envApi !== "auto" &&
    !envApi.includes("localhost") &&
    !envApi.includes("127.0.0.1");

  if (forceAbsolute) {
    const api = envApi.replace(/\/$/, "");
    let ws = envWs;
    if (!ws || ws === "auto") {
      try {
        const u = new URL(api);
        const scheme = u.protocol === "https:" ? "wss:" : "ws:";
        ws = `${scheme}//${u.host}/ws`;
      } catch {
        ws = "ws://localhost:8000/ws";
      }
    }
    return { apiUrl: api, wsBase: ws.replace(/\/$/, "") };
  }

  // Same-origin: el navegador (TV o PC) solo necesita host:5173
  if (typeof window !== "undefined" && window.location?.host) {
    const { protocol, host } = window.location;
    const wsScheme = protocol === "https:" ? "wss:" : "ws:";
    return {
      apiUrl: "", // fetch("/api/...") y fetch("/health")
      wsBase: `${wsScheme}//${host}/ws`,
    };
  }

  // SSR / build sin window
  return {
    apiUrl: envApi && envApi !== "auto" ? envApi.replace(/\/$/, "") : "http://localhost:8000",
    wsBase:
      envWs && envWs !== "auto"
        ? envWs.replace(/\/$/, "")
        : "ws://localhost:8000/ws",
  };
}

const endpoints = resolveRuntimeEndpoints();
export const API_URL = endpoints.apiUrl;
export const WS_BASE = endpoints.wsBase;

/** Origen actual (para mostrar en hub / favoritos). */
export function getPublicOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5173";
}

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
  "PLT-POLLO-PLAN": "/images/platillos/PLT-POLLO-PLAN.jpg",
  "PLT-CHULETA": "/images/platillos/lomo-cerdo.jpg",
  "PLT-PESCADO": "/images/platillos/PLT-PESCADO.jpg",
  "PLT-BISTEC": "/images/platillos/churrasco.jpg",
  "PLT-CAMARONES": "/images/platillos/PLT-CAMARONES.jpg",
  "PLT-COSTILLA": "/images/platillos/PLT-COSTILLA.jpg",
  "PLT-BUFFET-A": "/images/slides/slide-platos-mixtos.jpg",
  "PLT-BUFFET-N": "/images/slides/slide1-buffet.jpg",
};

export const PLATILLO_IMAGE_DEFAULT = "/images/slides/slide1-buffet.jpg";

/** Extras / complementos — imagen propia por código */
export const EXTRA_IMAGES = {
  "EXT-ARROZ": "/images/extras/EXT-ARROZ.jpg",
  "EXT-CREMA": "/images/extras/EXT-CREMA.jpg",
  "EXT-CUAJADA": "/images/extras/EXT-CUAJADA.jpg",
  "EXT-DOBLE-PRO": "/images/extras/EXT-DOBLE-PRO.jpg",
  "EXT-PAPAS": "/images/extras/EXT-PAPAS.jpg",
  "EXT-POSTRE": "/images/extras/EXT-POSTRE.jpg",
  "EXT-QUESO": "/images/extras/EXT-QUESO.jpg",
  "EXT-TORTILLA": "/images/extras/EXT-TORTILLA.jpg",
};

/** Bebidas / sodas / cafés / licores / jugos — imagen propia por código */
export const BEBIDA_IMAGES = {
  "JUG-LIMONADA": "/images/bebidas/JUG-LIMONADA.jpg",
  "JUG-MARACUYA": "/images/bebidas/JUG-MARACUYA.jpg",
  "JUG-HORCHATA": "/images/bebidas/JUG-HORCHATA.jpg",
  "JUG-CHICHA": "/images/bebidas/JUG-CHICHA.jpg",
  "JUG-CACAO": "/images/bebidas/JUG-CACAO.jpg",
  "SOD-COCA": "/images/bebidas/SOD-COCA.jpg",
  "SOD-COCA-P": "/images/bebidas/SOD-COCA-P.jpg",
  "SOD-PEPSI": "/images/bebidas/SOD-PEPSI.jpg",
  "SOD-PEPSI-P": "/images/bebidas/SOD-PEPSI-P.jpg",
  "SOD-SPRITE": "/images/bebidas/SOD-SPRITE.jpg",
  "SOD-SPRITE-P": "/images/bebidas/SOD-SPRITE-P.jpg",
  "SOD-SEVEN": "/images/bebidas/SOD-SEVEN.jpg",
  "SOD-FANTA": "/images/bebidas/SOD-FANTA.jpg",
  "SOD-FANTA-P": "/images/bebidas/SOD-FANTA-P.jpg",
  "SOD-TORONJA": "/images/bebidas/SOD-TORONJA.jpg",
  "SOD-UVA": "/images/bebidas/SOD-UVA.jpg",
  "SOD-GINGER": "/images/bebidas/SOD-GINGER.jpg",
  "SOD-TONICA": "/images/bebidas/SOD-TONICA.jpg",
  "SOD-TE-F": "/images/bebidas/SOD-TE-F.jpg",
  "SOD-ENERGY": "/images/bebidas/SOD-ENERGY.jpg",
  "SOD-GATORADE": "/images/bebidas/SOD-GATORADE.jpg",
  "SOD-POWERADE": "/images/bebidas/SOD-POWERADE.jpg",
  "AGU-500": "/images/bebidas/AGU-500.jpg",
  "AGU-1L": "/images/bebidas/AGU-1L.jpg",
  "AGU-GAS-500": "/images/bebidas/AGU-GAS-500.jpg",
  "CAF-NEGRO": "/images/bebidas/CAF-NEGRO.jpg",
  "CAF-EXPRESSO": "/images/bebidas/CAF-EXPRESSO.jpg",
  "CAF-CON-LECHE": "/images/bebidas/CAF-CON-LECHE.jpg",
  "CAF-CAPPUCCINO": "/images/bebidas/CAF-CAPPUCCINO.jpg",
  "CAF-LATTE": "/images/bebidas/CAF-LATTE.jpg",
  "CAF-MOCHA": "/images/bebidas/CAF-MOCHA.jpg",
  "LIC-CERVEZA-N": "/images/bebidas/LIC-CERVEZA-N.jpg",
  "LIC-CERVEZA-I": "/images/bebidas/LIC-CERVEZA-I.jpg",
  "LIC-MICHELADA": "/images/bebidas/LIC-MICHELADA.jpg",
  "LIC-MARGARITA": "/images/bebidas/LIC-MARGARITA.jpg",
  "LIC-PINA-COL": "/images/bebidas/LIC-PINA-COL.jpg",
  "LIC-CUBA": "/images/bebidas/LIC-CUBA.jpg",
  "LIC-BLOODY": "/images/bebidas/LIC-BLOODY.jpg",
  "LIC-SANGRIA": "/images/bebidas/LIC-SANGRIA.jpg",
  "LIC-TEQUILA": "/images/bebidas/LIC-TEQUILA.jpg",
  "LIC-RON-A": "/images/bebidas/LIC-RON-A.jpg",
  "LIC-RON-W": "/images/bebidas/LIC-RON-W.jpg",
  "LIC-VODKA": "/images/bebidas/LIC-VODKA.jpg",
  "LIC-WHISKY": "/images/bebidas/LIC-WHISKY.jpg",
  "LIC-GIN": "/images/bebidas/LIC-GIN.jpg",
  "LIC-BRANDY": "/images/bebidas/LIC-BRANDY.jpg",
};

export const CATEGORIA_IMAGES = {
  extra: "/images/extras/EXT-PAPAS.jpg",
  bebida_jugo: "/images/bebidas/JUG-LIMONADA.jpg",
  bebida_soda: "/images/bebidas/SOD-COCA.jpg",
  cafe: "/images/bebidas/CAF-NEGRO.jpg",
  licor: "/images/bebidas/LIC-CERVEZA-N.jpg",
  default: "/images/slides/slide1-buffet.jpg",
};

const BEBIDA_TIPOS = new Set(["bebida_jugo", "bebida_soda", "cafe", "licor"]);

/** Ruta de foto por código (mapa estático o carpeta) */
export function productUploadPath(codigo, tipo) {
  if (!codigo) return null;
  const code = String(codigo).toUpperCase();
  if (EXTRA_IMAGES[code]) return EXTRA_IMAGES[code];
  if (BEBIDA_IMAGES[code]) return BEBIDA_IMAGES[code];
  if (PLATILLO_IMAGES[code]) return PLATILLO_IMAGES[code];
  if (tipo === "extra") return `/images/extras/${code}.jpg`;
  const folder = BEBIDA_TIPOS.has(tipo) ? "bebidas" : "platillos";
  return `/images/${folder}/${code}.jpg`;
}

function folderForTipo(tipo) {
  if (tipo === "extra") return "extras";
  if (["bebida_jugo", "bebida_soda", "cafe", "licor"].includes(tipo))
    return "bebidas";
  return "platillos";
}

/**
 * URL de imagen hero 1:1 (columna central).
 */
export function imageForProduct(codigo, tipo, version) {
  const code = codigo ? String(codigo).toUpperCase() : "";
  let url = null;
  if (code && EXTRA_IMAGES[code]) url = EXTRA_IMAGES[code];
  else if (code && PLATILLO_IMAGES[code]) url = PLATILLO_IMAGES[code];
  else if (code && BEBIDA_IMAGES[code]) url = BEBIDA_IMAGES[code];
  else if (code) url = productUploadPath(code, tipo);
  else if (tipo && CATEGORIA_IMAGES[tipo]) url = CATEGORIA_IMAGES[tipo];
  else url = PLATILLO_IMAGE_DEFAULT;
  return version != null ? `${url}?v=${version}` : url;
}

/**
 * URL de imagen ancha para fondo de tarjeta lateral.
 * Prefiere CODIGO-card.jpg o el -card del archivo estático del mapa.
 */
export function imageForProductCard(codigo, tipo, version) {
  const code = codigo ? String(codigo).toUpperCase() : "";
  if (!code) return imageForProduct(codigo, tipo, version);

  // Si hay mapa estático (cordon-bleu.jpg → cordon-bleu-card.jpg)
  const base =
    PLATILLO_IMAGES[code] ||
    BEBIDA_IMAGES[code] ||
    EXTRA_IMAGES[code] ||
    null;
  let cardPath;
  if (base && base.includes("/images/")) {
    cardPath = base.replace(/\.jpe?g$/i, "-card.jpg");
  } else {
    const folder = folderForTipo(tipo);
    cardPath = `/images/${folder}/${code}-card.jpg`;
  }
  return version != null ? `${cardPath}?v=${version}` : cardPath;
}

export function fallbackImageForProduct(codigo, tipo) {
  const code = codigo ? String(codigo).toUpperCase() : "";
  if (code && EXTRA_IMAGES[code]) return EXTRA_IMAGES[code];
  if (code && PLATILLO_IMAGES[code]) return PLATILLO_IMAGES[code];
  if (code && BEBIDA_IMAGES[code]) return BEBIDA_IMAGES[code];
  if (tipo && CATEGORIA_IMAGES[tipo]) return CATEGORIA_IMAGES[tipo];
  return PLATILLO_IMAGE_DEFAULT;
}

export function formatC(value) {
  const n = Number(value) || 0;
  return `C$ ${n.toFixed(2)}`;
}
