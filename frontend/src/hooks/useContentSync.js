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

/**
 * Sincroniza contenido de la TV con el servidor:
 * - reutiliza caché si version igual (cortes de luz / reinicio)
 * - pide lease exclusivo (1 TV a la vez; prioridad 1–2 solo si están en línea)
 * - descarga assets uno a uno con progreso % y ETA
 */
export function useContentSync(tvId, { enabled = true } = {}) {
  const [phase, setPhase] = useState("idle"); // idle|waiting|downloading|ready|error
  const [progress, setProgress] = useState(0);
  const [etaSec, setEtaSec] = useState(null);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const [version, setVersion] = useState(null);
  const [queueInfo, setQueueInfo] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const abortRef = useRef(false);
  const leaseRef = useRef(null);

  const sync = useCallback(async () => {
    if (!tvId || !enabled) return;
    abortRef.current = false;
    setPhase("waiting");
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
        const need = Math.min(sample.length, Math.max(1, Math.ceil(sample.length * 0.7)));
        if (assets.length === 0 || ok >= need) {
          setFromCache(true);
          setProgress(100);
          setPhase("ready");
          setMessage(
            "Contenido en caché — listo (sin cambios; reutilizable tras corte de luz)"
          );
          setDetail(`v${manifest.version} · ${manifest.asset_count} fotos`);
          // Avisar al servidor: esta TV ya funciona (libera cola TV3–6)
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
        setPhase("ready");
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

      // Esperar lease exclusivo
      let lease = null;
      for (let attempt = 0; attempt < 120 && !abortRef.current; attempt++) {
        const lr = await fetch(`${API_URL}/api/content/lease`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tv_id: tvId, reason: "daily_sync" }),
        });
        const data = await lr.json();
        if (data.granted) {
          lease = data;
          leaseRef.current = data.lease_id;
          setQueueInfo(null);
          setMessage("Canal exclusivo — descargando a máxima velocidad…");
          break;
        }
        setPhase("waiting");
        setQueueInfo({
          position: data.queue_position,
          holder: data.holder_tv_id,
          len: data.queue_len,
        });
        setMessage(data.message || "En cola de descarga…");
        setDetail(
          data.holder_tv_id
            ? `TV #${data.holder_tv_id} usa el canal · reintento ${attempt + 1}`
            : data.menus_status || data.reason || ""
        );
        // Si solo espera menús y ya deberían estar listos, reintentar más rápido
        const wait =
          data.reason === "priority_menus_only"
            ? 2000
            : Math.max(1, Number(data.retry_after_s) || 3) * 1000;
        await sleep(wait);
      }

      if (!lease) {
        setPhase("error");
        setMessage("No se obtuvo canal de descarga a tiempo");
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
        const assetStart = doneBytes;
        try {
          const result = await downloadAndCache(a.url, {
            etag: a.etag,
            onProgress: (rec, tot) => {
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

      // Liberar lease
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

      // Purga lo que no está en el presupuesto actual
      await purgeExcept(assets.map((a) => a.url));

      setProgress(100);
      setEtaSec(0);
      setPhase("ready");
      setMessage(
        fail
          ? `Listo con ${fail} archivo(s) fallido(s)`
          : "Campaña del día cargada en este televisor"
      );
      setDetail(`${ok} archivos · ${(cachedBytes / 1024 / 1024).toFixed(1)} MB en caché`);
    } catch (e) {
      setPhase("error");
      setMessage(e.message || "Error de sincronización");
      if (leaseRef.current) {
        fetch(`${API_URL}/api/content/lease/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tv_id: tvId, lease_id: leaseRef.current }),
        }).catch(() => {});
        leaseRef.current = null;
      }
    }
  }, [tvId, enabled]);

  useEffect(() => {
    sync();
    return () => {
      abortRef.current = true;
      if (leaseRef.current) {
        fetch(`${API_URL}/api/content/lease/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tv_id: tvId, lease_id: leaseRef.current }),
        }).catch(() => {});
      }
    };
  }, [sync, tvId]);

  const ready = phase === "ready" || phase === "idle";
  const blocking = phase === "waiting" || phase === "downloading";

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
    resync: sync,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
