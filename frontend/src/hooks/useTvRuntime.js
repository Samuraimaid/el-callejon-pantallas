import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/constants";
import { CACHE_KEYS, cacheGetData, cacheSet } from "../lib/tvCache";
import { useWebSocket } from "./useWebSocket";

/**
 * Runtime industrial de TV:
 * - cache local (menu/campaña)
 * - heartbeat 4s
 * - escucha ctrl (power/volumen/evento)
 * - reporta snapshot compacto al admin
 */
export function useTvRuntime(tvId, { snapshotBuilder } = {}) {
  const [powerOn, setPowerOn] = useState(true);
  const [volumen, setVolumen] = useState(25);
  const [modoEvento, setModoEvento] = useState(false);
  const [masterPower, setMasterPower] = useState(true);
  const [ctrlReady, setCtrlReady] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const pingStart = useRef(0);
  const audioRef = useRef(null);

  // Audio silencioso para controlar "volumen" HTML5 (gain)
  useEffect(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return undefined;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = (volumen || 0) / 100;
      // oscillator muted path — solo para API volumen si hay media
      gain.connect(ctx.destination);
      audioRef.current = { ctx, gain };
      return () => {
        try {
          ctx.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (audioRef.current?.gain) {
      audioRef.current.gain.gain.value = Math.max(0, Math.min(1, volumen / 100));
    }
    // videos/audio en DOM
    document.querySelectorAll("video, audio").forEach((el) => {
      try {
        el.volume = Math.max(0, Math.min(1, volumen / 100));
        el.muted = volumen <= 0 || !powerOn || !masterPower;
      } catch {
        /* ignore */
      }
    });
  }, [volumen, powerOn, masterPower]);

  // Cargar control cacheado + estado público
  useEffect(() => {
    const cached = cacheGetData(CACHE_KEYS.control);
    if (cached?.tvs?.[String(tvId)]) {
      const t = cached.tvs[String(tvId)];
      setPowerOn(t.power_on !== false);
      setVolumen(Number(t.volumen) ?? 25);
      setModoEvento(!!t.modo_evento);
      setMasterPower(cached.master_power !== false);
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/pantallas/estado/public`);
        if (!res.ok) return;
        const data = await res.json();
        cacheSet(CACHE_KEYS.control, data);
        setMasterPower(data.master_power !== false);
        const p = (data.pantallas || []).find((x) => x.id === tvId);
        if (p) {
          setPowerOn(p.power_on !== false);
          setVolumen(Number(p.volumen) ?? 25);
          setModoEvento(!!p.modo_evento);
        }
      } catch {
        /* offline — cache only */
      } finally {
        setCtrlReady(true);
      }
    })();
  }, [tvId]);

  const onWs = useCallback(
    (ev) => {
      if (!ev?.t) return;
      if (ev.t === "ctrl" && ev.tvs) {
        cacheSet(CACHE_KEYS.control, {
          master_power: ev.master_power,
          tvs: ev.tvs,
        });
        setMasterPower(ev.master_power !== false);
        const t = ev.tvs[String(tvId)];
        if (t) {
          setPowerOn(t.power_on !== false);
          setVolumen(Number(t.volumen) ?? 25);
          setModoEvento(!!t.modo_evento);
        }
      }
    },
    [tvId]
  );

  useWebSocket("pantallas,all", onWs);

  // Heartbeat cada 4s
  useEffect(() => {
    if (!tvId) return undefined;
    let alive = true;

    const beat = async () => {
      if (!alive) return;
      const t0 = performance.now();
      pingStart.current = t0;
      let snap = {};
      try {
        snap = snapshotBuilder?.() || {};
      } catch (e) {
        snap = { err: String(e?.message || e) };
      }
      const body = {
        latencia_ms: undefined,
        snapshot: {
          ...snap,
          path: window.location.pathname,
          power_on: powerOn && masterPower,
          volumen,
          modo_evento: modoEvento,
          ts: Date.now(),
        },
        error_msg: renderError || undefined,
        clear_error: !renderError,
      };
      try {
        const tSend = performance.now();
        const res = await fetch(`${API_URL}/api/pantallas/${tvId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            latencia_ms: Math.round(performance.now() - tSend),
          }),
        });
        if (!res.ok) throw new Error(`HB ${res.status}`);
      } catch {
        /* TV sigue con cache */
      }
    };

    beat();
    const id = window.setInterval(beat, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [
    tvId,
    powerOn,
    masterPower,
    volumen,
    modoEvento,
    renderError,
    snapshotBuilder,
  ]);

  // Captura errores de render
  useEffect(() => {
    const onErr = (ev) => {
      setRenderError(String(ev?.message || "Error de visualización"));
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", (ev) => {
      setRenderError(String(ev?.reason?.message || ev?.reason || "Promise error"));
    });
    return () => window.removeEventListener("error", onErr);
  }, []);

  const displayOn = powerOn && masterPower;

  return {
    powerOn: displayOn,
    volumen,
    modoEvento,
    masterPower,
    ctrlReady,
    renderError,
    setRenderError,
    standby: !displayOn,
  };
}
