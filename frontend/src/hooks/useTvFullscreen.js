import { useCallback, useEffect, useState } from "react";
import { isTvEmbedMode } from "../lib/tvEmbed";

function getFsElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function isStandaloneDisplay() {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.navigator.standalone === true) return true; // iOS home screen
  } catch {
    /* ignore */
  }
  return false;
}

async function requestFs(el) {
  if (!el) return false;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: "hide" });
      return true;
    }
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return true;
    }
    if (el.webkitEnterFullscreen) {
      // iOS video-style API (raro en div)
      el.webkitEnterFullscreen();
      return true;
    }
    if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Pantalla completa para Smart TVs / móviles.
 * Los navegadores suelen exigir un toque del usuario; el overlay gestiona eso.
 * En embed/preview del Centro de Control: desactivado por completo.
 */
export function useTvFullscreen({ autoTry = true } = {}) {
  const embed = isTvEmbedMode();
  const [isFs, setIsFs] = useState(
    () => !embed && (!!getFsElement() || isStandaloneDisplay())
  );
  const [supported, setSupported] = useState(!embed);
  const [standalone] = useState(() => !embed && isStandaloneDisplay());

  const sync = useCallback(() => {
    if (isTvEmbedMode()) {
      setIsFs(false);
      return;
    }
    setIsFs(!!getFsElement() || isStandaloneDisplay());
  }, []);

  useEffect(() => {
    if (embed) {
      setSupported(false);
      setIsFs(false);
      return undefined;
    }

    const el = document.documentElement;
    const ok = !!(
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen
    );
    setSupported(ok || isStandaloneDisplay());

    const onChange = () => sync();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("MSFullscreenChange", onChange);

    // Altura real (sin barra del navegador cuando se oculta)
    const setVh = () => {
      const h =
        window.visualViewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.visualViewport?.addEventListener("resize", setVh);
    window.visualViewport?.addEventListener("scroll", setVh);

    // Solo en TV real (no preview): intento suave; Chrome exige gesto
    let tryId = 0;
    if (autoTry && ok && !getFsElement() && !isStandaloneDisplay()) {
      tryId = window.setTimeout(() => {
        if (isTvEmbedMode()) return;
        requestFs(document.documentElement).then(sync);
      }, 400);
    }

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("MSFullscreenChange", onChange);
      window.removeEventListener("resize", setVh);
      window.visualViewport?.removeEventListener("resize", setVh);
      window.visualViewport?.removeEventListener("scroll", setVh);
      window.clearTimeout(tryId);
    };
  }, [autoTry, embed, sync]);

  const enter = useCallback(async () => {
    if (isTvEmbedMode()) return false;
    if (isStandaloneDisplay()) {
      setIsFs(true);
      return true;
    }
    const ok = await requestFs(document.documentElement);
    sync();
    try {
      window.scrollTo(0, 1);
    } catch {
      /* ignore */
    }
    return ok;
  }, [sync]);

  const exit = useCallback(async () => {
    if (isTvEmbedMode()) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    } catch {
      /* ignore */
    }
    sync();
  }, [sync]);

  return {
    isFullscreen: isFs,
    supported: embed ? false : supported,
    standalone: embed ? false : standalone,
    enter,
    exit,
    embed,
    /** true si conviene mostrar el botón/overlay de “entrar a pantalla completa” */
    needsPrompt: !embed && supported && !isFs && !standalone,
  };
}
