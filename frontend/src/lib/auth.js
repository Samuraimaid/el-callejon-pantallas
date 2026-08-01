const TOKEN_KEY = "ec_jwt";
const USER_KEY = "ec_user";
const PIN_TOKEN_KEY = "ec_pin_token";

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(PIN_TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPinToken(token) {
  try {
    if (token) sessionStorage.setItem(PIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(PIN_TOKEN_KEY);
  } catch {
    /* */
  }
}

export function getPinToken() {
  try {
    return sessionStorage.getItem(PIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Detecta Smart TV / stick para bloquear acceso al panel de control. */
export function isSmartTvBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  const markers = [
    "smart-tv",
    "smarttv",
    "hbbtv",
    "tizen",
    "webos",
    "web0s",
    "bravia",
    "viera",
    "netcast",
    "googletv",
    "appletv",
    "crkey",
    "aftb",
    "aftm",
    "aftt",
    "fire tv",
    "hisense",
    "philips tv",
    "vidaa",
    "opera tv",
    "tv safari",
    "sraf",
  ];
  return markers.some((m) => ua.includes(m));
}
