import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useArrowScroll } from "../hooks/useArrowScroll";
import { api } from "../lib/api";
import {
  fallbackImageForProduct,
  formatC,
  imageForProduct,
} from "../lib/constants";
import ImageCropUploadModal from "./ImageCropUploadModal";

const GROUPS = [
  { id: "plato_preestablecido", label: "Platillos", icon: "🍽️" },
  { id: "extra", label: "Extras", icon: "➕" },
  { id: "bebida_jugo", label: "Jugos", icon: "🧃" },
  { id: "bebida_soda", label: "Bebidas", icon: "🥤" },
  { id: "cafe", label: "Cafés", icon: "☕" },
  { id: "licor", label: "Licores", icon: "🍸" },
];

const DELETE_DOUBLE_MS = 900;

/** 0=dom … 6=sáb (igual que promos y Date.getDay()) */
const DAYS = [
  { v: 0, l: "Do" },
  { v: 1, l: "Lu" },
  { v: 2, l: "Ma" },
  { v: 3, l: "Mi" },
  { v: 4, l: "Ju" },
  { v: 5, l: "Vi" },
  { v: 6, l: "Sa" },
];

function normalizeDias(raw) {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = [];
  for (const d of raw) {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6 && !out.includes(n))
      out.push(n);
  }
  out.sort((a, b) => a - b);
  return out.length ? out : null;
}

function diasKey(dias) {
  const n = normalizeDias(dias);
  return n == null ? "all" : n.join(",");
}

function toDraft(p) {
  const nombre = p.nombre || p.n || "";
  const ilimitado = p.es_ilimitado === true || p.inf === 1 || p.inf === true;
  const destacado = p.destacado === true || p.dst === 1 || p.dst === true;
  const numRaw = p.numero_combo ?? p.num;
  const numero_combo =
    numRaw === null || numRaw === undefined || numRaw === ""
      ? ""
      : Number(numRaw);
  const dias_semana = normalizeDias(p.dias_semana ?? p.dias);
  const imgVersion = p.imgV || p.v || Date.now();
  return {
    id: p.id,
    codigo: p.codigo || p.c,
    nombre,
    tipo: p.tipo || p.tp,
    stock: Number(p.stock_disponible ?? p.s ?? 0),
    precio: Number(p.precio_unitario ?? p.pr ?? 0),
    activo: p.activo === true || p.activo === 1 || p.a === 1 || p.a === true,
    es_ilimitado: ilimitado,
    destacado,
    numero_combo,
    dias_semana,
    imgV: imgVersion,
    _nombre: nombre,
    _stock: Number(p.stock_disponible ?? p.s ?? 0),
    _precio: Number(p.precio_unitario ?? p.pr ?? 0),
    _activo: p.activo === true || p.activo === 1 || p.a === 1 || p.a === true,
    _es_ilimitado: ilimitado,
    _destacado: destacado,
    _numero_combo: numero_combo,
    _dias_semana: dias_semana,
  };
}

function isDirty(row) {
  return (
    String(row.nombre || "").trim() !== String(row._nombre || "").trim() ||
    Number(row.stock) !== Number(row._stock) ||
    Number(row.precio) !== Number(row._precio) ||
    Boolean(row.activo) !== Boolean(row._activo) ||
    Boolean(row.es_ilimitado) !== Boolean(row._es_ilimitado) ||
    Boolean(row.destacado) !== Boolean(row._destacado) ||
    String(row.numero_combo ?? "") !== String(row._numero_combo ?? "") ||
    diasKey(row.dias_semana) !== diasKey(row._dias_semana)
  );
}

const emptyCreateForm = () => ({
  nombre: "",
  precio: "0.00",
  stock: 0,
  activo: true,
  es_ilimitado: false,
  destacado: false,
  numero_combo: "",
  dias_semana: null,
});

/**
 * Gestión del menú del día: CRUD + stock ilimitado + foto rembg + WS TVs.
 */
