import { useTvFullscreen } from "../../hooks/useTvFullscreen";
import { isTvEmbedMode } from "../../lib/tvEmbed";

/**
 * Pantalla completa en TVs:
 * - Auto-intento al abrir + ráfaga tras recarga
 * - Si el navegador bloquea (típico tras F5), un toque basta
 * - Sin botón de salir en modo kiosco
 */
export default function TvFullscreenChrome({ label = "pantalla" }) {
  const embed = isTvEmbedMode();
  const {
    isFullscreen,
    needsPrompt,
    needsUserGesture,
    enter,
    exit,
    standalone,
    persistent,
    allowExit,
  } = useTvFullscreen({ autoTry: !embed });

  if (embed) return null;

  return (
    <>
      {needsPrompt && (
        <button
          type="button"
          onPointerDown={(e) => {
            // Gesto directo en el botón = activación de usuario (Fullscreen API)
            e.stopPropagation();
            void enter();
          }}
          onClick={(e) => {
            e.preventDefault();
            void enter();
          }}
          className="tv-fs-overlay"
          aria-label="Activar pantalla completa"
        >
          <span className="tv-fs-card">
            <span className="tv-fs-icon" aria-hidden>
              ⛶
            </span>
            <span className="tv-fs-title">
              {needsUserGesture
                ? "Reanudar pantalla completa"
                : "Pantalla completa"}
            </span>
            <span className="tv-fs-desc">
              {needsUserGesture
                ? `Tras recargar, el navegador pide un toque. Toque aquí para fijar la ${label}.`
                : `Toque una vez para usar todo el espacio de la ${label}. Se intentará mantener sola.`}
            </span>
            <span className="tv-fs-btn">
              {needsUserGesture ? "Reanudar ahora" : "Activar ahora"}
            </span>
            {persistent && (
              <span className="tv-fs-hint">
                Modo kiosco · se reintenta solo; tras F5 a veces hace falta 1 toque
              </span>
            )}
          </span>
        </button>
      )}

      {!needsPrompt && !isFullscreen && !standalone && !persistent && (
        <button
          type="button"
          onClick={() => enter()}
          className="tv-fs-chip"
          title="Pantalla completa"
        >
          ⛶ Completa
        </button>
      )}

      {isFullscreen && allowExit && (
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
