import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../lib/constants";
import { useWebSocket } from "./useWebSocket";

export const AMBIENT_UI_DEFAULTS = {
  now_playing_show_ms: 5000,
  now_playing_max_elapsed_s: 12,
  now_playing_enabled: true,
  mensajes_duracion_ms: 9000,
  banner_marquee_enabled: true,
  banner_marquee_speed_px_s: 42,
  pause_on_event: true,
  /** Musica al iniciar el PC/servidor (default: no) */
  autoplay_on_boot: false,
  /** TVs #3–#6: imagenes fijas sin efectos de transicion */
  publicidad_lite_mode: false,
};

/**
 * Config de banners del modo ambiente desde /api/ambient/config|status.
 * Se actualiza por WebSocket (ambient_cfg).
 */
export function useAmbientUiConfig() {
  const [cfg, setCfg] = useState(AMBIENT_UI_DEFAULTS);

  const apply = useCallback((raw) => {
    if (!raw || typeof raw !== "object") return;
    const src = raw.config || raw.ui || raw;
    setCfg((prev) => ({
      ...prev,
      ...AMBIENT_UI_DEFAULTS,
      ...Object.fromEntries(
        Object.keys(AMBIENT_UI_DEFAULTS).map((k) => [
          k,
          src[k] !== undefined && src[k] !== null ? src[k] : prev[k],
        ])
      ),
    }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/ambient/config`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      apply(await res.json());
    } catch {
      /* offline */
    }
  }, [apply]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWebSocket("pantallas,all", (ev) => {
    if (ev?.t === "ambient_cfg" && ev.config) apply(ev.config);
  });

  return { cfg, refresh, apply };
}
