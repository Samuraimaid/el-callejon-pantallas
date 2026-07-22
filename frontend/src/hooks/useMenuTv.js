import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";
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
 * Bootstrap catálogo + WS pantallas.
 * Compact: c,n,pr,s,a,tp,inf,dst,num
 */
export function useMenuTv() {
  const [menu, setMenu] = useState({ ...EMPTY_MENU });
  const [flash, setFlash] = useState(null);
  const [ready, setReady] = useState(false);
  const [wsStatus, setWsStatus] = useState("off");

  const reloadMenu = useCallback(async () => {
    try {
      const data = await api.menu();
      setMenu(data.menu || { ...EMPTY_MENU });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const login = await api.login("pantallas", "1234");
      setSession(login.access_token, login.usuario);
      await reloadMenu();
    } catch (e) {
      console.error(e);
    } finally {
      setReady(true);
    }
  }, [reloadMenu]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const applyProductEvent = useCallback((ev) => {
    setMenu((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = (next[key] || []).map((p) => {
          if (p.id !== ev.id && p.c !== ev.c) return p;
          return mergeProduct(p, ev);
        });
      }
      return next;
    });
    setFlash(ev.c || ev.id);
    window.setTimeout(() => setFlash(null), 1200);
  }, []);

  const applyCreated = useCallback(
    (ev) => {
      const key = groupKeyForTipo(ev.tp);
      if (!key) {
        reloadMenu();
        return;
      }
      if (ev.a === 0) {
        setFlash(ev.c);
        window.setTimeout(() => setFlash(null), 1200);
        return;
      }
      const item = {
        id: ev.id,
        c: ev.c,
        n: ev.n,
        pr: ev.pr,
        s: ev.s,
        a: ev.a,
        tp: ev.tp,
        inf: ev.inf ?? 0,
        dst: ev.dst ?? 0,
        num: ev.num,
      };
      setMenu((prev) => {
        const list = prev[key] || [];
        if (list.some((p) => p.id === item.id || p.c === item.c)) {
          return prev;
        }
        return { ...prev, [key]: [...list, item] };
      });
      setFlash(ev.c || ev.id);
      window.setTimeout(() => setFlash(null), 1200);
    },
    [reloadMenu]
  );

  const applyDeleted = useCallback((ev) => {
    setMenu((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = (next[key] || []).filter(
          (p) => p.id !== ev.id && p.c !== ev.c
        );
      }
      return next;
    });
    setFlash(ev.c || ev.id);
    window.setTimeout(() => setFlash(null), 1200);
  }, []);

  const onWs = useCallback(
    (ev) => {
      if (!ev?.t) return;
      if (ev.t === "p" || ev.t === "z" || ev.t === "img") applyProductEvent(ev);
      if (ev.t === "+") applyCreated(ev);
      if (ev.t === "-") applyDeleted(ev);
    },
    [applyProductEvent, applyCreated, applyDeleted]
  );

  const { status } = useWebSocket("pantallas", onWs);
  useEffect(() => setWsStatus(status), [status]);

  return { menu, flash, ready, wsStatus, reloadMenu };
}

export function isAgotado(p) {
  if (p?.a === 0 || p?.a === false) return true;
  if (p?.inf === 1 || p?.inf === true || p?.es_ilimitado === true) return false;
  return Number(p?.s) <= 0;
}
