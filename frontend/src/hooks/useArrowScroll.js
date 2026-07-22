import { useCallback, useEffect, useRef } from "react";

/**
 * Hace un contenedor overflow-y focusable y scrolleable con
 * flechas ↑↓, PageUp/PageDown, Home/End (body suele estar overflow:hidden).
 */
export function useArrowScroll(enabled = true) {
  const ref = useRef(null);

  const onKeyDown = useCallback((e) => {
    const el = ref.current;
    if (!el) return;

    const key = e.key;
    if (
      !["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(
        key
      )
    ) {
      return;
    }

    // No interferir si el foco está en un input/textarea/select (salvo que sea el propio contenedor)
    const t = e.target;
    const tag = t?.tagName;
    if (
      t !== el &&
      (tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable)
    ) {
      return;
    }

    const line = 56;
    const page = Math.max(120, el.clientHeight * 0.85);

    let delta = 0;
    if (key === "ArrowDown") delta = line;
    else if (key === "ArrowUp") delta = -line;
    else if (key === "PageDown") delta = page;
    else if (key === "PageUp") delta = -page;
    else if (key === "Home") {
      e.preventDefault();
      el.scrollTo({ top: 0, behavior: "smooth" });
      return;
    } else if (key === "End") {
      e.preventDefault();
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      return;
    }

    if (delta !== 0) {
      e.preventDefault();
      el.scrollBy({ top: delta, behavior: "auto" });
    }
  }, []);

  // Enfocar el área al montar para que las flechas funcionen sin click previo
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const focusIfNeeded = () => {
      if (document.activeElement === document.body || !document.activeElement) {
        el.focus({ preventScroll: true });
      }
    };
    // Pequeño delay tras pintar
    const t = window.setTimeout(focusIfNeeded, 50);

    const onDocKey = (e) => {
      if (
        !["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(
          e.key
        )
      ) {
        return;
      }
      const ae = document.activeElement;
      const tag = ae?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        ae?.isContentEditable
      ) {
        return;
      }
      // Si el foco no está en este scroll ni en un hijo, redirigir scroll aquí
      if (ae !== el && !el.contains(ae)) {
        el.focus({ preventScroll: true });
        onKeyDown(e);
      }
    };

    document.addEventListener("keydown", onDocKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onDocKey);
    };
  }, [enabled, onKeyDown]);

  return {
    ref,
    tabIndex: 0,
    onKeyDown,
    className:
      "outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40",
  };
}
