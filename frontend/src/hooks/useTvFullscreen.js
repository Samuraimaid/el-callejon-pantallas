import { useCallback, useEffect, useRef, useState } from "react";
import { isTvEmbedMode } from "../lib/tvEmbed";

const FS_UNLOCK_KEY = "tv_fs_unlocked";
const FS_WANT_KEY = "tv_fs_want"; // quiere FS tras recarga (autonomía)

function getFsElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

/** localhost / loopback → admin; las rutas /tv/* igual usan kiosco. */
export function isLocalDevHost() {
  if (typeof window === "undefined") return true;
  try {
    const h = (window.location.hostname || "").toLowerCase();
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "[::1]" ||
      h === "::1"
    );
  } catch {
    return false;
  }
}

export function isTvRoute() {
  if (typeof window === "undefined") return false;
  try {
    return /\/tv\/[1-6](\/|$|\?)/.test(
      window.location.pathname + window.location.search
    );
  } catch {
    return false;
  }
}

function isStandaloneDisplay() {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.navigator.standalone === true) return true;
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
      return !!getFsElement();
    }
    if (el.webkitRequestFullscreen) {
      // Safari / WebKit TV
      el.webkitRequestFullscreen(
        Element.ALLOW_KEYBOARD_INPUT !== undefined
          ? Element.ALLOW_KEYBOARD_INPUT
          : undefined
      );
      return true;
    }
    if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return !!getFsElement();
}

/** Intenta documentElement y body (algunas Smart TV solo aceptan body). */
async function tryEnterFullscreen() {
  if (getFsElement() || isStandaloneDisplay()) return true;
  const roots = [document.documentElement, document.body].filter(Boolean);
  for (const el of roots) {
    const ok = await requestFs(el);
    if (ok || getFsElement()) return true;
  }
  // Fallback visual: scroll para ocultar barra en algunos WebViews
  try {
    window.scrollTo(0, 1);
    document.documentElement.classList.add("tv-kiosk-soft");
  } catch {
    /* */
  }
  return !!getFsElement();
}

function markUnlocked() {
  try {
    sessionStorage.setItem(FS_UNLOCK_KEY, "1");
    localStorage.setItem(FS_UNLOCK_KEY, "1");
    localStorage.setItem(FS_WANT_KEY, "1");
  } catch {
    /* private mode */
  }
}

function wasUnlocked() {
  try {
    return (
      sessionStorage.getItem(FS_UNLOCK_KEY) === "1" ||
      localStorage.getItem(FS_UNLOCK_KEY) === "1" ||
      localStorage.getItem(FS_WANT_KEY) === "1"
    );
  } catch {
    return false;
  }
}

function wantsPersistentFs() {
  return wasUnlocked() || isTvRoute();
}

/**
 * Pantalla completa para Smart TVs.
 *
 * Limitación del navegador: tras F5 no hay "gesto de usuario", así que
 * requestFullscreen() a menudo falla en Chrome/Edge hasta el primer toque.
 * Estrategia:
 *  1) Ráfaga de reintentos al cargar (algunas TV sí permiten auto-FS)
 *  2) Reintentos al pageshow / visibility
 *  3) Primer toque/tecla entra YA (capture)
 *  4) Clase soft-kiosk mientras tanto
 *  5) En rutas /tv/* siempre modo persistente
 */
