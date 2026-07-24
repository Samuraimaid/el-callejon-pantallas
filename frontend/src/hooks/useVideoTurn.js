import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../lib/constants";
import { useWebSocket } from "./useWebSocket";

/**
 * Turno de video 1 TV a la vez (servidor elige y notifica).
 * Las TVs de publicidad solo reproducen video cuando forYou=true.
 */
export function useVideoTurn(tvId, { enabled = true } = {}) {
  const [turn, setTurn] = useState(null);

  const poll = useCallback(async () => {
    if (!tvId || !enabled) return;
    try {
      const res = await fetch(
        `${API_URL}/api/content/video-turn?tv_id=${tvId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.for_you && data.turn) {
        setTurn(data.turn);
      } else {
        setTurn(null);
      }
    } catch {
      /* offline */
    }
  }, [tvId, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    poll();
    const id = window.setInterval(poll, 20000);
    return () => window.clearInterval(id);
  }, [poll, enabled]);

  useWebSocket("pantallas,all", (ev) => {
    if (!enabled || !ev?.t) return;
    if (ev.t === "vidturn") {
      if (Number(ev.tv_id) === Number(tvId)) {
        setTurn({
          tv_id: ev.tv_id,
          video_url: ev.video_url,
          token: ev.token,
        });
      } else {
        setTurn((t) => (t ? null : t));
      }
    }
  });

  const markDone = useCallback(async () => {
    if (!turn) return;
    try {
      await fetch(`${API_URL}/api/content/video-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tv_id: tvId, token: turn.token }),
      });
    } catch {
      /* */
    }
    setTurn(null);
  }, [turn, tvId]);

  return { turn, markDone, hasVideoTurn: !!turn };
}
