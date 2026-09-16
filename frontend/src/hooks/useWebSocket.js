import { useEffect, useRef, useState } from "react";
import { subscribeWs } from "../lib/wsHub";
import { recordWsLog } from "../lib/diagnostics";

/**
 * WebSocket ligero — reutiliza una conexión compartida por canales
 * (varias pantallas/hooks en la misma TV = 1 socket).
 *
 * @param {string} channels  ej. "pantallas" | "admin" | "pantallas,all"
 * @param {(data: object) => void} onEvent
 */
export function useWebSocket(channels = "all", onEvent) {
  const [status, setStatus] = useState("off");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const disabled = !channels || channels === "off" || channels === "none";

  useEffect(() => {
    if (disabled) {
      setStatus("off");
      return undefined;
    }
    const unsub = subscribeWs(
      channels,
      (data) => {
        try {
          recordWsLog(data);
          onEventRef.current?.(data);
        } catch (err) {
          console.error("[useWebSocket] Error en manejador de evento:", err);
        }
      },
      setStatus
    );
    return unsub;
  }, [channels, disabled]);

  return { status };
}