export function useTvFullscreen({ autoTry = true, persistent: persistentOpt } = {}) {
  const embed = isTvEmbedMode();
  const localDev = isLocalDevHost();
  const tvRoute = isTvRoute();

  // Persistente: TVs en red, rutas /tv, o ya se activó alguna vez
  const persistent =
    persistentOpt !== undefined
      ? !!persistentOpt && !embed
      : !embed && (tvRoute || !localDev || wasUnlocked());

  const [isFs, setIsFs] = useState(
    () => !embed && (!!getFsElement() || isStandaloneDisplay())
  );
  const [supported, setSupported] = useState(!embed);
  const [standalone] = useState(() => !embed && isStandaloneDisplay());
  const [blockedByBrowser, setBlockedByBrowser] = useState(false);
  const reenterTimer = useRef(0);
  const pollTimer = useRef(0);
  const burstTimers = useRef([]);
  const enterRef = useRef(async () => false);

  const sync = useCallback(() => {
    if (isTvEmbedMode()) {
      setIsFs(false);
      return;
    }
    const on = !!getFsElement() || isStandaloneDisplay();
    setIsFs(on);
    if (on) {
      markUnlocked();
      setBlockedByBrowser(false);
      try {
        document.documentElement.classList.remove("tv-kiosk-soft");
      } catch {
        /* */
      }
    } else if (wantsPersistentFs() || persistent) {
      try {
        document.documentElement.classList.add("tv-kiosk-soft");
      } catch {
        /* */
      }
    }
  }, [persistent]);

  const enter = useCallback(async () => {
    if (isTvEmbedMode()) return false;
    if (isStandaloneDisplay()) {
      setIsFs(true);
      markUnlocked();
      return true;
    }
    const ok = await tryEnterFullscreen();
    if (ok || getFsElement()) {
      markUnlocked();
      setBlockedByBrowser(false);
      sync();
      return true;
    }
    // Gesto del usuario y aún falla → rare; marcar para overlay
    setBlockedByBrowser(true);
    sync();
    return false;
  }, [sync]);

  enterRef.current = enter;

  const exit = useCallback(async () => {
    if (persistent) return;
    if (isTvEmbedMode()) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(FS_WANT_KEY);
    } catch {
      /* */
    }
    sync();
  }, [persistent, sync]);

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

    const onChange = () => {
      sync();
      if (
        (persistent || wantsPersistentFs()) &&
        !getFsElement() &&
        !isStandaloneDisplay()
      ) {
        window.clearTimeout(reenterTimer.current);
        // Tras salir de FS (Esc / recarga parcial), reintentar
        reenterTimer.current = window.setTimeout(() => {
          if (isTvEmbedMode()) return;
          if (getFsElement() || isStandaloneDisplay()) return;
          tryEnterFullscreen().then((success) => {
            sync();
            if (!success) setBlockedByBrowser(true);
          });
        }, 400);
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("MSFullscreenChange", onChange);

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

    // Soft kiosk + intento inmediato
    if (persistent || wantsPersistentFs()) {
      document.documentElement.classList.add("tv-kiosk-soft");
    }

    const scheduleTry = (delay) => {
      const id = window.setTimeout(() => {
        if (isTvEmbedMode()) return;
        if (getFsElement() || isStandaloneDisplay()) {
          sync();
          return;
        }
        tryEnterFullscreen().then((success) => {
          sync();
          // Si ya hubo unlock y sigue fallando → navegador exige gesto
          if (!success && wasUnlocked()) setBlockedByBrowser(true);
        });
      }, delay);
      burstTimers.current.push(id);
    };

    if (autoTry && ok && !getFsElement() && !isStandaloneDisplay()) {
      // Ráfaga: muchas Smart TV entran en el 1.er o 2.º intento
      const delays =
        persistent || wantsPersistentFs()
          ? [0, 80, 200, 450, 900, 1600, 2800, 4500]
          : [300];
      delays.forEach(scheduleTry);
    }

    // Poll mientras quiera FS y no esté dentro
    if (persistent || wantsPersistentFs()) {
      pollTimer.current = window.setInterval(() => {
        if (isTvEmbedMode()) return;
        if (getFsElement() || isStandaloneDisplay()) return;
        tryEnterFullscreen().then(sync);
      }, 2500);
    }

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!(persistent || wantsPersistentFs())) return;
      if (getFsElement() || isStandaloneDisplay()) return;
      tryEnterFullscreen().then(sync);
    };
    document.addEventListener("visibilitychange", onVis);

    // bfcache / botón atrás / recarga suave
    const onPageShow = () => {
      if (!(persistent || wantsPersistentFs())) return;
      if (getFsElement() || isStandaloneDisplay()) {
        sync();
        return;
      }
      scheduleTry(50);
      scheduleTry(400);
    };
    window.addEventListener("pageshow", onPageShow);

    // Marcar intención al cargar ruta TV
    if (tvRoute) {
      try {
        localStorage.setItem(FS_WANT_KEY, "1");
      } catch {
        /* */
      }
    }

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("MSFullscreenChange", onChange);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize", setVh);
      window.visualViewport?.removeEventListener("resize", setVh);
      window.visualViewport?.removeEventListener("scroll", setVh);
      window.clearTimeout(reenterTimer.current);
      window.clearInterval(pollTimer.current);
      burstTimers.current.forEach((id) => window.clearTimeout(id));
      burstTimers.current = [];
    };
  }, [autoTry, embed, persistent, sync, tvRoute]);

  // Primer gesto del usuario → entra a FS (válido tras F5)
  useEffect(() => {
    if (embed) return undefined;
    if (!persistent && !wasUnlocked() && !tvRoute) return undefined;

    const onGesture = (ev) => {
      if (getFsElement() || isStandaloneDisplay()) return;
      // No bloquear el evento; enter en el mismo tick del gesto (activación)
      void enterRef.current();
    };

    const opts = { capture: true };
    window.addEventListener("pointerdown", onGesture, opts);
    window.addEventListener("touchstart", onGesture, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", onGesture, opts);
    window.addEventListener("click", onGesture, opts);

    return () => {
      window.removeEventListener("pointerdown", onGesture, opts);
      window.removeEventListener("touchstart", onGesture, {
        capture: true,
      });
      window.removeEventListener("keydown", onGesture, opts);
      window.removeEventListener("click", onGesture, opts);
    };
  }, [embed, persistent, tvRoute]);

  // Tras varios segundos sin FS, dejar de tapar la pantalla (soft-kiosk basta)
  const [promptDismissed, setPromptDismissed] = useState(false);
  useEffect(() => {
    if (embed || isFs || standalone) {
      setPromptDismissed(false);
      return undefined;
    }
    if (!(persistent || wasUnlocked() || tvRoute)) return undefined;
    const id = window.setTimeout(() => setPromptDismissed(true), 14000);
    return () => window.clearTimeout(id);
  }, [embed, isFs, standalone, persistent, tvRoute]);

  const wantsFs = !embed && (persistent || wasUnlocked() || tvRoute);
  const needsPrompt =
    !embed &&
    supported &&
    !isFs &&
    !standalone &&
    wantsFs &&
    !promptDismissed;

  return {
    isFullscreen: isFs,
    supported: embed ? false : supported,
    standalone: embed ? false : standalone,
    persistent: embed ? false : persistent,
    localDev,
    blockedByBrowser,
    enter,
    exit,
    embed,
    needsPrompt,
    /** Tras F5 el navegador suele exigir 1 toque */
    needsUserGesture: needsPrompt && blockedByBrowser,
    allowExit: !embed && !persistent && !standalone && !tvRoute,
  };
}
