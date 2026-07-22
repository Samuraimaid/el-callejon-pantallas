import { useEffect } from "react";

/**
 * Autoscroll TV 70".
 * Requiere un contenedor con altura FIJA (ej. h-[calc(100vh-160px)])
 * y overflow-y: auto. Incrementa scrollTop +1 px/frame.
 * Al llegar al final: pausa 4s → scrollTop = 0 → reinicia.
 */
export function useAutoScroll(ref, opts = {}) {
  const {
    pxPerFrame = 1,
    pauseMs = 4000,
    enabled = true,
    startDelayMs = 500,
  } = opts;

  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    let timeoutId = 0;
    let startId = 0;
    let paused = false;
    let running = true;
    let lastLog = 0;

    const tick = (ts) => {
      if (!running) return;

      const el = ref.current;
      if (!el) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (paused) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const scrollHeight = el.scrollHeight;
      const clientHeight = el.clientHeight;
      const max = scrollHeight - clientHeight;

      // Log de diagnóstico (cada 2s) para validar desborde
      if (!lastLog || ts - lastLog > 2000) {
        console.log("Scroll Dimensions:", scrollHeight, clientHeight, {
          max,
          scrollTop: el.scrollTop,
        });
        lastLog = ts;
      }

      // Sin desborde físico: no mover
      if (max <= 2) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Llegó al borde inferior
      if (el.scrollTop >= max - 1) {
        el.scrollTop = max;
        paused = true;
        console.log("Scroll: fin de menú — pausa", pauseMs, "ms");
        timeoutId = window.setTimeout(() => {
          if (!running || !ref.current) return;
          ref.current.scrollTop = 0;
          paused = false;
          console.log("Scroll: reinicio al tope");
          rafId = requestAnimationFrame(tick);
        }, pauseMs);
        return;
      }

      // Avance sutil 1px/frame
      el.scrollTop = el.scrollTop + pxPerFrame;
      rafId = requestAnimationFrame(tick);
    };

    startId = window.setTimeout(() => {
      const el = ref.current;
      if (el) {
        console.log(
          "Scroll Dimensions (start):",
          el.scrollHeight,
          el.clientHeight
        );
      }
      rafId = requestAnimationFrame(tick);
    }, startDelayMs);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.clearTimeout(startId);
    };
  }, [ref, pxPerFrame, pauseMs, enabled, startDelayMs]);
}
