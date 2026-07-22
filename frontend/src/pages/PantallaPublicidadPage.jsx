import { useCallback, useEffect, useMemo, useState } from "react";
import MensajesDinamicosBanner from "../components/MensajesDinamicosBanner";
import FicoshaBanner from "../components/tv/FicoshaBanner";
import TvFullscreenChrome from "../components/tv/TvFullscreenChrome";
import { useWebSocket } from "../hooks/useWebSocket";
import { API_URL } from "../lib/api";
import { LOGO_URL } from "../lib/constants";

const ALL_EFFECTS = [
  "zoom-in",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "giro-3d",
  "persiana",
  "scale-soft",
  "blur",
  "flip-h",
];

/**
 * TV publicidad dinámica por zona independiente (TV3–TV6).
 * @param {{ zona: string, tituloZona?: string }} props
 */
export default function PantallaPublicidadPage({
  zona,
  tituloZona = "Publicidad",
}) {
  const [campana, setCampana] = useState(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [activeEffect, setActiveEffect] = useState("fade");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/publicidad/${zona}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCampana(data);
      setError("");
      setIndex(0);
      setActiveEffect(data.efecto_visual || "fade");
    } catch (e) {
      setError(e.message || "No se pudo cargar la campaña");
    }
  }, [zona]);

  useEffect(() => {
    load();
  }, [load, version]);

  const onWs = useCallback(
    (ev) => {
      if (ev?.t === "pub" && String(ev.zona).toUpperCase() === zona) {
        setVersion((v) => v + 1);
      }
    },
    [zona]
  );

  useWebSocket("pantallas,all", onWs);

  const slides = useMemo(() => {
    const list = campana?.slides || [];
    return list.filter((s) => s.imagen_url || s.texto_principal);
  }, [campana]);

  const duration = Math.max(2000, Number(campana?.duracion_slide) || 7000);
  const randomFx = !!campana?.efectos_aleatorios;
  const mostrarLogo = campana?.mostrar_logo !== false;
  const mostrarMensajes = campana?.mostrar_mensajes !== false;
  const mensajes = campana?.mensajes || [];
  const duracionMensaje = Number(campana?.duracion_mensaje) || 9000;
  const tamano = campana?.tamano_fuente || "mediano";
  const slide = slides[index] || null;

  useEffect(() => {
    if (!slides.length) return undefined;

    const pickEffect = () => {
      if (randomFx) {
        return ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)];
      }
      return campana?.efecto_visual || "fade";
    };

    // efecto inicial
    setActiveEffect(pickEffect());

    const id = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setActiveEffect(pickEffect());
        setIndex((i) => (i + 1) % slides.length);
        setVisible(true);
      }, 420);
    }, duration);
    return () => clearInterval(id);
  }, [slides.length, duration, version, randomFx, campana?.efecto_visual]);

  if (error && !campana) {
    return (
      <div className="bg-oak-wood flex h-screen items-center justify-center text-ivory">
        <p className="text-2xl text-rose-300">{error}</p>
      </div>
    );
  }

  if (!slide) {
    return (
      <div className="bg-oak-wood flex h-screen items-center justify-center text-ivory">
        <div className="text-center">
          {mostrarLogo && (
            <img src={LOGO_URL} alt="" className="mx-auto h-24 w-24 rounded-full" />
          )}
          <p className="mt-4 font-display text-3xl">
            El Callejón · {tituloZona}
          </p>
          <p className="mt-2 text-cream/60">Sin diapositivas configuradas</p>
        </div>
      </div>
    );
  }

  const titleClass = fontTitleClass(tamano);
  const subClass = fontSubClass(tamano);
  const textFx = effectClasses(activeEffect, visible);
  const imgFx = imageEffectClass(activeEffect, visible && true);

  return (
    <div
      className="bg-oak-wood relative overflow-hidden text-ivory"
      style={{
        height: "var(--app-height, 100vh)",
        maxHeight: "var(--app-height, 100vh)",
      }}
    >
      <TvFullscreenChrome label="TV de publicidad" />
      {slides.map((s, i) => (
        <div
          key={`${s.id || i}-${s.imagen_url}`}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          <img
            src={withCache(s.imagen_url, version)}
            alt=""
            className={`h-full w-full object-cover ${
              i === index ? imgFx : ""
            }`}
            onError={(e) => {
              e.currentTarget.src = "/images/slides/slide1-buffet.jpg";
            }}
          />
          {/* Persiana overlay */}
          {i === index && activeEffect === "persiana" && (
            <div
              className={`pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_18px,rgba(0,0,0,0.55)_18px_22px)] transition-opacity duration-700 ${
                visible ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/25" />
        </div>
      ))}

      {mostrarLogo && (
        <div className="absolute left-8 top-8 z-20 flex items-center gap-4">
          <img
            src={LOGO_URL}
            alt="El Callejón"
            className="h-20 w-20 rounded-full object-cover shadow-2xl ring-4 ring-amber-400/50"
          />
          <div>
            <p className="font-display text-3xl text-amber-100 drop-shadow-lg">
              El Callejón
            </p>
            <p className="text-lg text-white/75">{tituloZona}</p>
          </div>
        </div>
      )}

      <div className="relative z-20 flex h-full flex-col items-center justify-center px-10 text-center">
        <div className={`max-w-5xl ${textFx}`}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300/90">
            Buffet-Restaurante · León
          </p>
          <h1
            className={`font-display font-bold leading-tight text-white drop-shadow-xl ${titleClass}`}
          >
            {slide.texto_principal || "El Callejón"}
          </h1>
          <p className={`font-display mt-3 italic text-amber-100/95 ${subClass}`}>
            {slide.texto_secundario || ""}
          </p>
        </div>
      </div>

      {/* Alianza Ficosha siempre visible en publicidad */}
      <FicoshaBanner />

      <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-3">
        {slides.map((s, i) => (
          <button
            key={s.id || i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => {
              setVisible(false);
              setTimeout(() => {
                if (randomFx) {
                  setActiveEffect(
                    ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)]
                  );
                }
                setIndex(i);
                setVisible(true);
              }, 200);
            }}
            className={`h-3 rounded-full transition-all duration-300 ${
              i === index ? "w-12 bg-amber-400" : "w-3 bg-white/40"
            }`}
          />
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 h-1.5 bg-white/10">
        <div
          key={`${index}-${duration}-${version}-${activeEffect}`}
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          style={{ animation: `progressBar ${duration}ms linear forwards` }}
        />
      </div>

      {mostrarMensajes && (
        <MensajesDinamicosBanner
          mensajes={mensajes}
          duracionMs={duracionMensaje}
          enabled={mostrarMensajes}
        />
      )}

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes flipH {
          from { transform: rotateY(90deg); opacity: 0.2; }
          to { transform: rotateY(0deg); opacity: 1; }
        }
        @keyframes giro3d {
          from { transform: perspective(800px) rotateY(-35deg) scale(0.92); opacity: 0; }
          to { transform: perspective(800px) rotateY(0deg) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function withCache(url, version) {
  if (!url) return "/images/slides/slide1-buffet.jpg";
  if (!version) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${version}`;
}

function fontTitleClass(tamano) {
  if (tamano === "pequeno") return "text-3xl md:text-4xl lg:text-5xl";
  if (tamano === "grande") return "text-6xl md:text-7xl lg:text-8xl";
  return "text-5xl md:text-6xl lg:text-7xl";
}

function fontSubClass(tamano) {
  if (tamano === "pequeno") return "text-xl md:text-2xl";
  if (tamano === "grande") return "text-4xl md:text-5xl";
  return "text-2xl md:text-3xl lg:text-4xl";
}

function effectClasses(efecto, visible) {
  const base = "transition-all duration-500 ease-out";
  if (!visible) {
    switch (efecto) {
      case "slide-left":
        return `${base} opacity-0 translate-x-12`;
      case "slide-right":
        return `${base} opacity-0 -translate-x-12`;
      case "slide-up":
        return `${base} opacity-0 translate-y-10`;
      case "zoom-in":
      case "scale-soft":
        return `${base} opacity-0 scale-90`;
      case "blur":
        return `${base} opacity-0 blur-md`;
      case "giro-3d":
      case "flip-h":
      case "persiana":
        return `${base} opacity-0`;
      default:
        return `${base} opacity-0 translate-y-4`;
    }
  }
  switch (efecto) {
    case "slide-left":
    case "slide-right":
    case "slide-up":
      return `${base} opacity-100 translate-x-0 translate-y-0`;
    case "zoom-in":
    case "scale-soft":
      return `${base} opacity-100 scale-100`;
    case "blur":
      return `${base} opacity-100 blur-0`;
    case "giro-3d":
      return "opacity-100 animate-[giro3d_0.55s_ease-out_both]";
    case "flip-h":
      return "opacity-100 animate-[flipH_0.55s_ease-out_both]";
    case "persiana":
      return `${base} opacity-100`;
    default:
      return `${base} opacity-100 translate-y-0`;
  }
}

function imageEffectClass(efecto, active) {
  if (!active) return "";
  if (efecto === "zoom-in") return "kenburns";
  if (efecto === "scale-soft") return "transition-transform duration-[7000ms] scale-105";
  if (efecto === "blur") return "transition-all duration-700";
  return "";
}
