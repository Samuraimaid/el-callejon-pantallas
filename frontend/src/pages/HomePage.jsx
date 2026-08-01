import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { API_URL, LOGO_URL, getPublicOrigin } from "../lib/constants";

/**
 * Enlaces cortos /tv/N — cada Smart TV guarda su favorito.
 */
const SCREENS = [
  { to: "/tv/1", num: "1", label: "Menú Comidas" },
  { to: "/tv/2", num: "2", label: "Complementos" },
  { to: "/tv/3", num: "3", label: "Publicidad Barra" },
  { to: "/tv/4", num: "4", label: "Publicidad Parrilla" },
  { to: "/tv/5", num: "5", label: "VIP Ambiente" },
  { to: "/tv/6", num: "6", label: "VIP Platillos" },
];

function isLoopbackHost(hostname) {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  if (ip.startsWith("192.168.") || ip.startsWith("10.")) return true;
  if (ip.startsWith("172.")) {
    const n = Number(ip.split(".")[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

/** WebRTC: IPs locales del navegador (útil en el PC servidor). */
function detectBrowserLanIps(timeoutMs = 700) {
  return new Promise((resolve) => {
    const ips = new Set();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        pc.close();
      } catch {
        /* */
      }
      resolve([...ips]);
    };

    let pc;
    try {
      const RTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
      if (!RTC) {
        resolve([]);
        return;
      }
      pc = new RTC({ iceServers: [] });
      pc.createDataChannel("lan");
      pc.onicecandidate = (e) => {
        if (!e?.candidate?.candidate) return;
        const m = e.candidate.candidate.match(
          /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/
        );
        if (m && isPrivateIp(m[1]) && !m[1].startsWith("127.")) {
          ips.add(m[1]);
        }
      };
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .catch(() => finish());
      window.setTimeout(finish, timeoutMs);
    } catch {
      resolve([]);
    }
  });
}

function pickBestIp(candidates) {
  const list = (candidates || []).filter(isPrivateIp);
  if (!list.length) return null;
  list.sort((a, b) => {
    const score = (ip) =>
      ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2;
    return score(a) - score(b) || a.localeCompare(b);
  });
  return list[0];
}

export default function HomePage() {
  const browserOrigin = getPublicOrigin();
  const [hubOrigin, setHubOrigin] = useState(browserOrigin);
  const [lanIp, setLanIp] = useState(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function resolveHub() {
      const port =
        typeof window !== "undefined" ? window.location.port || "5173" : "5173";
      const browserHost =
        typeof window !== "undefined" ? window.location.hostname : "localhost";

      // Si ya se abrió por IP LAN, usarla
      if (!isLoopbackHost(browserHost) && isPrivateIp(browserHost)) {
        if (!cancelled) {
          setLanIp(browserHost);
          setHubOrigin(browserOrigin);
        }
        return;
      }

      const candidates = [];

      // Backend /red (puede devolver LAN_IP del host o IP del contenedor)
      try {
        const res = await fetch(`${API_URL}/red`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.ip_preferida) candidates.push(data.ip_preferida);
          for (const ip of data.ips || []) candidates.push(ip);
          if (data.hub_url && !isLoopbackHost(new URL(data.hub_url).hostname)) {
            // prefer full hub from API if non-loopback
          }
        }
      } catch {
        /* offline */
      }

      // WebRTC en el navegador del PC
      try {
        const rtcIps = await detectBrowserLanIps();
        candidates.push(...rtcIps);
      } catch {
        /* */
      }

      const best = pickBestIp(candidates);
      if (cancelled) return;

      if (best) {
        setLanIp(best);
        setHubOrigin(`http://${best}:${port}`);
      } else {
        setLanIp(null);
        setHubOrigin(browserOrigin);
      }
    }

    resolveHub();
    return () => {
      cancelled = true;
    };
  }, [browserOrigin]);

  const showLanHint = useMemo(() => {
    try {
      return isLoopbackHost(new URL(hubOrigin).hostname);
    } catch {
      return true;
    }
  }, [hubOrigin]);

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="bg-oak-wood relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 text-ivory sm:p-6">
      {/* Marca de agua — logo El Callejón */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        aria-hidden
      >
        <img
          src={LOGO_URL}
          alt=""
          className="h-[min(88vh,720px)] w-[min(88vw,720px)] max-w-none select-none object-contain opacity-[0.07] mix-blend-screen"
          draggable={false}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-4">
        {/* Cabecera compacta */}
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <Logo size="md" showText={false} />
          <h1 className="font-display text-center text-2xl text-ivory sm:text-left sm:text-3xl">
            El Callejón · Pantallas
          </h1>
        </div>

        {/* IP / hub — una sola tarjeta clara */}
        <div className="panel-oak w-full rounded-2xl border border-amber-400/30 bg-black/35 px-4 py-3 backdrop-blur-[2px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
                Hub en la red local
              </p>
              <p className="mt-1 break-all font-mono text-lg text-ivory sm:text-xl">
                {hubOrigin}
              </p>
              {lanIp && (
                <p className="mt-0.5 text-xs text-emerald-300/80">
                  IP del servidor: <span className="font-mono">{lanIp}</span>
                </p>
              )}
              {showLanHint && (
                <p className="mt-1 text-xs text-amber-200/70">
                  Si las TVs no cargan, use la IPv4 del PC (ipconfig) o defina{" "}
                  <span className="font-mono">LAN_IP</span> en el servidor.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => copyText(hubOrigin, "hub")}
              className="tap shrink-0 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100"
            >
              {copied === "hub" ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        </div>

        <Link
          to="/login"
          className="tap w-full rounded-2xl bg-gradient-to-r from-[#a33a28] to-[#d4a84b] py-3.5 text-center text-lg font-bold text-[#1a120c] shadow-lg"
        >
          Centro de Control
        </Link>

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/75">
          Elija la pantalla de este televisor
        </p>

        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {SCREENS.map((s) => {
            const full = `${hubOrigin}${s.to}`;
            return (
              <div
                key={s.to}
                className="panel-oak flex flex-col rounded-2xl bg-black/30 px-3 py-3 backdrop-blur-[1px] transition hover:ring-1 hover:ring-amber-400/35"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#a33a28]/90 to-[#d4a84b]/80 font-display text-xl font-bold text-[#1a120c] shadow">
                    {s.num}
                  </span>
                  <Link
                    to={s.to}
                    className="tap min-w-0 flex-1 text-base font-semibold leading-snug text-ivory hover:text-amber-200"
                  >
                    {s.label}
                  </Link>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <Link
                    to={s.to}
                    className="tap flex-1 rounded-lg bg-amber-500/25 px-2 py-2 text-center text-xs font-bold text-amber-100"
                  >
                    Abrir
                  </Link>
                  <button
                    type="button"
                    onClick={() => copyText(full, s.to)}
                    className="tap rounded-lg border border-stone-600/80 px-3 py-2 text-xs text-cream/80"
                    title={full}
                  >
                    {copied === s.to ? "✓" : "Copiar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="max-w-lg text-center text-[11px] leading-relaxed text-cream/45">
          En cada Smart TV: abra el hub → pulse su número →{" "}
          <strong className="text-cream/65">Favoritos</strong> o{" "}
          <strong className="text-cream/65">Página de inicio</strong>. Así
          arranca sola y en pantalla completa al primer toque.
        </p>
      </div>
    </div>
  );
}
