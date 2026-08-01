/**
 * Barra de progreso de carga de campaña del día (fotos en caché local).
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
}) {
  if (phase === "ready" || phase === "idle") return null;

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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 text-ivory"
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
              1 TV en línea basta · TV1–2 solo priorizan si están conectadas · offline no bloquea
            </span>
          </p>
        )}

        {fromCache && (
          <p className="mt-3 text-xs text-emerald-400/90">
            Reutilizando caché local (sin cambios en la campaña)
          </p>
        )}

        {phase === "error" && (
          <p className="mt-4 text-sm text-rose-300">
            Si hay red, reintente recargando la página (Ctrl+F5)
          </p>
        )}
      </div>
    </div>
  );
}
