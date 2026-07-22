import { useEffect, useState } from "react";
import { getFicoshaBanner } from "../../lib/promociones";
import { API_URL } from "../../lib/constants";
import { useWebSocket } from "../../hooks/useWebSocket";

/**
 * Banner de alianza / promos en publicidad — textos desde config.
 */
export default function FicoshaBanner() {
  const [cfg, setCfg] = useState(null);
  const [ver, setVer] = useState(0);

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

  return (
    <div className="ficosha-banner" role="note">
      <span className="ficosha-banner-icon" aria-hidden>
        {banner.icon || "💳"}
      </span>
      <div className="ficosha-banner-body">
        <span className="ficosha-banner-tag">
          {banner.tag || cfg?.layout?.ficoshaTag || "Alianza Ficosha"}
        </span>
        <span className="ficosha-banner-text">{banner.corto}</span>
      </div>
      <span className="ficosha-banner-badge">−35%</span>
    </div>
  );
}
