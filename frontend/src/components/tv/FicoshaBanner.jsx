import { useEffect, useState } from "react";
import { getFicoshaBanner } from "../../lib/promociones";
import { API_URL } from "../../lib/constants";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useAmbientUiConfig } from "../../hooks/useAmbientUiConfig";
import OverflowMarquee from "../OverflowMarquee";

/**
 * Banner de alianza / promos en publicidad — textos desde config menú board.
 * Marquesina si el texto no cabe (config ambiente).
 */
export default function FicoshaBanner() {
  const [cfg, setCfg] = useState(null);
  const [ver, setVer] = useState(0);
  const { cfg: amb } = useAmbientUiConfig();
  const marqueeOn = amb.banner_marquee_enabled !== false;
  const marqueeSpeed = Number(amb.banner_marquee_speed_px_s) || 42;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/config/menu-board`);
        if (!res.ok || !alive) return;
        setCfg(await res.json());
      } catch {
        /* defaults */
      }
    })();
    return () => {
      alive = false;
    };
  }, [ver]);

  useWebSocket("pantallas,all", (ev) => {
    if (ev?.t === "cfg") setVer((v) => v + 1);
  });

  if (cfg?.layout?.showFicoshaOnPublicidad === false) return null;
  const banner = getFicoshaBanner(cfg);
  if (!banner) return null;

  const text = banner.corto || "";
  const tag = banner.tag || cfg?.layout?.ficoshaTag || "Alianza Ficosha";

  return (
    <div className="ficosha-banner" role="note">
      <span className="ficosha-banner-icon" aria-hidden>
        {banner.icon || "💳"}
      </span>
      <div className="ficosha-banner-body">
        <span className="ficosha-banner-tag">{tag}</span>
        <OverflowMarquee
          className="ficosha-banner-text"
          enabled={marqueeOn}
          speedPxS={marqueeSpeed}
          title={text}
        >
          {text}
        </OverflowMarquee>
      </div>
      <span className="ficosha-banner-badge">−35%</span>
    </div>
  );
}
