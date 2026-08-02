import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { AMBIENT_UI_DEFAULTS } from "../hooks/useAmbientUiConfig";

/**
 * Panel estilo Winamp clásico — controla el reproductor del host
 * (salida jack/Bluetooth → amplificador). No embebe el EXE de Winamp.
 * Incluye config de banners (duraciones, marquesina) vía /api/ambient/config.
 */
export default function AmbientMusicPanel() {
  const [st, setSt] = useState(null);
  const [folders, setFolders] = useState([]);
  const [folder, setFolder] = useState("");
  const [tracks, setTracks] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ui, setUi] = useState({ ...AMBIENT_UI_DEFAULTS });
  const [uiSaved, setUiSaved] = useState("");
  const [scanMsg, setScanMsg] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [newListName, setNewListName] = useState("");
  const [addListName, setAddListName] = useState("likes");

  const refresh = useCallback(async () => {
    try {
      const s = await api.ambientStatus();
      setSt(s);
      if (s.folders) setFolders(s.folders);
      const cfg = s.ui || s.config;
      if (cfg) setUi((prev) => ({ ...prev, ...AMBIENT_UI_DEFAULTS, ...cfg }));
      setErr(
        s.offline
          ? s.error ||
              "Reproductor reiniciándose en el PC… espere unos segundos"
          : ""
      );
    } catch (e) {
      setErr(e.message || "Sin conexión al reproductor");
      setSt({ ok: false, offline: true, recovering: true });
    }
  }, []);

  async function saveUi(patch) {
    setBusy(true);
    setUiSaved("");
    try {
      const next = { ...ui, ...patch };
      setUi(next);
      const res = await api.ambientConfigUpdate(patch);
      if (res?.config) setUi((p) => ({ ...p, ...res.config }));
      setUiSaved("Config de banners guardada · TVs actualizadas");
      window.setTimeout(() => setUiSaved(""), 3500);
    } catch (e) {
      setErr(e.message || "No se pudo guardar config");
    } finally {
      setBusy(false);
    }
  }

  const loadLib = useCallback(async (f) => {
    try {
      const lib = await api.ambientLibrary(f || undefined);
      setTracks(lib.items || []);
      if (lib.folders) setFolders(lib.folders);
    } catch {
      setTracks([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadLib("");
    const id = window.setInterval(refresh, 2500);
    return () => window.clearInterval(id);
  }, [refresh, loadLib]);

  async function act(fn) {
    setBusy(true);
    try {
      const s = await fn();
      setSt(s);
      setErr(s.offline ? s.error : "");
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  const cur = st?.current;
  const playing = st?.playing;
  const lcd = cur
    ? `${cur.artist || "—"} — ${cur.title || "—"}`
    : st?.offline
      ? "RECONECTANDO · el PC reintenta el reproductor solo"
      : "El Callejón · Ambiente listo";
  const cover = cur?.cover_url || cur?.album_art || null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4">
      <p className="mb-2 text-[11px] text-cream/55">
        Música del PC → amplificador (jack o Bluetooth). Banner en TV #3–#6.
        Títulos limpios + carátula (iTunes). El audio lo reproduce el host Windows.
      </p>

      {/* Shell Winamp clásico */}
      <div className="winamp-shell mx-auto w-full max-w-md select-none">
        <div className="winamp-titlebar">
          <span>WINAMP</span>
          <span className="opacity-70">CLÁSICO · AMBIENTE</span>
        </div>
        <div className="winamp-body">
          <div className="flex items-stretch gap-2">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="h-[4.5rem] w-[4.5rem] shrink-0 rounded border border-lime-900/60 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded border border-lime-900/60 bg-black/50 text-2xl text-lime-700/80">
                ♪
              </div>
            )}
            <div className="winamp-lcd min-w-0 flex-1" title={lcd}>
              <div className="winamp-lcd-scroll">{lcd}</div>
              <div className="winamp-lcd-meta">
                {playing ? "► PLAY" : st?.paused ? "❚❚ PAUSE" : "■ STOP"}
                {cur?.folder ? ` · ${cur.folder}` : ""}
                {st?.shuffle ? " · SHUF" : ""}
              </div>
            </div>
          </div>

          <div className="winamp-controls">
            <button
              type="button"
              disabled={busy}
              className="winamp-btn"
              onClick={() => act(() => api.ambientPrev())}
            >
              ⏮
            </button>
            <button
              type="button"
              disabled={busy}
              className="winamp-btn"
              onClick={() =>
                act(() =>
                  playing ? api.ambientPause() : api.ambientResume()
                )
              }
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="winamp-btn"
              onClick={() => act(() => api.ambientStop())}
            >
              ⏹
            </button>
            <button
              type="button"
              disabled={busy}
              className="winamp-btn"
              onClick={() => act(() => api.ambientNext())}
            >
              ⏭
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy || !cur}
              className={`winamp-btn ${st?.liked ? "on" : ""}`}
              title="Me gusta"
              onClick={() =>
                act(() =>
                  api.ambientLike(cur?.rel, st?.liked ? false : true)
                )
              }
            >
              {st?.liked ? "♥" : "♡"} Like
            </button>
            <button
              type="button"
              disabled={busy || !cur}
              className="winamp-btn"
              title="Agregar a lista"
              onClick={() =>
                act(() =>
                  api.ambientPlaylistAdd(addListName || "likes", cur?.rel)
                )
              }
            >
              + Lista
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1">
            {[
              { id: "all_shuffle", label: "Shuffle todas" },
              { id: "all_order", label: "Orden todas" },
              { id: "folder_shuffle", label: "Shuffle carpeta" },
              { id: "folder_order", label: "Orden carpeta" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                className={`winamp-btn text-[9px] leading-tight ${
                  (st?.play_mode || "all_shuffle") === m.id ? "on" : ""
                }`}
                onClick={() =>
                  act(() =>
                    api.ambientMode(
                      m.id,
                      m.id.startsWith("folder")
                        ? folder || st?.folder || undefined
                        : ""
                    )
                  )
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          <label className="winamp-vol">
            VOL
            <input
              type="range"
              min={0}
              max={100}
              value={st?.volume ?? 70}
              onChange={(e) =>
                act(() => api.ambientVolume(Number(e.target.value)))
              }
            />
            <span>{st?.volume ?? 70}</span>
          </label>

          <label className="winamp-check">
            <input
              type="checkbox"
              checked={st?.pause_on_event !== false}
              onChange={(e) =>
                act(() => api.ambientPauseOnEvent(e.target.checked))
              }
            />
            Pausar ambiente en modo evento (opcional)
          </label>
          <p className="mt-1 text-[9px] text-lime-800/90">
            Modo: {st?.play_mode || "all_shuffle"}
            {st?.folder ? ` · ${st.folder}` : " · todas las carpetas"}
          </p>
        </div>

        <div className="winamp-plist-head">LISTAS · ME GUSTA · CARPETAS</div>
        <div className="winamp-plist">
          <button
            type="button"
            className={`winamp-folder ${
              st?.active_playlist === "likes" ? "active" : ""
            }`}
            onClick={() => act(() => api.ambientPlaylistPlay("likes", true))}
          >
            ♥ Me gusta ({st?.likes_count ?? 0})
          </button>
          {(st?.playlist_names || [])
            .filter((n) => n !== "likes")
            .map((n) => (
              <div key={n} className="flex gap-0.5">
                <button
                  type="button"
                  className={`winamp-folder min-w-0 flex-1 ${
                    st?.active_playlist === n ? "active" : ""
                  }`}
                  onClick={() =>
                    act(() => api.ambientPlaylistPlay(n, true))
                  }
                >
                  ☰ {n}
                </button>
                <button
                  type="button"
                  className="winamp-btn px-1 text-[10px]"
                  title="Borrar lista"
                  onClick={() => act(() => api.ambientPlaylistDelete(n))}
                >
                  ×
                </button>
              </div>
            ))}
          <div className="flex gap-1 p-1">
            <input
              className="min-w-0 flex-1 rounded border border-lime-900/50 bg-black/40 px-1 py-0.5 text-[10px] text-lime-200"
              placeholder="Nueva lista…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value.slice(0, 40))}
            />
            <button
              type="button"
              className="winamp-btn text-[10px]"
              disabled={!newListName.trim()}
              onClick={async () => {
                const n = newListName.trim();
                if (!n) return;
                await act(() => api.ambientPlaylistCreate(n));
                setAddListName(n);
                setNewListName("");
                refresh();
              }}
            >
              Crear
            </button>
          </div>
          <label className="block px-1 text-[9px] text-lime-800">
            Agregar a:
            <select
              className="mt-0.5 w-full rounded border border-lime-900/50 bg-black/50 px-1 py-0.5 text-[10px] text-lime-100"
              value={addListName}
              onChange={(e) => setAddListName(e.target.value)}
            >
              <option value="likes">Me gusta</option>
              {(st?.playlist_names || [])
                .filter((n) => n !== "likes")
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className={`winamp-folder ${!folder && !st?.active_playlist ? "active" : ""}`}
            onClick={() => {
              setFolder("");
              loadLib("");
              act(() => api.ambientMode("all_shuffle", ""));
            }}
          >
            ★ Todas ({st?.library_count ?? "—"})
          </button>
          {folders.map((f) => (
            <button
              key={f}
              type="button"
              className={`winamp-folder ${folder === f ? "active" : ""}`}
              onClick={() => {
                setFolder(f);
                loadLib(f);
                act(() => api.ambientPlay({ folder: f }));
              }}
            >
              📁 {f}
            </button>
          ))}
        </div>

        <div className="winamp-tracks">
          {tracks.slice(0, 80).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`winamp-track ${
                cur?.id === t.id ? "current" : ""
              }`}
              onClick={() =>
                act(() =>
                  api.ambientPlay({ folder: folder || undefined, track_id: t.id })
                )
              }
            >
              <span className="truncate">
                {t.artist} — {t.title}
              </span>
            </button>
          ))}
          {!tracks.length && (
            <p className="p-2 text-[11px] text-lime-700/80">
              Sin lista — pulse scan o inicie el host player.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-md flex-wrap gap-2">
        <button
          type="button"
          className="tap flex-1 rounded-lg bg-amber-700/80 px-3 py-2 text-xs font-bold"
          disabled={busy}
          onClick={() => act(() => api.ambientPlay({ folder: folder || undefined }))}
        >
          ▶ Play carpeta
        </button>
        <button
          type="button"
          className="tap rounded-lg border border-stone-600 px-3 py-2 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setScanMsg(
              "Escaneando y normalizando MP3 (renombrar + ID3 + carátula)… puede tardar"
            );
            try {
              const s = await api.ambientScan();
              setSt(s);
              setScanMsg(
                s.message ||
                  `OK: ${s.renamed ?? "?"} renombrados, ${s.tagged ?? "?"} con ID3, ${s.covers_downloaded ?? "?"} carátulas`
              );
              await loadLib(folder || "");
              refresh();
            } catch (e) {
              setErr(e.message || "Scan falló");
              setScanMsg("");
            } finally {
              setBusy(false);
            }
          }}
          title="Rescanea Music/ y renombra archivos + metadatos una sola vez"
        >
          Scan + normalizar
        </button>
        <button
          type="button"
          className="tap rounded-lg border border-stone-600 px-3 py-2 text-xs"
          disabled={busy}
          onClick={() => act(() => api.ambientBroadcast())}
        >
          Banner TVs
        </button>
      </div>

      {err && (
        <p className="mx-auto mt-2 max-w-md rounded-lg bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
          {err}
        </p>
      )}
      {scanMsg && (
        <p className="mx-auto mt-2 max-w-md rounded-lg bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {scanMsg}
        </p>
      )}

      {/* Seguridad PIN */}
      <div className="mx-auto mt-4 w-full max-w-md rounded-xl border border-rose-900/40 bg-black/35 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-rose-200/90">
          Seguridad · cambiar PIN
        </h3>
        <p className="mt-1 text-[10px] text-cream/50">
          PIN de 4 a 8 digitos. Es el unico acceso al Centro de Control.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[11px] text-cream/80">
            PIN actual
            <input
              type="password"
              inputMode="numeric"
              className="mt-0.5 w-full rounded-lg border border-stone-600 bg-black/40 px-2 py-1.5 tracking-widest"
              value={oldPin}
              onChange={(e) =>
                setOldPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              maxLength={8}
            />
          </label>
          <label className="text-[11px] text-cream/80">
            PIN nuevo
            <input
              type="password"
              inputMode="numeric"
              className="mt-0.5 w-full rounded-lg border border-stone-600 bg-black/40 px-2 py-1.5 tracking-widest"
              value={newPin}
              onChange={(e) =>
                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              maxLength={8}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || oldPin.length < 4 || newPin.length < 4}
          className="tap mt-2 w-full rounded-lg bg-rose-900/70 px-3 py-2 text-xs font-bold text-rose-50 disabled:opacity-40"
          onClick={async () => {
            setPinMsg("");
            setBusy(true);
            try {
              const r = await api.pinChange(oldPin, newPin);
              setPinMsg(r.message || "PIN actualizado");
              setOldPin("");
              setNewPin("");
            } catch (e) {
              let m = e.message || "No se pudo cambiar";
              try {
                const j = JSON.parse(m);
                m = j.message || m;
              } catch {
                /* */
              }
              setPinMsg(m);
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar PIN nuevo
        </button>
        {pinMsg && (
          <p className="mt-2 text-[10px] text-amber-100/90">{pinMsg}</p>
        )}
      </div>

      {/* Config UI / banners — expuesta en /api/ambient/config y /status */}
      <div className="mx-auto mt-4 w-full max-w-md rounded-xl border border-stone-700/80 bg-black/35 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
          Banners en TV (config ambiente)
        </h3>
        <p className="mt-1 text-[10px] text-cream/50">
          Disponible en <code className="text-lime-400/80">GET/PUT /api/ambient/config</code>{" "}
          y dentro de <code className="text-lime-400/80">/api/ambient/status</code> →{" "}
          <code className="text-lime-400/80">ui</code>.
        </p>

        <label className="mt-3 flex items-center justify-between gap-2 text-[11px] text-cream/80">
          <span>
            Autoplay al iniciar el sistema
            <span className="mt-0.5 block text-[10px] font-normal text-cream/45">
              Por defecto off. API: GET/PUT /api/ambient/boot-autoplay
            </span>
          </span>
          <input
            type="checkbox"
            checked={!!ui.autoplay_on_boot}
            disabled={busy}
            onChange={(e) => saveUi({ autoplay_on_boot: e.target.checked })}
          />
        </label>

        <label className="mt-3 flex items-center justify-between gap-2 text-[11px] text-cream/80">
          <span>
            Modo lite TVs #3–#6
            <span className="mt-0.5 block text-[10px] font-normal text-cream/45">
              Imágenes fijas sin efectos de transición
            </span>
          </span>
          <input
            type="checkbox"
            checked={!!ui.publicidad_lite_mode}
            disabled={busy}
            onChange={(e) =>
              saveUi({ publicidad_lite_mode: e.target.checked })
            }
          />
        </label>

        <label className="mt-3 flex items-center justify-between gap-2 text-[11px] text-cream/80">
          <span>Mostrar «Ahora suena»</span>
          <input
            type="checkbox"
            checked={ui.now_playing_enabled !== false}
            disabled={busy}
            onChange={(e) =>
              saveUi({ now_playing_enabled: e.target.checked })
            }
          />
        </label>

        <label className="mt-2 block text-[11px] text-cream/80">
          Duración toast «Ahora suena» (s)
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            className="mt-1 w-full"
            value={Math.round((ui.now_playing_show_ms || 5000) / 1000)}
            disabled={busy}
            onChange={(e) =>
              setUi((p) => ({
                ...p,
                now_playing_show_ms: Number(e.target.value) * 1000,
              }))
            }
            onMouseUp={(e) =>
              saveUi({
                now_playing_show_ms: Number(e.target.value) * 1000,
              })
            }
            onTouchEnd={(e) =>
              saveUi({
                now_playing_show_ms: Number(e.target.value) * 1000,
              })
            }
          />
          <span className="text-amber-200/90">
            {Math.round((ui.now_playing_show_ms || 5000) / 1000)} s
          </span>
        </label>

        <label className="mt-2 block text-[11px] text-cream/80">
          Máx. antigüedad pista para anunciar (s)
          <input
            type="range"
            min={3}
            max={60}
            step={1}
            className="mt-1 w-full"
            value={ui.now_playing_max_elapsed_s ?? 12}
            disabled={busy}
            onChange={(e) =>
              setUi((p) => ({
                ...p,
                now_playing_max_elapsed_s: Number(e.target.value),
              }))
            }
            onMouseUp={(e) =>
              saveUi({
                now_playing_max_elapsed_s: Number(e.target.value),
              })
            }
            onTouchEnd={(e) =>
              saveUi({
                now_playing_max_elapsed_s: Number(e.target.value),
              })
            }
          />
          <span className="text-amber-200/90">
            {ui.now_playing_max_elapsed_s ?? 12} s
          </span>
        </label>

        <label className="mt-2 block text-[11px] text-cream/80">
          Duración mensajes Chef / ¿Sabías qué? (s)
          <input
            type="range"
            min={3}
            max={60}
            step={1}
            className="mt-1 w-full"
            value={Math.round((ui.mensajes_duracion_ms || 9000) / 1000)}
            disabled={busy}
            onChange={(e) =>
              setUi((p) => ({
                ...p,
                mensajes_duracion_ms: Number(e.target.value) * 1000,
              }))
            }
            onMouseUp={(e) =>
              saveUi({
                mensajes_duracion_ms: Number(e.target.value) * 1000,
              })
            }
            onTouchEnd={(e) =>
              saveUi({
                mensajes_duracion_ms: Number(e.target.value) * 1000,
              })
            }
          />
          <span className="text-amber-200/90">
            {Math.round((ui.mensajes_duracion_ms || 9000) / 1000)} s
          </span>
        </label>

        <label className="mt-3 flex items-center justify-between gap-2 text-[11px] text-cream/80">
          <span>Marquesina si el texto no cabe</span>
          <input
            type="checkbox"
            checked={ui.banner_marquee_enabled !== false}
            disabled={busy}
            onChange={(e) =>
              saveUi({ banner_marquee_enabled: e.target.checked })
            }
          />
        </label>

        <label className="mt-2 block text-[11px] text-cream/80">
          Velocidad marquesina (px/s)
          <input
            type="range"
            min={15}
            max={90}
            step={1}
            className="mt-1 w-full"
            value={ui.banner_marquee_speed_px_s ?? 42}
            disabled={busy || ui.banner_marquee_enabled === false}
            onChange={(e) =>
              setUi((p) => ({
                ...p,
                banner_marquee_speed_px_s: Number(e.target.value),
              }))
            }
            onMouseUp={(e) =>
              saveUi({
                banner_marquee_speed_px_s: Number(e.target.value),
              })
            }
            onTouchEnd={(e) =>
              saveUi({
                banner_marquee_speed_px_s: Number(e.target.value),
              })
            }
          />
          <span className="text-amber-200/90">
            {ui.banner_marquee_speed_px_s ?? 42} px/s
          </span>
        </label>

        {uiSaved && (
          <p className="mt-2 text-[10px] text-emerald-300/90">{uiSaved}</p>
        )}
      </div>

      <div className="mx-auto mt-3 max-w-md text-[10px] leading-relaxed text-cream/45">
        <p className="font-semibold text-cream/60">Arranque en el PC servidor:</p>
        <code className="mt-1 block rounded bg-black/40 p-2 text-[10px] text-lime-400/90">
          python scripts/ambient_host_player.py
        </code>
        <p className="mt-2">
          Audio: Windows → dispositivo de reproducción = Bluetooth del amplificador
          o cable jack 3.5 mm. VLC opcional (mejor); si no, usa MediaPlayer del
          sistema.
        </p>
      </div>
    </div>
  );
}
