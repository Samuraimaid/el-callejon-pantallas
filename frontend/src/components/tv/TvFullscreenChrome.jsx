import { useEffect } from "react";
import { useTvFullscreen } from "../../hooks/useTvFullscreen";
import { isTvEmbedMode } from "../../lib/tvEmbed";

/**
 * Pantalla completa en TVs reales:
 * - Intento automático al abrir (muchas Smart TVs lo permiten)
 * - Si el navegador exige gesto: overlay a pantalla completa (un toque)
 * - Una vez activa, persiste hasta salir
 * Centro de Control (embed): no se monta.
 */
export default function TvFullscreenChrome({ label = "pantalla" }) {
  const embed = isTvEmbedMode();
  const { isFullscreen, needsPrompt, enter, exit, standalone } =
    useTvFullscreen({ autoTry: !embed });

  // Primer toque en cualquier parte → fullscreen (fallback si autoTry falló)
  useEffect(() => {
    if (embed || isFullscreen || standalone) return undefined;
    const once = () => {
      enter();
    };
    // capture: intercepta antes que botones internos
    window.addEventListener("pointerdown", once, { once: true, capture: true });
    window.addEventListener("keydown", once, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", once, { capture: true });
      window.removeEventListener("keydown", once, { capture: true });
    };
  }, [embed, isFullscreen, standalone, enter]);

  if (embed) return null;

  return (
    <>
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
              Toque una vez para usar todo el espacio de la {label}.
            </span>
            <span className="tv-fs-btn">Activar ahora</span>
          </span>
        </button>
      )}

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
