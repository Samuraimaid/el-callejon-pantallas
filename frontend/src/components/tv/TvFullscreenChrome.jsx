import { useTvFullscreen } from "../../hooks/useTvFullscreen";

/**
 * Overlay + atajo para forzar pantalla completa en rutas de TV.
 * Los navegadores (Chrome móvil/TV) exigen un toque del usuario.
 */
export default function TvFullscreenChrome({ label = "pantalla" }) {
  const { isFullscreen, needsPrompt, enter, exit, standalone } =
    useTvFullscreen({ autoTry: true });

  return (
    <>
      {/* Overlay grande: un toque y se oculta la barra de direcciones */}
      {needsPrompt && (
        <button
          type="button"
          onClick={() => enter()}
          className="tv-fs-overlay"
          aria-label="Activar pantalla completa"
        >
          <span className="tv-fs-card">
            <span className="tv-fs-icon" aria-hidden>
              ⛶
            </span>
            <span className="tv-fs-title">Pantalla completa</span>
            <span className="tv-fs-desc">
              Toque aquí una vez para ocultar la barra del navegador y usar todo
              el espacio de la {label}.
            </span>
            <span className="tv-fs-btn">Activar ahora</span>
            <span className="tv-fs-hint">
              En Smart TV: favoritos → abrir → tocar una vez
            </span>
          </span>
        </button>
      )}

      {/* Chip discreto si salió de fullscreen */}
      {!needsPrompt && !isFullscreen && !standalone && (
        <button
          type="button"
          onClick={() => enter()}
          className="tv-fs-chip"
          title="Pantalla completa"
        >
          ⛶ Completa
        </button>
      )}

      {/* Salir (útil en PC de prueba; en TV casi no se ve) */}
      {isFullscreen && !standalone && (
        <button
          type="button"
          onClick={() => exit()}
          className="tv-fs-chip tv-fs-chip-exit"
          title="Salir de pantalla completa"
        >
          ✕
        </button>
      )}
    </>
  );
}
