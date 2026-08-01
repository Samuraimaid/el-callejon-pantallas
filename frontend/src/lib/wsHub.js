/**
 * Hub WebSocket compartido por página.
 * Varios hooks (runtime, banners, publicidad, menú) reutilizan UNA conexión
 * por conjunto de canales en lugar de abrir N sockets.
 */
import { WS_BASE } from "./constants";

/** @type {Map<string, { ws: WebSocket|null, status: string, listeners: Set<Function>, retry: number, timer: number, refCount: number }>} */
const hubs = new Map();

function normalizeChannels(channels) {
  if (!channels || channels === "off" || channels === "none") return "";
  const parts = String(channels)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  return parts.join(",") || "all";
}

function hubUrl(chKey) {
  return `${WS_BASE}${WS_BASE.includes("?") ? "&" : "?"}ch=${encodeURIComponent(chKey)}`;
}

function getHub(chKey) {
  let h = hubs.get(chKey);
  if (!h) {
    h = {
      ws: null,
      status: "off",
      listeners: new Set(),
      retry: 0,
      timer: 0,
      refCount: 0,
      statusListeners: new Set(),
    };
    hubs.set(chKey, h);
  }
  return h;
}

function setStatus(h, status) {
  h.status = status;
  h.statusListeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      /* */
    }
  });
}

function connectHub(chKey) {
  const h = getHub(chKey);
  if (
    h.ws &&
    (h.ws.readyState === WebSocket.OPEN ||
      h.ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  setStatus(h, "connecting");
  let ws;
  try {
    ws = new WebSocket(hubUrl(chKey));
  } catch {
    setStatus(h, "err");
    scheduleReconnect(chKey);
    return;
  }
  h.ws = ws;
  ws.onopen = () => {
    h.retry = 0;
    setStatus(h, "live");
  };
  ws.onclose = () => {
    h.ws = null;
    setStatus(h, "off");
    if (h.refCount > 0) scheduleReconnect(chKey);
  };
  ws.onerror = () => setStatus(h, "err");
  ws.onmessage = (ev) => {
    let data;
    try {
      data = JSON.parse(ev.data);
    } catch {
      return;
    }
    h.listeners.forEach((fn) => {
      try {
        fn(data);
      } catch {
        /* listener error */
      }
    });
  };
}

function scheduleReconnect(chKey) {
  const h = getHub(chKey);
  window.clearTimeout(h.timer);
  const delay = Math.min(4000, 800 + h.retry * 600);
  h.retry += 1;
  h.timer = window.setTimeout(() => {
    if (h.refCount > 0) connectHub(chKey);
  }, delay);
}

/**
 * Suscribe un listener al hub de canales.
 * @returns {() => void} unsubscribe
 */
export function subscribeWs(channels, onEvent, onStatus) {
  const chKey = normalizeChannels(channels);
  if (!chKey) {
    onStatus?.("off");
    return () => {};
  }
  const h = getHub(chKey);
  h.refCount += 1;
  if (onEvent) h.listeners.add(onEvent);
  if (onStatus) {
    h.statusListeners.add(onStatus);
    onStatus(h.status);
  }
  connectHub(chKey);

  return () => {
    if (onEvent) h.listeners.delete(onEvent);
    if (onStatus) h.statusListeners.delete(onStatus);
    h.refCount = Math.max(0, h.refCount - 1);
    if (h.refCount === 0) {
      window.clearTimeout(h.timer);
      try {
        h.ws?.close();
      } catch {
        /* */
      }
      h.ws = null;
      setStatus(h, "off");
      hubs.delete(chKey);
    }
  };
}

export function getWsHubStatus(channels) {
  const chKey = normalizeChannels(channels);
  if (!chKey) return "off";
  return getHub(chKey).status;
}
