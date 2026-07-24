import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";
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
      const data = await api.menu();
      const m = data.menu || { ...EMPTY_MENU };
      setMenu(m);
      persist(m);
      setFromCache(false);
      return m;
    } catch (e) {
      console.error(e);
      // mantener cache
      return null;
    }
  }, [persist]);

  const bootstrap = useCallback(async () => {
    try {
      const login = await api.login("pantallas", "1234");
      setSession(login.access_token, login.usuario);
      await reloadMenu();
    } catch (e) {
      console.error(e);
      // sin red: si hay cache, listo
      if (cacheGetData(CACHE_KEYS.menu)?.menu) {
        setFromCache(true);
      }
    } finally {
      setReady(true);
    }
  }, [reloadMenu]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

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
        if (ev.t === "img" || ev.t === "+" || ev.t === "-") {
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
