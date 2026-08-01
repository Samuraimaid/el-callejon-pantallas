import { useCallback, useEffect, useRef, useState } from "react";
import { WS_BASE } from "../lib/constants";

/**
 * WebSocket ligero — solo pinta eventos del servidor.
 * @param {string} channels  ej. "pantallas" | "admin" | "pantallas,admin"
 * @param {(data: object) => void} onEvent
 */
export function useWebSocket(channels = "all", onEvent) {
  const [status, setStatus] = useState("off");
  const wsRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const retryRef = useRef(0);
  const disabled = !channels || channels === "off" || channels === "none";

  const url = `${WS_BASE}${WS_BASE.includes("?") ? "&" : "?"}ch=${encodeURIComponent(channels || "all")}`;

  const connect = useCallback(() => {
    if (disabled) return;
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setStatus("live");
    };
    ws.onclose = () => {
      setStatus("off");
      const delay = Math.min(4000, 800 + retryRef.current * 600);
      retryRef.current += 1;
      setTimeout(connect, delay);
    };
    ws.onerror = () => setStatus("err");
    ws.onmessage = (ev) => {
      try {
        onEventRef.current?.(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    };
  }, [url, disabled]);

  useEffect(() => {
    if (disabled) {
      setStatus("off");
      return undefined;
    }
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, disabled]);

  return { status, url };
}
