/**
 * Detecta si la ruta de TV se muestra embebida (preview del Centro de Control).
 * En embed: no pantalla completa, no sync pesado, no overlays de gesto.
 */
export function isTvEmbedMode() {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("embed") === "1" || q.get("preview") === "1") return true;
  } catch {
    /* */
  }
  try {
    if (window.self !== window.top) return true;
  } catch {
    // cross-origin frame access denied → estamos embebidos
    return true;
  }
  return false;
}
