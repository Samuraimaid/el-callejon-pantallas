/**
 * Promociones — defaults + helpers que respetan config del operador.
 */

export const FICOSHA_PROMO = {
  id: "ficosha",
  tag: "Ficosha",
  icon: "💳",
  corto: "Ficosha · 35% de descuento en tu cuenta · sin mínimo",
  activo: true,
  dias: null,
  enMarquesina: true,
  enPublicidad: true,
};

export const DEFAULT_PROMOS = [
  {
    id: "bienvenida",
    tag: "Bienvenidos",
    icon: "✨",
    corto: "¡Bienvenidos a El Callejón! · Sabor de León desde 1990",
    activo: true,
    dias: null,
    enMarquesina: true,
    enPublicidad: false,
  },
  FICOSHA_PROMO,
  {
    id: "familia",
    tag: "Familia",
    icon: "🍽️",
    corto: "Buffet y platos de la casa · ideales para la familia",
    activo: true,
    dias: null,
    enMarquesina: true,
    enPublicidad: false,
  },
  {
    id: "martes-canelones",
    tag: "Martes",
    icon: "🍝",
    corto: "Martes · Canelones 2×1",
    activo: true,
    dias: [2],
    enMarquesina: true,
    enPublicidad: false,
  },
  {
    id: "martes-estudiantes",
    tag: "Estudiantes",
    icon: "🎓",
    corto: "Martes · Descuento para estudiantes de León",
    activo: true,
    dias: [2],
    enMarquesina: true,
    enPublicidad: false,
  },
  {
    id: "jueves-buffet",
    tag: "Jueves",
    icon: "🔥",
    corto: "Jueves · Combos especiales en el buffet",
    activo: true,
    dias: [4],
    enMarquesina: true,
    enPublicidad: false,
  },
];

function matchesDay(promo, date) {
  if (!promo?.activo) return false;
  if (promo.dias == null || !Array.isArray(promo.dias) || !promo.dias.length) {
    return true;
  }
  return promo.dias.includes(date.getDay());
}

/** Marquesina del menú (config.promos o defaults) */
export function getMensajesMarquesina(config, date = new Date()) {
  const list =
    Array.isArray(config?.promos) && config.promos.length
      ? config.promos
      : DEFAULT_PROMOS;
  return list.filter((p) => p.enMarquesina !== false && matchesDay(p, date));
}

/** Banner publicidad: promos marcadas enPublicidad o Ficosha del layout */
export function getPublicidadBanners(config, date = new Date()) {
  const layout = config?.layout || {};
  const list =
    Array.isArray(config?.promos) && config.promos.length
      ? config.promos
      : DEFAULT_PROMOS;
  const fromPromos = list.filter(
    (p) => p.enPublicidad && matchesDay(p, date)
  );
  if (fromPromos.length) return fromPromos;
  if (layout.showFicoshaOnPublicidad !== false) {
    return [
      {
        id: "ficosha",
        tag: layout.ficoshaTag || "Alianza Ficosha",
        icon: "💳",
        corto:
          layout.ficoshaCorto ||
          FICOSHA_PROMO.corto,
      },
    ];
  }
  return [];
}

export function getFicoshaBanner(config) {
  const banners = getPublicidadBanners(config);
  return banners[0] || null;
}
