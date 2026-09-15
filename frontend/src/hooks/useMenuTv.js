import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { CACHE_KEYS, cacheGetData, cacheSet } from "../lib/tvCache";
import { useWebSocket } from "./useWebSocket";

const EMPTY_MENU = {
  platillos: [],
  extras: [],
  jugos: [],
  bebidas: [],
  cafes: [],
  licores: [],
};

function groupKeyForTipo(tp) {
  if (tp === "plato_preestablecido") return "platillos";
  if (tp === "extra") return "extras";
  if (tp === "bebida_jugo") return "jugos";
  if (tp === "bebida_soda") return "bebidas";
  if (tp === "licor") return "licores";
  if (tp === "cafe") return "cafes";
  return null;
}

function mergeProduct(p, ev) {
  return {
    ...p,
    pr: ev.pr ?? p.pr,
    s: ev.s !== undefined ? ev.s : p.s,
    a: ev.a !== undefined ? ev.a : p.a,
    n: ev.n ?? p.n,
    inf: ev.inf !== undefined ? ev.inf : p.inf,
    dst: ev.dst !== undefined ? ev.dst : p.dst,
    num: ev.num !== undefined ? ev.num : p.num,
    img: ev.u ?? p.img,
    imgV: ev.v ?? p.imgV,
  };
}

/**
 * Menú con caché local: primer load red → localStorage/IDB.
 * WS solo aplica deltas cuando hay cambio real del admin.
 */
export function useMenuTv() {
  const cached = cacheGetData(CACHE_KEYS.menu);
  const [menu, setMenu] = useState(cached?.menu || { ...EMPTY_MENU });
  const [flash, setFlash] = useState(null);
  const [ready, setReady] = useState(!!cached?.menu);
  const [wsStatus, setWsStatus] = useState("off");
  const [fromCache, setFromCache] = useState(!!cached?.menu);

  const persist = useCallback((nextMenu) => {
    cacheSet(CACHE_KEYS.menu, { menu: nextMenu, v: Date.now() });
  }, []);

  const reloadMenu = useCallback(async () => {
    try {
      // Endpoint público: no requiere PIN/JWT (TVs no pueden loguearse)
      const data = await api.menu();
      const m = data.menu || { ...EMPTY_MENU };
      setMenu((prev) => {
        const merged = { ...m };
        for (const key of Object.keys(merged)) {
          const prevList = prev[key] || [];
          merged[key] = (merged[key] || []).map((newP) => {
            const oldP = prevList.find((x) => x.id === newP.id || x.c === newP.c);
            return {
              ...newP,
              img: newP.img || oldP?.img,
              imgV: newP.imgV || oldP?.imgV,
            };
          });
        }
        persist(merged);
        return merged;
      });
      setFromCache(false);
      setReady(true);
      return m;
    } catch (e) {
      console.error("[useMenuTv] menu", e);
      // mantener cache local si existe
      if (cacheGetData(CACHE_KEYS.menu)?.menu) {
        setFromCache(true);
      }
      setReady(true);
      return null;
    }
  }, [persist]);

  const bootstrap = useCallback(async () => {
    // Antes se hacía login pantallas/1234: con auth solo-PIN y bloqueo
    // de UA de TV eso fallaba y las pantallas 1–2 quedaban sin menú.
    await reloadMenu();
  }, [reloadMenu]);

  useEffect(() => {
    bootstrap();
    // Reintento periódico por si el backend aún arrancaba
    const t1 = window.setTimeout(() => {
      reloadMenu();
    }, 8000);
    const t2 = window.setInterval(() => {
      reloadMenu();
    }, 60000);
    return () => {
      window.clearTimeout(t1);
      window.clearInterval(t2);
    };
  }, [bootstrap, reloadMenu]);

  const applyProductEvent = useCallback(
    (ev) => {
      setMenu((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = (next[key] || []).map((p) => {
            if (p.id !== ev.id && p.c !== ev.c) return p;
            return mergeProduct(p, ev);
          });
        }
        // alta
        if (ev.t === "+" && ev.c) {
          const gk = groupKeyForTipo(ev.tp);
          if (gk) {
            const exists = (next[gk] || []).some((p) => p.c === ev.c || p.id === ev.id);
            if (!exists) {
              next[gk] = [
                ...(next[gk] || []),
                {
                  id: ev.id,
                  c: ev.c,
                  n: ev.n,
                  pr: ev.pr,
                  s: ev.s,
                  a: ev.a,
                  tp: ev.tp,
                  inf: ev.inf,
                  dst: ev.dst,
                  num: ev.num,
                },
              ];
            }
          }
        }
        if (ev.t === "-") {
          for (const key of Object.keys(next)) {
            next[key] = (next[key] || []).filter(
              (p) => p.id !== ev.id && p.c !== ev.c
            );
          }
        }
        persist(next);
        return next;
      });
      if (ev.c) {
        setFlash(ev.c);
        window.setTimeout(() => setFlash(null), 1800);
      }
    },
    [persist]
  );

  const onWs = useCallback(
    (ev) => {
      if (!ev?.t) return;
      if (ev.t === "h") setWsStatus("on");
      if (ev.t === "p" || ev.t === "z" || ev.t === "img" || ev.t === "+" || ev.t === "-") {
        applyProductEvent(ev);
        if (ev.t === "+" || ev.t === "-") {
          // recarga ligera para URLs de imagen nuevas
          reloadMenu();
        }
      }
    },
    [applyProductEvent, reloadMenu]
  );

  const { status } = useWebSocket("pantallas", onWs);
  useEffect(() => {
    setWsStatus(status === "live" ? "on" : status);
  }, [status]);

  return { menu, flash, ready, wsStatus, fromCache, reloadMenu };
}

/** Producto agotado: inactivo, o stock ≤ 0 si no es ilimitado. */
export function isAgotado(p) {
  if (p?.a === 0 || p?.a === false) return true;
  if (p?.inf === 1 || p?.inf === true || p?.es_ilimitado === true) return false;
  return Number(p?.s) <= 0;
}
