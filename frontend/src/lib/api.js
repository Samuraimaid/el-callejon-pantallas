import { API_URL } from "./constants";
import { clearSession, getToken } from "./auth";

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearSession();
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = (await res.text()) || detail;
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/health"),
  pinStatus: () => request("/api/auth/pin/status"),
  /** Login solo PIN -> JWT */
  pinLogin: (pin) =>
    request("/api/auth/pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  pinChange: (old_pin, new_pin) =>
    request("/api/auth/pin/change", {
      method: "POST",
      body: JSON.stringify({ old_pin, new_pin }),
    }),
  /** Compat */
  login: (usuario, password, pin) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        pin: pin || password,
        usuario,
        password,
      }),
    }),
  me: () => request("/api/auth/me"),

  // —— Menú del día (TVs 50" + Centro de Control) ——
  menu: () => request("/api/productos/menu"),
  sincronizarPantallas: () => request("/api/productos/sincronizar", { method: "POST" }),
  productos: (opts = {}) => {
    const q = new URLSearchParams();
    if (opts.tipo) q.set("tipo", opts.tipo);
    if (opts.solo_activos === false) q.set("solo_activos", "false");
    if (opts.compact) q.set("compact", "true");
    const s = q.toString();
    return request(`/api/productos${s ? `?${s}` : ""}`);
  },
  patchProducto: (id, body) =>
    request(`/api/productos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  createProducto: (body) =>
    request("/api/productos", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteProducto: (id) =>
    request(`/api/productos/${id}`, { method: "DELETE" }),
  uploadProductoImagen: async (
    id,
    blob,
    filename = "crop.jpg",
    { cardBlob = null, removeBg = false } = {}
  ) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", blob, filename);
    if (cardBlob) {
      const cardName = String(filename).replace(/\.jpe?g$/i, "") + "-card.jpg";
      fd.append("file_card", cardBlob, cardName);
    }
    fd.append("remove_bg", removeBg ? "true" : "false");
    const res = await fetch(`${API_URL}/api/productos/${id}/imagen`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (res.status === 401) clearSession();
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || JSON.stringify(body);
      } catch {
        detail = (await res.text()) || detail;
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return res.json();
  },

  // —— Config menú board (TV #1 / #2) ——
  getMenuBoardConfig: () => request("/api/config/menu-board"),
  putMenuBoardConfig: (body) =>
    request("/api/config/menu-board", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // —— Pantallas: telemetría + control ——
  getPantallasEstado: () => request("/api/pantallas/estado"),
  controlPantallas: (body) =>
    request("/api/pantallas/control", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getEventoSchedule: () => request("/api/pantallas/evento/schedule"),
  putEventoSchedule: (body) =>
    request("/api/pantallas/evento/schedule", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getEventoPlantillas: () => request("/api/pantallas/evento/plantillas"),
  getEventoPlantillaActiva: () =>
    request("/api/pantallas/evento/plantillas/activa"),
  aplicarEventoPlantilla: (body) =>
    request("/api/pantallas/evento/plantillas/aplicar", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  clearEventoPlantilla: () =>
    request("/api/pantallas/evento/plantillas/activa", { method: "DELETE" }),
  uploadEventoMedia: async (file, titulo = "") => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("titulo", titulo || file.name || "Evento");
    const res = await fetch(`${API_URL}/api/pantallas/evento/media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (res.status === 401) clearSession();
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || JSON.stringify(body);
      } catch {
        detail = (await res.text()) || detail;
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return res.json();
  },

  // —— Publicidad por zona (Barra / VIP) ——
  getPublicidad: (zona) => request(`/api/publicidad/${zona}`),
  putPublicidad: (zona, body) =>
    request(`/api/publicidad/${zona}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  uploadPublicidadSlide: async (
    zona,
    blobOrFile,
    {
      texto_principal = "",
      texto_secundario = "",
      animacion_texto = "fade-in-up",
      tamano_texto = "mediano",
      filename = "slide.jpg",
    } = {}
  ) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", blobOrFile, filename);
    fd.append("texto_principal", texto_principal);
    fd.append("texto_secundario", texto_secundario);
    fd.append("animacion_texto", animacion_texto);
    fd.append("tamano_texto", tamano_texto);
    const res = await fetch(`${API_URL}/api/publicidad/${zona}/subir-slide`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (res.status === 401) clearSession();
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || JSON.stringify(body);
      } catch {
        detail = (await res.text()) || detail;
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return res.json();
  },

  getPerfiles: () => request("/api/publicidad/perfiles"),
  getPerfil: (clave) => request(`/api/publicidad/perfiles/${clave}`),
  putPerfil: (clave, body) =>
    request(`/api/publicidad/perfiles/${clave}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  applyPerfil: (clave, body) =>
    request(`/api/publicidad/perfiles/${clave}/aplicar`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createPerfil: (body) =>
    request("/api/publicidad/perfiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  repairEncoding: () =>
    request("/api/publicidad/repair-encoding", { method: "POST" }),
  getVideoBatch: (batchId) =>
    request(`/api/publicidad/videos/batch/${batchId}`),
  listVideoBatches: () => request("/api/publicidad/videos/jobs"),
  getContentResources: () => request("/api/content/resources"),
  getContentStatus: () => request("/api/content/status"),

  // —— Música ambiente (host Winamp-like → amplificador) ——
  ambientStatus: () => request("/api/ambient/status"),
  ambientConfig: () => request("/api/ambient/config"),
  ambientConfigUpdate: (body) =>
    request("/api/ambient/config", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  /** Autoplay al iniciar el sistema (default false) */
  ambientBootAutoplay: () => request("/api/ambient/boot-autoplay"),
  ambientBootAutoplaySet: (autoplay_on_boot) =>
    request("/api/ambient/boot-autoplay", {
      method: "PUT",
      body: JSON.stringify({ autoplay_on_boot: !!autoplay_on_boot }),
    }),
  /** Modo lite TV #3–#6 (imagenes fijas sin efectos) */
  publicidadLite: () => request("/api/ambient/publicidad-lite"),
  publicidadLiteSet: (lite) =>
    request("/api/ambient/publicidad-lite", {
      method: "PUT",
      body: JSON.stringify({ publicidad_lite_mode: !!lite, lite_mode: !!lite }),
    }),
  ambientLibrary: (folder) =>
    request(
      `/api/ambient/library${folder ? `?folder=${encodeURIComponent(folder)}` : ""}`
    ),
  ambientPlay: (body = {}) =>
    request("/api/ambient/play", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  ambientPause: () => request("/api/ambient/pause", { method: "POST", body: "{}" }),
  ambientResume: () =>
    request("/api/ambient/resume", { method: "POST", body: "{}" }),
  ambientStop: () => request("/api/ambient/stop", { method: "POST", body: "{}" }),
  ambientNext: () => request("/api/ambient/next", { method: "POST", body: "{}" }),
  ambientPrev: () => request("/api/ambient/prev", { method: "POST", body: "{}" }),
  ambientShuffle: (on) =>
    request("/api/ambient/shuffle", {
      method: "POST",
      body: JSON.stringify({ on }),
    }),
  ambientVolume: (volume) =>
    request("/api/ambient/volume", {
      method: "POST",
      body: JSON.stringify({ volume }),
    }),
  ambientPauseOnEvent: (on) =>
    request("/api/ambient/pause-on-event", {
      method: "POST",
      body: JSON.stringify({ on }),
    }),
  ambientScan: () =>
    request("/api/ambient/scan", { method: "POST", body: "{}" }),
  ambientNormalize: (force = false) =>
    request("/api/ambient/normalize", {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
  ambientMode: (mode, folder) =>
    request("/api/ambient/mode", {
      method: "POST",
      body: JSON.stringify({
        mode,
        folder: folder === undefined ? undefined : folder,
      }),
    }),
  ambientLike: (rel, liked) =>
    request("/api/ambient/like", {
      method: "POST",
      body: JSON.stringify({ rel, liked }),
    }),
  ambientPlaylists: () => request("/api/ambient/playlists"),
  ambientPlaylistCreate: (name) =>
    request("/api/ambient/playlist/create", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  ambientPlaylistDelete: (name) =>
    request("/api/ambient/playlist/delete", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  ambientPlaylistAdd: (name, rel) =>
    request("/api/ambient/playlist/add", {
      method: "POST",
      body: JSON.stringify({ name, rel }),
    }),
  ambientPlaylistRemove: (name, rel) =>
    request("/api/ambient/playlist/remove", {
      method: "POST",
      body: JSON.stringify({ name, rel }),
    }),
  ambientPlaylistPlay: (name, shuffle = true) =>
    request("/api/ambient/playlist/play", {
      method: "POST",
      body: JSON.stringify({ name, shuffle }),
    }),
  ambientBroadcast: () =>
    request("/api/ambient/broadcast", { method: "POST", body: "{}" }),

  // —— Respaldos automáticos ——
  backupConfig: () => request("/api/backup/config"),
  backupConfigUpdate: (body) =>
    request("/api/backup/config", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  backupStatus: () => request("/api/backup/status"),
  backupHistory: (limit = 20) =>
    request(`/api/backup/history?limit=${limit}`),
  backupRun: (body = {}) =>
    request("/api/backup/run", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  backupRunContent: () =>
    request("/api/backup/run/content", { method: "POST", body: "{}" }),
  backupRunFull: () =>
    request("/api/backup/run/full", { method: "POST", body: "{}" }),
  backupRunMigrate: () =>
    request("/api/backup/run/migrate", { method: "POST", body: "{}" }),

  uploadVideosMulti: async (
    files,
    { zonas = ["TV3"], perfil = "restaurante_diario", append = true, modo_evento = "" } = {}
  ) => {
    const token = getToken();
    const fd = new FormData();
    for (const f of files) {
      fd.append("files", f, f.name || "video.mp4");
    }
    fd.append("zonas", Array.isArray(zonas) ? zonas.join(",") : String(zonas));
    fd.append("perfil", perfil);
    fd.append("append", append ? "true" : "false");
    if (modo_evento !== "" && modo_evento != null) {
      fd.append("modo_evento", modo_evento ? "true" : "false");
    }
    const res = await fetch(`${API_URL}/api/publicidad/videos/multi`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (res.status === 401) clearSession();
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || JSON.stringify(body);
      } catch {
        detail = (await res.text()) || detail;
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return res.json();
  },
};

export { API_URL };
