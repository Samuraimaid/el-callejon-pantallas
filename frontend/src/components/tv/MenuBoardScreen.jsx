import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "../Logo";
import {
  MenuBoardHero,
  MenuBoardItem,
  MenuBoardPanel,
} from "./MenuBoard";
import PromoMarquee from "./PromoMarquee";
import TvFullscreenChrome from "./TvFullscreenChrome";
import { API_URL } from "../../lib/constants";
import { useWebSocket } from "../../hooks/useWebSocket";

const DEFAULT_BOARD = {
  leftTitle: "",
  rightTitle: "",
  showTitles: false,
  showSubtitles: false,
  leftMaxCards: 5,
  rightMaxCards: 5,
  heroTitle: "Menú del día",
  heroIntervalMs: 5000,
  showClock: false,
  showMarquee: true,
  showLogo: true,
};

const DEFAULT_LAYOUT = {
  logoSizePx: 110,
  logoAlign: "left",
  logoOutlinePx: 2,
  textOutlinePx: 1.5,
  marqueeIntervalMs: 5200,
};

/** Contorno blanco nítido vía drop-shadow (funciona con PNG transparente). */
function logoOutlineFilter(px) {
  const n = Math.max(0, Math.min(12, Number(px) || 0));
  if (n <= 0) return "none";
  const steps = Math.max(8, n * 4);
  const parts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = (Math.cos(a) * n).toFixed(2);
    const y = (Math.sin(a) * n).toFixed(2);
    parts.push(`drop-shadow(${x}px ${y}px 0 #ffffff)`);
  }
  // sombra suave de profundidad
  parts.push("drop-shadow(0 3px 6px rgba(0,0,0,0.35))");
  return parts.join(" ");
}

function sanitizeHeroTitle(t) {
  const s = String(t || "").trim();
  if (!s) return "Menú del día";
  if (s.includes("??") || s.includes("MenÃ") || /Men\?\?/i.test(s)) {
    return "Menú del día";
  }
  return s;
}

/**
 * Layout 3 columnas + config completa del operador (logo, reloj, promos…).
 */
