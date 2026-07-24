/**
 * Caché de medios en IndexedDB (blobs) + manifiesto por TV.
 * Reutiliza contenido entre reinicios si la versión del servidor no cambió.
 */

const DB_NAME = "callejon_media";
const DB_VER = 1;
const STORE_BLOBS = "blobs";
const STORE_META = "meta";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no idb"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store, key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDel(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export function mediaKey(url) {
  return String(url || "").split("?")[0];
}

export async function getManifestMeta(tvId) {
  try {
    return await idbGet(STORE_META, `manifest_tv_${tvId}`);
  } catch {
    return null;
  }
}

export async function setManifestMeta(tvId, meta) {
  try {
    await idbPut(STORE_META, `manifest_tv_${tvId}`, {
      ...meta,
      savedAt: Date.now(),
    });
  } catch {
    /* quota */
  }
}

export async function hasBlob(url) {
  try {
    const row = await idbGet(STORE_BLOBS, mediaKey(url));
    return !!(row && row.blob);
  } catch {
    return false;
  }
}

export async function getBlob(url) {
  try {
    const row = await idbGet(STORE_BLOBS, mediaKey(url));
    return row?.blob || null;
  } catch {
    return null;
  }
}

/** Object URL reutilizable; el caller puede revocarlo al desmontar si quiere */
const objectUrlMemo = new Map();

export async function resolveLocalUrl(url) {
  if (!url) return url;
  const key = mediaKey(url);
  if (objectUrlMemo.has(key)) return objectUrlMemo.get(key);
  const blob = await getBlob(url);
  if (!blob) return url;
  const obj = URL.createObjectURL(blob);
  objectUrlMemo.set(key, obj);
  return obj;
}

export async function putBlob(url, blob, etag = "") {
  await idbPut(STORE_BLOBS, mediaKey(url), {
    blob,
    etag,
    bytes: blob.size,
    savedAt: Date.now(),
  });
}

/**
 * Descarga un asset y lo guarda. Retorna bytes descargados.
 */
export async function downloadAndCache(url, { etag = "", onProgress } = {}) {
  const key = mediaKey(url);
  const existing = await idbGet(STORE_BLOBS, key);
  if (existing?.blob && (!etag || existing.etag === etag)) {
    onProgress?.(1, 1);
    return { cached: true, bytes: existing.blob.size };
  }

  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);

  const total = Number(res.headers.get("Content-Length") || 0);
  // Streaming read if body available
  if (res.body && total > 0 && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress?.(received, total);
    }
    const blob = new Blob(chunks, {
      type: res.headers.get("Content-Type") || "application/octet-stream",
    });
    await putBlob(url, blob, etag);
    objectUrlMemo.delete(key);
    return { cached: false, bytes: blob.size };
  }

  const blob = await res.blob();
  onProgress?.(blob.size, blob.size);
  await putBlob(url, blob, etag);
  objectUrlMemo.delete(key);
  return { cached: false, bytes: blob.size };
}

export async function estimateCacheBytes(urls) {
  let n = 0;
  for (const u of urls) {
    try {
      const row = await idbGet(STORE_BLOBS, mediaKey(u));
      if (row?.bytes) n += row.bytes;
    } catch {
      /* */
    }
  }
  return n;
}

/**
 * Purga blobs que no están en keepUrls (hasta liberar espacio).
 */
export async function purgeExcept(keepUrls) {
  const keep = new Set((keepUrls || []).map(mediaKey));
  try {
    const db = await openDb();
    const keys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, "readonly");
      const req = tx.objectStore(STORE_BLOBS).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const k of keys) {
      if (!keep.has(k)) {
        await idbDel(STORE_BLOBS, k);
        if (objectUrlMemo.has(k)) {
          try {
            URL.revokeObjectURL(objectUrlMemo.get(k));
          } catch {
            /* */
          }
          objectUrlMemo.delete(k);
        }
      }
    }
  } catch {
    /* */
  }
}
