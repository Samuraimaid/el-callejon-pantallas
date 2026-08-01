/**
 * Barra de progreso de carga. En error/degraded se auto-oculta
 * para no dejar la TV negra eterna.
 */
export default function ContentLoadingOverlay({
  phase,
  progress = 0,
  etaSec = null,
  message = "",
  detail = "",
  queueInfo = null,
  fromCache = false,
  tvId,
  onRetry,
  onDismiss,
}) {
  if (phase === "ready" || phase === "idle") return null;

  // error/degraded: barra fina superior, no pantalla negra completa
  const soft = phase === "error" || phase === "degraded";
  if (soft) {
    return (
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[200] px-3 pt-3"
        data-tv-loading={tvId}
        role="status"
      >
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-amber-700/40 bg-black/75 px-3 py-2 text-left text-xs text-amber-100/95 shadow-lg backdrop-blur-sm">
          <span className="shrink-0">⚠</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{message || "Sincronización en segundo plano"}</p>
            {detail && (
              <p className="truncate text-[10px] text-stone-400">{detail}</p>
            )}
          </div>
          {onRetry && (
            <button
              type="button"
              className="pointer-events-auto shrink-0 rounded-lg bg-amber-700/90 px-2 py-1 text-[10px] font-bold text-stone-950"
              onClick={onRetry}
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const etaLabel =
    etaSec == null
      ? ""
      : etaSec <= 0
        ? "finalizando…"
        : etaSec < 60
          ? `~${etaSec}s restantes`
          : `~${Math.ceil(etaSec / 60)} min restantes`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 text-ivory"
      data-tv-loading={tvId}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-xl px-8 text-center">
        <p className="font-display text-3xl text-amber-100">El Callejón</p>
        <p className="mt-1 text-sm uppercase tracking-[0.25em] text-amber-300/80">
          TV #{tvId} · Carga de contenido
        </p>

        <div className="mt-8 h-4 overflow-hidden rounded-full bg-stone-800 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-3 font-display text-4xl tabular-nums text-white">
          {pct}%
        </p>
        {etaLabel && (
          <p className="mt-1 text-sm text-cream/70">{etaLabel}</p>
        )}

        <p className="mt-5 text-base text-cream/90">{message}</p>
        {detail && (
          <p className="mt-2 truncate text-xs text-stone-500">{detail}</p>
        )}

        {queueInfo?.position != null && (
          <p className="mt-4 rounded-xl border border-amber-800/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-100/90">
            Cola de red: posición {queueInfo.position}
            {queueInfo.holder ? ` · TV #${queueInfo.holder} descargando` : ""}
            <span className="mt-1 block text-[11px] text-stone-400">
              1 TV en línea basta · offline no bloquea
            </span>
          </p>
        )}

        {fromCache && (
          <p className="mt-3 text-xs text-emerald-400/90">
            Reutilizando caché local (sin cambios en la campaña)
          </p>
        )}

        {onDismiss && (
          <button
            type="button"
            className="tap mt-6 rounded-xl border border-stone-500/60 px-4 py-2 text-sm text-cream/80"
            onClick={onDismiss}
          >
            Ver pantalla de todos modos
          </button>
        )}
      </div>
    </div>
  );
}