export default function MenuBoardScreen({
  ready = false,
  loadingText = "Cargando…",
  boardKey = "comidas",
  colLeft = [],
  colRight = [],
  heroPool = [],
  flash = null,
  leftIndexBase = 0,
  rightIndexBase = 0,
}) {
  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const [clock, setClock] = useState(() => new Date());
  const [fullCfg, setFullCfg] = useState(null);
  const [boardCfg, setBoardCfg] = useState({
    ...DEFAULT_BOARD,
    showClock: boardKey === "comidas",
  });
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [activeCode, setActiveCode] = useState(null);
  const [cfgVersion, setCfgVersion] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadCfg = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/config/menu-board`);
      if (!res.ok) return;
      const data = await res.json();
      setFullCfg(data);
      const side = data?.[boardKey] || data?.comidas || DEFAULT_BOARD;
      setBoardCfg({
        ...DEFAULT_BOARD,
        showClock: boardKey === "comidas",
        ...side,
        heroTitle: sanitizeHeroTitle(side.heroTitle ?? DEFAULT_BOARD.heroTitle),
      });
      setLayout({ ...DEFAULT_LAYOUT, ...(data.layout || {}) });
    } catch {
      /* defaults */
    }
  }, [boardKey]);

  useEffect(() => {
    loadCfg();
  }, [loadCfg, cfgVersion]);

  useWebSocket("pantallas,all", (ev) => {
    if (ev?.t === "cfg" && (ev.k === "menu_board" || !ev.k)) {
      setCfgVersion((v) => v + 1);
    }
  });

  const onActiveChange = useCallback((p) => {
    setActiveCode(p?.c || null);
  }, []);

  useEffect(() => {
    if (!activeCode) return;
    const safe =
      typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(activeCode)
        : String(activeCode).replace(/["\\]/g, "\\$&");
    const sel = `[data-code="${safe}"]`;
    const el =
      leftScrollRef.current?.querySelector(sel) ||
      rightScrollRef.current?.querySelector(sel);
    if (!el) return;
    const parent = leftScrollRef.current?.contains(el)
      ? leftScrollRef.current
      : rightScrollRef.current;
    if (parent) {
      const er = el.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      if (er.top < pr.top || er.bottom > pr.bottom) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeCode]);

  const leftTitle = boardCfg.showTitles ? boardCfg.leftTitle || "" : "";
  const rightTitle = boardCfg.showTitles ? boardCfg.rightTitle || "" : "";
  const leftSub =
    boardCfg.showSubtitles && colLeft.length ? `1 – ${colLeft.length}` : "";
  const rightSub =
    boardCfg.showSubtitles && colRight.length
      ? `${leftIndexBase + colLeft.length + 1} – ${
          leftIndexBase + colLeft.length + colRight.length
        }`
      : "";

  const leftSlots = boardCfg.leftMaxCards || 5;
  const rightSlots = boardCfg.rightMaxCards || 5;
  const showClock = !!boardCfg.showClock;
  const showMarquee = boardCfg.showMarquee !== false;
  const showLogo = boardCfg.showLogo !== false;
  const logoPx = Math.max(48, Math.min(160, Number(layout.logoSizePx) || 96));
  const logoOutlinePx = Math.max(
    0,
    Math.min(12, Number(layout.logoOutlinePx) || 0)
  );
  const textOutlinePx = Math.max(
    0,
    Math.min(6, Number(layout.textOutlinePx) ?? 1.5)
  );
  const logoAlign = layout.logoAlign === "center" ? "center" : "left";
  const logoFilter = logoOutlineFilter(logoOutlinePx);

  // Tipografías y escala de textos en Smart TVs
  const fontScale = Math.max(
    0.7,
    Math.min(1.6, (Number(layout.fontScale) || 100) / 100)
  );
  const cardNameSizePx = Math.round(
    (Number(layout.cardNameSizePx) || 18) * fontScale
  );
  const cardPriceSizePx = Math.round(
    (Number(layout.cardPriceSizePx) || 22) * fontScale
  );
  const cardNumSizePx = Math.round(
    (Number(layout.cardNumSizePx) || 26) * fontScale
  );
  const heroNameSizePx = Math.round(
    (Number(layout.heroNameSizePx) || 38) * fontScale
  );
  const heroPriceSizePx = Math.round(
    (Number(layout.heroPriceSizePx) || 38) * fontScale
  );
  const heroNumSizePx = Math.round(
    (Number(layout.heroNumSizePx) || 68) * fontScale
  );
  const heroBadgeSizePx = Math.round(
    (Number(layout.heroBadgeSizePx) || 13) * fontScale
  );
  const clockSizePx = Math.round(
    (Number(layout.clockSizePx) || 30) * fontScale
  );
  const marqueeSizePx = Math.round(
    (Number(layout.marqueeSizePx) || 17) * fontScale
  );
  const colTitleSizePx = Math.round(
    (Number(layout.colTitleSizePx) || 24) * fontScale
  );

  const listBoxStyle = useMemo(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      height: "100%",
      boxSizing: "border-box",
    }),
    []
  );

  return (
    <div
      className={`menu-tv-root bg-oak-wood text-ivory ${
        showClock ? "menu-tv-root--with-clock" : "menu-tv-root--no-clock"
      }`}
    >
      <TvFullscreenChrome label="TV de menú" />

      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <p className="text-2xl text-cream/60">{loadingText}</p>
        </div>
      )}

      <div className="menu-tv-board">
        <div
          className={`menu-tv-logo-slot ${
            logoAlign === "center" ? "is-center" : "is-left"
          }`}
          style={{
            ["--logo-size"]: `${logoPx}px`,
            ["--logo-outline"]: `${logoOutlinePx}px`,
          }}
        >
          {showLogo ? (
            <Logo
              variant="tv"
              size="tv"
              className="menu-tv-logo-img"
              style={{ filter: logoFilter }}
            />
          ) : null}
        </div>
        <div className="menu-tv-marquee-slot">
          {showMarquee ? (
            <PromoMarquee
              config={fullCfg}
              intervalMs={layout.marqueeIntervalMs || 5200}
              fontSizePx={marqueeSizePx}
            />
          ) : null}
        </div>
        <div className="menu-tv-clock-slot">
          {showClock ? (
            <p
              className="menu-tv-clock"
              style={{ fontSize: `${clockSizePx}px` }}
            >
              {clock.toLocaleTimeString("es-NI", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </p>
          ) : (
            <span className="menu-tv-clock-placeholder" aria-hidden />
          )}
        </div>

        <MenuBoardPanel
          title={leftTitle}
          subtitle={leftSub}
          titleSizePx={colTitleSizePx}
          className="menu-tv-col menu-tv-col-left h-full min-h-0"
        >
          <div
            ref={leftScrollRef}
            className="scrollbar-none menu-tv-col-scroll"
            data-autoscroll="left"
          >
            <div style={listBoxStyle}>
              {colLeft.map((p, i) => (
                <MenuBoardItem
                  key={p.id || p.c || i}
                  p={p}
                  index={leftIndexBase + i}
                  flash={flash === p.c}
                  active={activeCode === p.c}
                  dense
                  maxSlots={leftSlots}
                  textOutlinePx={textOutlinePx}
                  nameSizePx={cardNameSizePx}
                  priceSizePx={cardPriceSizePx}
                  numSizePx={cardNumSizePx}
                />
              ))}
              {ready && !colLeft.length && (
                <p className="py-8 text-center text-cream/45">Sin ítems</p>
              )}
            </div>
          </div>
        </MenuBoardPanel>

        <div className="menu-tv-hero min-h-0">
          <MenuBoardHero
            products={heroPool}
            intervalMs={boardCfg.heroIntervalMs || 5000}
            title={sanitizeHeroTitle(boardCfg.heroTitle)}
            includeAgotados={false}
            onActiveChange={onActiveChange}
            textOutlinePx={textOutlinePx}
            nameSizePx={heroNameSizePx}
            priceSizePx={heroPriceSizePx}
            numSizePx={heroNumSizePx}
            badgeSizePx={heroBadgeSizePx}
          />
        </div>

        <MenuBoardPanel
          title={rightTitle}
          subtitle={rightSub}
          titleSizePx={colTitleSizePx}
          className="menu-tv-col menu-tv-col-right h-full min-h-0"
        >
          <div
            ref={rightScrollRef}
            className="scrollbar-none menu-tv-col-scroll"
            data-autoscroll="right"
          >
            <div style={listBoxStyle}>
              {colRight.map((p, i) => (
                <MenuBoardItem
                  key={p.id || p.c || i}
                  p={p}
                  index={rightIndexBase + i}
                  flash={flash === p.c}
                  active={activeCode === p.c}
                  dense
                  maxSlots={rightSlots}
                  textOutlinePx={textOutlinePx}
                  nameSizePx={cardNameSizePx}
                  priceSizePx={cardPriceSizePx}
                  numSizePx={cardNumSizePx}
                />
              ))}
            </div>
          </div>
        </MenuBoardPanel>
      </div>
    </div>
  );
}
