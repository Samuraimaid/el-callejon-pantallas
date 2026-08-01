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

  const refresh = useCallback(async () => {
    try {
      const s = await api.ambientStatus();
      setSt(s);
      if (s.folders) setFolders(s.folders);
      const cfg = s.ui || s.config;
      if (cfg) setUi((prev) => ({ ...prev, ...AMBIENT_UI_DEFAULTS, ...cfg }));
      setErr(s.offline ? s.error || "Host offline" : "");
    } catch (e) {
      setErr(e.message || "Sin conexión al reproductor");
      setSt({ ok: false, offline: true });
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
      ? "HOST OFFLINE · ejecute ambient_host_player.py"
      : "El Callejón · Ambiente listo";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4">
      <p className="mb-2 text-[11px] text-cream/55">
        Música del PC → amplificador (jack o Bluetooth). Banner en TV #3–#6.
        El panel imita Winamp clásico; el audio lo reproduce el host Windows.
      </p>

      {/* Shell Winamp clásico */}
      <div className="winamp-shell mx-auto w-full max-w-md select-none">
        <div className="winamp-titlebar">
          <span>WINAMP</span>
          <span className="opacity-70">CLÁSICO · AMBIENTE</span>
        </div>
        <div className="winamp-body">
          <div className="winamp-lcd" title={lcd}>
            <div className="winamp-lcd-scroll">{lcd}</div>
            <div className="winamp-lcd-meta">
              {playing ? "► PLAY" : st?.paused ? "❚❚ PAUSE" : "■ STOP"}
              {cur?.folder ? ` · ${cur.folder}` : ""}
              {st?.shuffle ? " · SHUF" : ""}
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
            <button
              type="button"
              disabled={busy}
              className={`winamp-btn ${st?.shuffle ? "on" : ""}`}
              onClick={() =>
                act(() => api.ambientShuffle(!st?.shuffle))
              }
            >
              SHUF
            </button>
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
        </div>

        <div className="winamp-plist-head">PLAYLIST · CARPETAS</div>
        <div className="winamp-plist">
          <button
            type="button"
            className={`winamp-folder ${!folder ? "active" : ""}`}
            onClick={() => {
              setFolder("");
              loadLib("");
              act(() => api.ambientPlay({ folder: "" }));
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
          onClick={() => act(() => api.ambientScan())}
        >
          Scan
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
