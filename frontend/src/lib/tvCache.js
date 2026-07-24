/**
 * Caché local de cartelería (localStorage + IndexedDB fallback).
 * Las TVs renderizan de forma autónoma; el servidor solo empuja cambios reales.
 */

const LS_PREFIX = "callejon_tv_";
const DB_NAME = "callejon_signage";
const DB_VER = 1;
const STORE = "cache";

function lsKey(k) {
  return LS_PREFIX + k;
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function cacheSet(key, value) {
  try {
    const payload = {
      data: value,
      savedAt: Date.now(),
    };
    localStorage.setItem(lsKey(key), JSON.stringify(payload));
    idbSet(key, payload).catch(() => {});
    return true;
  } catch {
    // quota — intentar solo IDB
    idbSet(key, { data: value, savedAt: Date.now() }).catch(() => {});
    return false;
  }
}

export function cacheGetData(key) {
  const wrap = cacheGet(key);
  return wrap?.data ?? null;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no idb"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheGetAsync(key) {
  const ls = cacheGet(key);
  if (ls) return ls;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export const CACHE_KEYS = {
  menu: "menu_v1",
  campana: (zona) => `campana_${zona}_v1`,
  config: "config_menu_v1",
  control: "control_v1",
  evento: "evento_media_v1",
};
