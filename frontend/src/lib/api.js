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
  login: (usuario, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ usuario, password }),
    }),
  me: () => request("/api/auth/me"),

  // —— Menú del día (TVs 50" + Centro de Control) ——
  menu: () => request("/api/productos/menu"),
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
  uploadProductoImagen: async (id, blob, filename = "crop.jpg") => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", blob, filename);
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

  // —— Publicidad por zona (Barra / VIP) ——
  getPublicidad: (zona) => request(`/api/publicidad/${zona}`),
  putPublicidad: (zona, body) =>
    request(`/api/publicidad/${zona}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  uploadPublicidadSlide: async (
    zona,
    blob,
    { texto_principal = "", texto_secundario = "" } = {}
  ) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", blob, "slide.jpg");
    fd.append("texto_principal", texto_principal);
    fd.append("texto_secundario", texto_secundario);
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

};

export { API_URL };