export default function GestionarMenuPanel({
  embedded = false,
  open = true,
  onClose,
  onSaved,
}) {
  const [tab, setTab] = useState("plato_preestablecido");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [photoProduct, setPhotoProduct] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  // Doble tap de seguridad: id armado + timeout
  const [deleteArmedId, setDeleteArmedId] = useState(null);
  const deleteTimerRef = useRef(null);

  const scroll = useArrowScroll(embedded || open);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await api.productos({ solo_activos: false });
      setRows((list || []).map(toDraft));
      setEditingNameId(null);
      setDeleteArmedId(null);
    } catch (e) {
      setErr(e.message || "No se pudo cargar el menú");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (embedded || open) {
      setMsg("");
      setErr("");
      load();
    }
  }, [embedded, open, load]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => r.tipo === tab),
    [rows, tab],
  );

  const dirtyCount = useMemo(() => rows.filter(isDirty).length, [rows]);
  const groupMeta = GROUPS.find((g) => g.id === tab) || GROUPS[0];

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    const dirty = rows.filter(isDirty);
    if (!dirty.length) {
      setSaving(true);
      try {
        await api.sincronizarPantallas();
        setMsg("¡Pantallas avisadas y sincronizadas en tiempo real!");
      } catch (e) {
        setMsg("Pantallas avisadas.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    setErr("");
    setMsg("");
    let ok = 0;
    const errors = [];
    try {
      for (const row of dirty) {
        try {
          const body = {
            precio_unitario: Math.max(0, Number(row.precio) || 0),
            activo: Boolean(row.activo),
            es_ilimitado: Boolean(row.es_ilimitado),
            destacado: Boolean(row.destacado),
          };
          if (!row.es_ilimitado) {
            body.stock_disponible = Math.max(0, parseInt(row.stock, 10) || 0);
          }
          const nombre = String(row.nombre || "").trim();
          if (nombre && nombre !== String(row._nombre || "").trim()) {
            body.nombre = nombre;
          }
          const numStr = String(row.numero_combo ?? "").trim();
          const prevNum = String(row._numero_combo ?? "").trim();
          if (numStr !== prevNum) {
            if (!numStr) {
              body.clear_numero_combo = true;
            } else {
              const n = parseInt(numStr, 10);
              if (n >= 1 && n <= 12) body.numero_combo = n;
            }
          }
          if (diasKey(row.dias_semana) !== diasKey(row._dias_semana)) {
            const d = normalizeDias(row.dias_semana);
            if (d == null) {
              body.clear_dias_semana = true;
              body.dias_semana = null;
            } else {
              body.dias_semana = d;
            }
          }
          await api.patchProducto(row.id, body);
          ok += 1;
        } catch (e) {
          errors.push(`${row.codigo}: ${e.message}`);
        }
      }
      if (ok) {
        setMsg(
          `Guardado: ${ok} producto(s). TVs de menú 50″ actualizadas al instante.`,
        );
        setEditingNameId(null);
        await load();
        onSaved?.();
      }
      if (errors.length) setErr(errors.slice(0, 3).join(" · "));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    const nombre = String(createForm.nombre || "").trim();
    if (!nombre) {
      setErr("Escribe el nombre del producto");
      return;
    }
    setCreating(true);
    setErr("");
    setMsg("");
    try {
      const payload = {
        nombre,
        categoria: tab,
        tipo: tab,
        precio_unitario: Math.max(0, Number(createForm.precio) || 0),
        stock_disponible: createForm.es_ilimitado
          ? 0
          : Math.max(0, parseInt(createForm.stock, 10) || 0),
        es_ilimitado: Boolean(createForm.es_ilimitado),
        destacado: Boolean(createForm.destacado),
        activo: Boolean(createForm.activo),
      };
      const nCombo = parseInt(createForm.numero_combo, 10);
      if (nCombo >= 1 && nCombo <= 12) payload.numero_combo = nCombo;
      const dCreate = normalizeDias(createForm.dias_semana);
      if (dCreate != null) payload.dias_semana = dCreate;
      const created = await api.createProducto(payload);
      setShowCreate(false);
      setCreateForm(emptyCreateForm());
      setMsg(
        `Creado ${created.codigo} · ${created.nombre}. Ya puedes subir su foto 📷`,
      );
      await load();
      onSaved?.();
      setPhotoProduct(toDraft(created));
    } catch (ex) {
      setErr(ex.message || "No se pudo crear el producto");
    } finally {
      setCreating(false);
    }
  }

  async function executeDelete(row) {
    setDeletingId(row.id);
    setErr("");
    setMsg("");
    try {
      await api.deleteProducto(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setMsg(`Eliminado ${row.codigo}. Pantallas actualizadas.`);
      onSaved?.();
    } catch (ex) {
      setErr(ex.message || "No se pudo eliminar");
    } finally {
      setDeletingId(null);
      setDeleteArmedId(null);
    }
  }

  /** Doble tap/click rápido (≤900 ms) para confirmar borrado. */
  function handleDeleteTap(row) {
    if (deletingId) return;

    if (deleteArmedId === row.id) {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
      setDeleteArmedId(null);
      executeDelete(row);
      return;
    }

    // Primer tap: armar
    if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    setDeleteArmedId(row.id);
    setMsg(
      `⚠️ Segundo toque en 🗑️ de «${row.nombre}» para eliminar permanentemente`,
    );
    deleteTimerRef.current = window.setTimeout(() => {
      setDeleteArmedId(null);
      setMsg("");
      deleteTimerRef.current = null;
    }, DELETE_DOUBLE_MS);
  }

  function handleImageUploaded(result) {
    const newV = result.v || result.version || Date.now();
    setMsg(`Foto de ${result.nombre || result.codigo} actualizada y enviada a las TVs.`);
    setRows((prev) =>
      prev.map((r) => {
        if (r.codigo === result.codigo || r.id === result.id) {
          const heroUrl = imageForProduct(r.codigo, r.tipo, newV);
          const cardUrl = imageForProductCard(r.codigo, r.tipo, newV);
          return {
            ...r,
            imgV: newV,
            img: heroUrl,
            imgCard: cardUrl,
          };
        }
        return r;
      }),
    );
    onSaved?.();
  }

  if (!embedded && !open) return null;

  const body = (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col"
          : "flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-600 bg-stone-950 shadow-2xl"
      }
    >
      {!embedded && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-700 bg-stone-900 px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-amber-100">Menú del Día</h2>
            <p className="text-xs text-stone-400">
              Crear · ilimitado · eliminar · fotos → pantallas 50″
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-stone-200"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-stone-800 bg-stone-950/50 p-2">
        {GROUPS.map((g) => {
          const count = rows.filter((r) => r.tipo === g.id).length;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setTab(g.id);
                setEditingNameId(null);
                setDeleteArmedId(null);
              }}
              className={`tap shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${
                tab === g.id
                  ? "bg-amber-600 text-stone-950"
                  : "bg-stone-800 text-stone-300"
              }`}
            >
              {g.icon} {g.label}
              {count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <div
        ref={scroll.ref}
        tabIndex={scroll.tabIndex}
        onKeyDown={scroll.onKeyDown}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 ${scroll.className}`}
        data-control-scroll="menu"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-stone-400">
            {groupMeta.icon} {groupMeta.label} · {filtered.length} en catálogo
          </p>
          <button
            type="button"
            onClick={() => {
              setCreateForm(emptyCreateForm());
              setShowCreate(true);
              setErr("");
            }}
            className="tap rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg"
          >
            ➕ Agregar Nuevo Producto
          </button>
        </div>

        {loading && (
          <p className="py-12 text-center text-stone-500">Cargando catálogo…</p>
        )}
        {!loading && !filtered.length && (
          <p className="py-12 text-center text-stone-500">
            Sin productos en esta categoría · usa ➕ Agregar Nuevo Producto
          </p>
        )}
        <ul className="space-y-2">
          {filtered.map((row) => {
            const dirty = isDirty(row);
            const thumb = row.img || imageForProduct(row.codigo, row.tipo, row.imgV);
            const editing = editingNameId === row.id;
            const armed = deleteArmedId === row.id;
            return (
              <li
                key={row.id}
                className={`grid grid-cols-12 items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  armed
                    ? "border-rose-500 bg-rose-950/40 ring-1 ring-rose-500/50"
                    : dirty
                      ? "border-amber-600/50 bg-amber-950/20"
                      : "border-stone-800 bg-stone-900/70"
                }`}
              >
                <div className="col-span-12 flex items-center gap-2 lg:col-span-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-stone-600">
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = fallbackImageForProduct(
                          row.codigo,
                          row.tipo,
                        );
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    title="Subir / recortar foto 1:1"
                    onClick={() => setPhotoProduct(row)}
                    className="tap flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-xl hover:bg-amber-700/80"
                  >
                    📷
                  </button>
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <input
                        autoFocus
                        type="text"
                        value={row.nombre}
                        maxLength={160}
                        onChange={(e) =>
                          updateRow(row.id, { nombre: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setEditingNameId(null);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            updateRow(row.id, { nombre: row._nombre });
                            setEditingNameId(null);
                          }
                        }}
                        onBlur={() => setEditingNameId(null)}
                        className="tap w-full rounded-lg border border-amber-500 bg-stone-950 px-2 py-1.5 text-sm font-semibold text-ivory outline-none"
                      />
                    ) : (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate font-semibold text-stone-100">
                          {row.nombre || "—"}
                        </p>
                        <button
                          type="button"
                          title="Editar nombre"
                          onClick={() => setEditingNameId(row.id)}
                          className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-sm text-amber-200 hover:bg-amber-700/70"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-stone-500">
                      <code className="text-amber-600/90">{row.codigo}</code>
                      {row.es_ilimitado ? " · ∞" : ""}
                      {dirty ? " · sin guardar" : ""}
                    </p>
                  </div>
                </div>

                {/* Stock + ilimitado */}
                <div className="col-span-6 flex flex-col gap-1 sm:col-span-3 lg:col-span-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-stone-500">
                      Stock
                    </span>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-sky-300">
                      <input
                        type="checkbox"
                        checked={!!row.es_ilimitado}
                        onChange={(e) =>
                          updateRow(row.id, {
                            es_ilimitado: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-sky-500"
                      />
                      ♾️ Ilimitado
                    </label>
                  </div>
                  {row.es_ilimitado ? (
                    <div className="flex h-[42px] items-center justify-center rounded-lg border border-sky-700/50 bg-sky-950/40 text-sm font-bold text-sky-300">
                      ∞ Sin límite
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.stock}
                      onChange={(e) =>
                        updateRow(row.id, {
                          stock:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      className="tap w-full rounded-lg border border-stone-600 bg-stone-950 px-2 py-2 text-center text-base font-semibold text-ivory outline-none focus:border-amber-500"
                    />
                  )}
                </div>

                <label className="col-span-3 sm:col-span-2 lg:col-span-2">
                  <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-stone-500">
                    Precio C$
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.precio}
                    onChange={(e) =>
                      updateRow(row.id, {
                        precio:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="tap w-full rounded-lg border border-stone-600 bg-stone-950 px-2 py-2 text-center text-base font-semibold text-ivory outline-none focus:border-amber-500"
                  />
                  <span className="mt-0.5 block text-center text-[10px] text-stone-500">
                    {formatC(row.precio)}
                  </span>
                </label>

                <div className="col-span-4 flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-amber-200">
                    <input
                      type="checkbox"
                      checked={!!row.destacado}
                      onChange={(e) =>
                        updateRow(row.id, { destacado: e.target.checked })
                      }
                      className="h-4 w-4 accent-amber-500"
                    />
                    ⭐ Destacado
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] uppercase text-stone-500">
                      Nº combo
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      placeholder="—"
                      value={row.numero_combo}
                      onChange={(e) =>
                        updateRow(row.id, {
                          numero_combo:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      className="tap w-full rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-center text-sm font-bold text-gold outline-none focus:border-amber-500"
                    />
                  </label>
                </div>

                <div className="col-span-2 flex flex-col items-center sm:col-span-1 lg:col-span-1">
                  <span className="mb-0.5 text-[10px] uppercase tracking-wide text-stone-500">
                    TV
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.activo}
                    onClick={() => updateRow(row.id, { activo: !row.activo })}
                    className={`tap relative h-10 w-14 rounded-full transition ${
                      row.activo ? "bg-emerald-600" : "bg-stone-600"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${
                        row.activo ? "left-5" : "left-1"
                      }`}
                    />
                  </button>
                  <span
                    className={`mt-0.5 text-[10px] font-bold uppercase ${
                      row.activo ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {row.activo ? "On" : "Off"}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-end sm:col-span-1 lg:col-span-1">
                  <button
                    type="button"
                    title={
                      armed
                        ? "Toca de nuevo para confirmar borrado"
                        : "Doble toque para eliminar"
                    }
                    disabled={deletingId === row.id}
                    onClick={() => handleDeleteTap(row)}
                    className={`tap flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border text-lg disabled:opacity-40 ${
                      armed
                        ? "animate-pulse border-rose-400 bg-rose-600 text-white"
                        : "border-rose-800/60 bg-rose-950/50 text-rose-300 hover:bg-rose-800/60"
                    }`}
                  >
                    {deletingId === row.id ? "…" : armed ? "✓?" : "🗑️"}
                  </button>
                </div>

                {/* Dias de la semana en pantallas (null = todos) */}
                <div className="col-span-12 mt-1 border-t border-stone-800/80 pt-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] uppercase tracking-wide text-stone-500">
                      Días en TV
                    </span>
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { dias_semana: null })}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.dias_semana == null
                          ? "bg-amber-500/30 text-amber-100"
                          : "bg-stone-800 text-cream/60"
                      }`}
                    >
                      Todos
                    </button>
                    {DAYS.map((d) => {
                      const sel =
                        Array.isArray(row.dias_semana) &&
                        row.dias_semana.includes(d.v);
                      return (
                        <button
                          key={d.v}
                          type="button"
                          onClick={() => {
                            const cur = Array.isArray(row.dias_semana)
                              ? [...row.dias_semana]
                              : null;
                            if (cur == null) {
                              updateRow(row.id, { dias_semana: [d.v] });
                              return;
                            }
                            const has = cur.includes(d.v);
                            const next = has
                              ? cur.filter((x) => x !== d.v)
                              : [...cur, d.v].sort((a, b) => a - b);
                            updateRow(row.id, {
                              dias_semana: next.length ? next : null,
                            });
                          }}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            sel
                              ? "bg-emerald-600/40 text-emerald-100"
                              : "bg-stone-800 text-cream/55"
                          }`}
                        >
                          {d.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shrink-0 space-y-2 border-t border-stone-700 bg-stone-900/90 px-4 py-3">
        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.startsWith("⚠️")
                ? "bg-amber-950/60 text-amber-200"
                : "bg-emerald-950/50 text-emerald-300"
            }`}
          >
            {msg}
          </p>
        )}
        {err && (
          <p className="rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-stone-400">
            {dirtyCount > 0
              ? `${dirtyCount} cambio(s) pendiente(s)`
              : "➕ crear · ⭐ destacado · Nº · ♾️ · 🗑️ doble toque"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading || saving}
              className="tap rounded-xl border border-stone-600 px-4 py-3 text-sm font-semibold text-stone-300 disabled:opacity-50"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="tap rounded-xl bg-gradient-to-r from-amber-500 to-orange-700 px-6 py-3 text-sm font-bold text-stone-950 disabled:opacity-40"
            >
              {saving
                ? "Guardando..."
                : dirtyCount > 0
                  ? `Guardar cambios (${dirtyCount}) y avisar pantallas`
                  : "Avisar y sincronizar pantallas"}
            </button>
          </div>
        </div>
      </div>

      <ImageCropUploadModal
        open={!!photoProduct}
        product={photoProduct}
        onClose={() => setPhotoProduct(null)}
        onUploaded={handleImageUploaded}
      />

      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-stone-600 bg-stone-950 p-5 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-amber-100">
              ➕ Nuevo · {groupMeta.icon} {groupMeta.label}
            </h3>
            <p className="mt-1 text-xs text-stone-400">
              Código automático (ej. CAF-MOKA). Las TVs se actualizan al crear.
            </p>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold uppercase text-stone-400">
                Nombre
              </span>
              <input
                autoFocus
                required
                type="text"
                maxLength={160}
                value={createForm.nombre}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, nombre: e.target.value }))
                }
                placeholder="Ej: Moka"
                className="tap w-full rounded-xl border border-stone-600 bg-stone-900 px-3 py-3 text-base text-ivory outline-none focus:border-amber-500"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-stone-400">
                  Precio C$
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={createForm.precio}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      precio:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="tap w-full rounded-xl border border-stone-600 bg-stone-900 px-3 py-3 text-center text-base font-semibold text-ivory outline-none focus:border-amber-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-stone-400">
                  Stock inicial
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={createForm.es_ilimitado}
                  value={createForm.stock}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      stock: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  className="tap w-full rounded-xl border border-stone-600 bg-stone-900 px-3 py-3 text-center text-base font-semibold text-ivory outline-none focus:border-amber-500 disabled:opacity-40"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-sky-800/40 bg-sky-950/30 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-sky-200">
                  ♾️ Stock ilimitado
                </p>
                <p className="text-[11px] text-stone-500">
                  No se agota por existencias · solo con switch Off
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={createForm.es_ilimitado}
                onClick={() =>
                  setCreateForm((f) => ({
                    ...f,
                    es_ilimitado: !f.es_ilimitado,
                  }))
                }
                className={`tap relative h-10 w-16 rounded-full ${
                  createForm.es_ilimitado ? "bg-sky-600" : "bg-stone-600"
                }`}
              >
                <span
                  className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${
                    createForm.es_ilimitado ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-amber-800/40 bg-amber-950/25 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-amber-100">
                    ⭐ Destacado
                  </p>
                  <p className="text-[10px] text-stone-500">Foto grande TV</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={createForm.destacado}
                  onClick={() =>
                    setCreateForm((f) => ({ ...f, destacado: !f.destacado }))
                  }
                  className={`tap relative h-9 w-14 rounded-full ${
                    createForm.destacado ? "bg-amber-600" : "bg-stone-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-8 w-8 rounded-full bg-white shadow transition ${
                      createForm.destacado ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              <label className="block rounded-xl border border-stone-700 bg-stone-900/80 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase text-stone-400">
                  Nº combo (1–12)
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={createForm.numero_combo}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      numero_combo: e.target.value,
                    }))
                  }
                  placeholder="Auto"
                  className="tap mt-1 w-full rounded-lg border border-stone-600 bg-stone-950 px-2 py-2 text-center text-base font-bold text-gold outline-none"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-stone-700 bg-stone-900/80 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-100">
                  Visible en pantalla
                </p>
                <p className="text-[11px] text-stone-500">
                  On = aparece en TVs
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={createForm.activo}
                onClick={() =>
                  setCreateForm((f) => ({ ...f, activo: !f.activo }))
                }
                className={`tap relative h-10 w-16 rounded-full ${
                  createForm.activo ? "bg-emerald-600" : "bg-stone-600"
                }`}
              >
                <span
                  className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${
                    createForm.activo ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-stone-700 bg-stone-900/80 px-3 py-3">
              <p className="text-sm font-semibold text-stone-100">
                Días en pantallas de menú
              </p>
              <p className="text-[11px] text-stone-500">
                Como las promociones: «Todos» o días concretos
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm((f) => ({ ...f, dias_semana: null }))
                  }
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    createForm.dias_semana == null
                      ? "bg-amber-500/30 text-amber-100"
                      : "bg-stone-800 text-cream/60"
                  }`}
                >
                  Todos
                </button>
                {DAYS.map((d) => {
                  const sel =
                    Array.isArray(createForm.dias_semana) &&
                    createForm.dias_semana.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => {
                        setCreateForm((f) => {
                          const cur = Array.isArray(f.dias_semana)
                            ? [...f.dias_semana]
                            : null;
                          if (cur == null) return { ...f, dias_semana: [d.v] };
                          const has = cur.includes(d.v);
                          const next = has
                            ? cur.filter((x) => x !== d.v)
                            : [...cur, d.v].sort((a, b) => a - b);
                          return {
                            ...f,
                            dias_semana: next.length ? next : null,
                          };
                        });
                      }}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        sel
                          ? "bg-emerald-600/40 text-emerald-100"
                          : "bg-stone-800 text-cream/55"
                      }`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="tap flex-1 rounded-xl border border-stone-600 py-3 text-sm font-semibold text-stone-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="tap flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-700 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {creating ? "Creando…" : "Crear y avisar TVs"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/75 p-2 sm:p-4">
      {body}
    </div>
  );
}