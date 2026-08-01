import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/constants";
import {
  downloadAndCache,
  estimateCacheBytes,
  getManifestMeta,
  hasBlob,
  purgeExcept,
  setManifestMeta,
} from "../lib/tvMediaCache";

function sleep(ms) {
  return new Promise((r) => window.setTimeout(r, ms));
}

/**
 * Sincroniza contenido de la TV con el servidor.
 * No deja la pantalla negra eterna: en error o cola larga muestra contenido
 * (caché/API) y reintenta en segundo plano.
 */
export function useContentSync(tvId, { enabled = true } = {}) {
  const [phase, setPhase] = useState("idle"); // idle|waiting|downloading|ready|error|degraded
  const [progress, setProgress] = useState(0);
  const [etaSec, setEtaSec] = useState(null);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const [version, setVersion] = useState(null);
  const [queueInfo, setQueueInfo] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  /** true si ya hubo un ciclo ready/degraded — no volver a ocultar children */
  const [hasShownContent, setHasShownContent] = useState(false);
  const abortRef = useRef(false);
  const leaseRef = useRef(null);
  const retryTimer = useRef(0);

  const finishVisible = useCallback((nextPhase = "ready") => {
    setPhase(nextPhase);
    setHasShownContent(true);
  }, []);

  const sync = useCallback(async () => {
    if (!tvId || !enabled) return;
    abortRef.current = false;
    // Solo “waiting” bloqueante si aún no se ha mostrado nada
    setPhase((p) => (p === "ready" || p === "degraded" ? p : "waiting"));
    setProgress(0);
    setEtaSec(null);
    setMessage("Consultando campaña del día…");
    setDetail("");
    setFromCache(false);

    try {
      const manRes = await fetch(`${API_URL}/api/content/manifest/${tvId}`);
      if (!manRes.ok) throw new Error(`Manifiesto HTTP ${manRes.status}`);
      const manifest = await manRes.json();
      const assets = manifest.assets || [];
      setVersion(manifest.version);

      const prev = await getManifestMeta(tvId);
      if (prev?.version === manifest.version && prev?.complete) {
        let ok = 0;
        const sample = assets.slice(0, Math.min(12, assets.length));
        for (const a of sample) {
          if (await hasBlob(a.url)) ok += 1;
        }
        const need = Math.min(
          sample.length,
          Math.max(1, Math.ceil(sample.length * 0.7))
        );
        if (assets.length === 0 || ok >= need) {
          setFromCache(true);
          setProgress(100);
          finishVisible("ready");
          setMessage(
            "Contenido en caché — listo (sin cambios; reutilizable tras corte de luz)"
          );
          setDetail(`v${manifest.version} · ${manifest.asset_count} fotos`);
          try {
            const cachedBytes = await estimateCacheBytes(
              assets.map((a) => a.url)
            );
            await fetch(`${API_URL}/api/content/ack`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tv_id: tvId,
                version: manifest.version,
                cached_bytes: cachedBytes,
                assets_ok: ok || assets.length,
                assets_fail: 0,
                display_ready: true,
              }),
            });
          } catch {
            /* */
          }
          return;
        }
      }

      if (assets.length === 0) {
        await setManifestMeta(tvId, {
          version: manifest.version,
          complete: true,
        });
        finishVisible("ready");
        setProgress(100);
        setMessage("Sin archivos nuevos que descargar");
        try {
          await fetch(`${API_URL}/api/content/ack`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tv_id: tvId,
              version: manifest.version,
              cached_bytes: 0,
              assets_ok: 0,
              assets_fail: 0,
              display_ready: true,
            }),
          });
        } catch {
          /* */
        }
        return;
      }

      // Lease (máx. ~90 s de espera, no minutos)
      let lease = null;
      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts && !abortRef.current; attempt++) {
        // Tras ~12 s de cola, liberar UI (contenido bajo overlay semitransparente)
        if (attempt === 6) {
          setHasShownContent(true);
          setMessage("Descargando en segundo plano…");
        }
        const lr = await fetch(`${API_URL}/api/content/lease`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tv_id: tvId, reason: "daily_sync" }),
        });
        const data = await lr.json().catch(() => ({}));
        if (data.granted) {
          lease = data;
          leaseRef.current = data.lease_id;
          setQueueInfo(null);
          setMessage("Canal exclusivo — descargando…");
          break;
        }
        setPhase((p) =>
          p === "ready" || p === "degraded" ? p : "waiting"
        );
        setQueueInfo({
          position: data.queue_position,
          holder: data.holder_tv_id,
          len: data.queue_len,
        });
        setMessage(data.message || "En cola de descarga…");
        setDetail(
          data.holder_tv_id
            ? `TV #${data.holder_tv_id} usa el canal · ${attempt + 1}`
            : data.menus_status || data.reason || ""
        );
        // Renovar lease beat si ya teníamos uno (no aplica)
        const wait =
          data.reason === "priority_menus_only"
            ? 2000
            : Math.max(1, Number(data.retry_after_s) || 3) * 1000;
        await sleep(wait);
      }

      if (!lease) {
        // No bloquear la TV: mostrar lo que haya y reintentar luego
        finishVisible("degraded");
        setMessage("Mostrando contenido disponible · reintento de descarga en breve");
        setDetail("Sin canal de red exclusivo por ahora");
        return;
      }

      setPhase("downloading");
      const totalBytes = assets.reduce((s, a) => s + (a.bytes || 0), 0) || 1;
      let doneBytes = 0;
      let ok = 0;
      let fail = 0;
      const t0 = performance.now();
      const pauseMs = Number(manifest.transfer_chunk_pause_ms) || 0;

      for (let i = 0; i < assets.length; i++) {
        if (abortRef.current) break;
        const a = assets[i];
        setDetail(`${i + 1}/${assets.length} · ${a.url.split("/").pop()}`);

        // Heartbeat del lease cada ~15 archivos o cada asset pesado
        if (i > 0 && i % 8 === 0) {
          try {
            await fetch(`${API_URL}/api/content/lease`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tv_id: tvId, reason: "renew" }),
            });
          } catch {
            /* */
          }
        }

        const assetStart = doneBytes;
        try {
          const result = await downloadAndCache(a.url, {
            etag: a.etag,
            onProgress: (rec) => {
              const cur = assetStart + rec;
              const pct = Math.min(99, Math.round((cur / totalBytes) * 100));
              setProgress(pct);
              const elapsed = (performance.now() - t0) / 1000;
              if (cur > 0 && elapsed > 0.3) {
                const rate = cur / elapsed;
                const left = Math.max(0, totalBytes - cur);
                setEtaSec(Math.ceil(left / Math.max(rate, 1)));
              }
            },
          });
          doneBytes += result.bytes || a.bytes || 0;
          ok += 1;
        } catch (e) {
          fail += 1;
          doneBytes += a.bytes || 0;
          console.warn("[content-sync]", a.url, e);
        }
        const pct = Math.min(99, Math.round((doneBytes / totalBytes) * 100));
        setProgress(pct);
        if (pauseMs > 0) await sleep(pauseMs);
      }

      try {
        await fetch(`${API_URL}/api/content/lease/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tv_id: tvId,
            lease_id: lease.lease_id,
          }),
        });
      } catch {
        /* */
      }
      leaseRef.current = null;

      const cachedBytes = await estimateCacheBytes(assets.map((a) => a.url));
      await fetch(`${API_URL}/api/content/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tv_id: tvId,
          version: manifest.version,
          cached_bytes: cachedBytes,
          assets_ok: ok,
          assets_fail: fail,
          display_ready: true,
        }),
      }).catch(() => {});

      await setManifestMeta(tvId, {
        version: manifest.version,
        complete: fail === 0 || ok > fail,
        assets_ok: ok,
        assets_fail: fail,
      });

      await purgeExcept(assets.map((a) => a.url));

      setProgress(100);
      setEtaSec(0);
      finishVisible("ready");
      setMessage(
        fail
          ? `Listo con ${fail} archivo(s) fallido(s)`
          : "Campaña del día cargada en este televisor"
      );
      setDetail(
        `${ok} archivos · ${(cachedBytes / 1024 / 1024).toFixed(1)} MB en caché`
      );
    } catch (e) {
      if (abortRef.current) return;
      finishVisible("error");
      setMessage(e.message || "Error de sincronización");
      setDetail("Mostrando contenido local si existe · reintento automático");
      if (leaseRef.current) {
        fetch(`${API_URL}/api/content/lease/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tv_id: tvId, lease_id: leaseRef.current }),
        }).catch(() => {});
        leaseRef.current = null;
      }
    }
  }, [tvId, enabled, finishVisible]);

  useEffect(() => {
    sync();
    return () => {
      abortRef.current = true;
      window.clearTimeout(retryTimer.current);
      if (leaseRef.current) {
        fetch(`${API_URL}/api/content/lease/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tv_id: tvId, lease_id: leaseRef.current }),
        }).catch(() => {});
      }
    };
  }, [sync, tvId]);

  // Reintento automático en error/degraded
  useEffect(() => {
    if (!enabled) return undefined;
    if (phase !== "error" && phase !== "degraded") return undefined;
    retryTimer.current = window.setTimeout(() => {
      sync();
    }, 20000);
    return () => window.clearTimeout(retryTimer.current);
  }, [phase, enabled, sync]);

  // Solo bloquear (ocultar children) en el primer arranque sin contenido
  const blocking =
    !hasShownContent &&
    (phase === "waiting" || phase === "downloading");

  return {
    phase,
    progress,
    etaSec,
    message,
    detail,
    version,
    queueInfo,
    fromCache,
    ready: phase === "ready",
    blocking,
    hasShownContent,
    resync: sync,
  };
}
