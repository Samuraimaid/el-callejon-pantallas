import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MensajesDinamicosBanner from "../components/MensajesDinamicosBanner";
import FicoshaBanner from "../components/tv/FicoshaBanner";
import NowPlayingBanner from "../components/tv/NowPlayingBanner";
import TvFullscreenChrome from "../components/tv/TvFullscreenChrome";
import TvRuntimeShell from "../components/tv/TvRuntimeShell";
import { useAmbientUiConfig } from "../hooks/useAmbientUiConfig";
import { useVideoTurn } from "../hooks/useVideoTurn";
import { useWebSocket } from "../hooks/useWebSocket";
import { API_URL } from "../lib/api";
import { LOGO_URL } from "../lib/constants";
import { resolveLocalUrl } from "../lib/tvMediaCache";
import { CACHE_KEYS, cacheGetData, cacheSet } from "../lib/tvCache";

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

const TV_BY_ZONA = {
  TV3: 3,
  TV4: 4,
  TV5: 5,
  TV6: 6,
  BARRA_BEBIDAS: 3,
  SALON_VIP: 5,
};

const FALLBACK_SLIDES = {
  TV3: [
    { id: "fb3-1", imagen_url: "/images/slides/slide8-barra.jpg", texto_principal: "Barra de licores", texto_secundario: "Cócteles, cerveza y premium" },
    { id: "fb3-2", imagen_url: "/images/bebidas/jugos-naturales.jpg", texto_principal: "Bebidas naturales", texto_secundario: "Jugos frescos elaborados al instante" },
    { id: "fb3-3", imagen_url: "/images/slides/slide-camarones.jpg", texto_principal: "Camarones al ajillo", texto_secundario: "Porción generosa de la casa" },
    { id: "fb3-4", imagen_url: "/images/slides/slide5-bienvenidos.jpg", texto_principal: "¡Bienvenidos!", texto_secundario: "El sabor que forma parte de tu historia" },
  ],
  TV4: [
    { id: "fb4-1", imagen_url: "/images/slides/slide-costilla-bbq.jpg", texto_principal: "Costilla BBQ", texto_secundario: "Sabor ahumado que se recuerda" },
    { id: "fb4-2", imagen_url: "/images/slides/slide-asados-1.jpg", texto_principal: "A la parrilla", texto_secundario: "Asados con sazón de León" },
    { id: "fb4-3", imagen_url: "/images/slides/slide-asados-2.jpg", texto_principal: "El sabor de la casa", texto_secundario: "Platillos calientes recién preparados" },
    { id: "fb4-4", imagen_url: "/images/slides/slide-brochetas.jpg", texto_principal: "Brochetas", texto_secundario: "Parrilla y buena compañía" },
    { id: "fb4-5", imagen_url: "/images/slides/slide-pollo-salsa.jpg", texto_principal: "Pollo en salsa", texto_secundario: "Tradición de la casa en cada bocado" },
  ],
  TV5: [
    { id: "fb5-1", imagen_url: "/images/slides/slide3-salon.jpg", texto_principal: "Disfruta tu almuerzo", texto_secundario: "en nuestro ambiente climatizado VIP" },
    { id: "fb5-2", imagen_url: "/images/slides/slide7-familia.jpg", texto_principal: "Donde cada plato se siente", texto_secundario: "como en casa" },
    { id: "fb5-3", imagen_url: "/images/slides/slide2-ambiente.jpg", texto_principal: "Un espacio pensado", texto_secundario: "para disfrutar cada momento" },
    { id: "fb5-4", imagen_url: "/images/slides/slide5-bienvenidos.jpg", texto_principal: "El Callejón VIP", texto_secundario: "León, Nicaragua" },
  ],
  TV6: [
    { id: "fb6-1", imagen_url: "/images/slides/slide-pescado.jpg", texto_principal: "Pescado fresco", texto_secundario: "Preparado al momento, para llevar o disfrutar aquí" },
    { id: "fb6-2", imagen_url: "/images/slides/slide-pollo-salsa.jpg", texto_principal: "Pollo en salsa", texto_secundario: "Sabor tradicional de El Callejón" },
    { id: "fb6-3", imagen_url: "/images/slides/slide-camarones.jpg", texto_principal: "Camarones", texto_secundario: "Al ajillo o empanizados, siempre frescos" },
    { id: "fb6-4", imagen_url: "/images/slides/slide-costilla-bbq.jpg", texto_principal: "Costilla ahumada", texto_secundario: "Suave, jugosa y con salsa especial" },
  ],
};

/**
 * TV publicidad: cache local + video + animaciones de texto + runtime industrial.
 */
export default function PantallaPublicidadPage({
  zona,
  tituloZona = "Publicidad",
  tvId: tvIdProp,
}) {
  const tvId = tvIdProp || TV_BY_ZONA[zona] || 3;
  const cacheKey = CACHE_KEYS.campana(zona);
  const cached = cacheGetData(cacheKey);
  const [searchParams] = useSearchParams();
  const urlLite =
    searchParams.get("lite") === "1" ||
    searchParams.get("basic") === "1" ||
    searchParams.get("ram") === "low" ||
    searchParams.get("basico") === "1";
  const { cfg: ambientCfg } = useAmbientUiConfig();
  /** Modo Smart TV básico: solo imagenes fijas por 20s, omitir videos, bajo consumo RAM */
  const liteMode = urlLite || !!ambientCfg?.publicidad_lite_mode;

  const [campana, setCampana] = useState(cached || null);
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
      cacheSet(cacheKey, data);
      setError("");
      setIndex(0);
      setActiveEffect(data.efecto_visual || "fade");
    } catch (e) {
      if (!cacheGetData(cacheKey)) {
        setError(e.message || "No se pudo cargar la campaña");
      }
      // si hay cache, seguir offline
    }
  }, [zona, cacheKey]);

  useEffect(() => {
    load();
  }, [load, version]);

  const onWs = useCallback(
    (ev) => {
      if (ev?.t === "pub" && String(ev.zona).toUpperCase() === String(zona).toUpperCase()) {
        setVersion((v) => v + 1);
      }
    },
    [zona]
  );

  useWebSocket("pantallas,all", onWs);

  // Turno de video 1-a-1: en modo Smart TV básico se desactiva totalmente para ahorrar RAM
  const { turn: videoTurn, markDone: markVideoDone, hasVideoTurn } =
    useVideoTurn(tvId, { enabled: !liteMode });

  // Carrusel autónomo: SOLO fotografías (videos van por turno del servidor y en liteMode se omiten)
  const slides = useMemo(() => {
    const list = campana?.slides || [];
    const photos = list.filter(
      (s) =>
        s.imagen_url &&
        s.media_tipo !== "video" &&
        !s.video_url
    );
    if (photos.length) return photos;
    // fallback 1: slides con texto aunque falte imagen (solo no-video)
    const texts = list.filter(
      (s) => s.texto_principal && s.media_tipo !== "video" && !s.video_url
    );
    if (texts.length) return texts;
    // fallback 2: diapositivas de respaldo por zona (Parrilla, VIP, Barra)
    return FALLBACK_SLIDES[zona] || FALLBACK_SLIDES.TV4 || [];
  }, [campana, zona]);

  // En modo Smart TV básico: rotación exactamente cada 20 segundos (ahorro crítico de memoria)
  const duration = liteMode
    ? 20000
    : Math.max(2000, Number(campana?.duracion_slide) || 7000);
  const randomFx = !!campana?.efectos_aleatorios;
  const mostrarLogo = campana?.mostrar_logo !== false;
  const mostrarMensajes = campana?.mostrar_mensajes !== false;
  const mensajes = campana?.mensajes || [];
  const duracionMensaje = Number(campana?.duracion_mensaje) || 9000;
  const tamano = campana?.tamano_fuente || "mediano";
  const slide = slides[index] || null;

  useEffect(() => {
    if (!slides.length || hasVideoTurn) return undefined;

    // Modo lite: cambio de imagen directo, sin fade ni efectos
    if (liteMode) {
      setActiveEffect("none");
      setVisible(true);
      const id = setInterval(() => {
        setIndex((i) => (i + 1) % slides.length);
      }, duration);
      return () => clearInterval(id);
    }

    const pickEffect = () => {
      if (randomFx) {
        return ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)];
      }
      return campana?.efecto_visual || "fade";
    };
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
  }, [
    slides,
    index,
    duration,
    version,
    randomFx,
    campana?.efecto_visual,
    hasVideoTurn,
    liteMode,
  ]);

  const snapshotExtra = useCallback(() => {
    const s = slides[index] || slides[0];
    const preview =
      (hasVideoTurn && videoTurn?.video_url
        ? s?.imagen_url || "/images/slides/slide5-bienvenidos.jpg"
        : null) ||
      s?.imagen_url ||
      s?.video_url ||
      "/images/slides/slide5-bienvenidos.jpg";
    return {
      screen: "publicidad",
      zona,
      slide: index,
      n_slides: slides.length,
      media: hasVideoTurn ? "video" : "image",
      video_turn: hasVideoTurn,
      display_ready: slides.length > 0 || !!campana,
      preview_url: String(preview).split("?")[0],
      label: s?.texto_principal || zona,
    };
  }, [zona, index, slides, hasVideoTurn, videoTurn, campana]);

  const body = (() => {
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
              <img
                src={LOGO_URL}
                alt=""
                className="mx-auto h-24 w-auto object-contain"
              />
            )}
            <p className="mt-4 font-display text-3xl">
              El Callejón · {tituloZona}
            </p>
            <p className="mt-2 text-cream/60">Sin diapositivas configuradas</p>
          </div>
        </div>
      );
    }

    const slideTam = slide.tamano_texto || tamano;
    const titleClass = fontTitleClass(slideTam);
    const subClass = fontSubClass(slideTam);
    const textAnim = liteMode
      ? "opacity-100"
      : textAnimClass(slide.animacion_texto || "fade-in-up", visible);
    const imgFx = liteMode ? "" : imageEffectClass(activeEffect, visible);

    return (
      <div
        className="bg-oak-wood relative overflow-hidden text-ivory"
        style={{
          height: "var(--app-height, 100vh)",
          maxHeight: "var(--app-height, 100vh)",
        }}
      >
        <TvFullscreenChrome label="TV de publicidad" />

        {/* Turno de video 1-a-1: SOLO si NO está en modo Smart TV básico */}
        {!liteMode && hasVideoTurn && videoTurn?.video_url && (
          <div className="absolute inset-0 z-30 bg-black">
            <video
              key={videoTurn.token || videoTurn.video_url}
              src={videoTurn.video_url}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              onLoadedData={(e) => {
                const v = e.currentTarget;
                v.play?.().catch(() => {
                  v.muted = true;
                  v.play?.().catch(() => {});
                });
                // Watchdog: no quedarse en negro si el video se cuelga
                const maxMs = Math.min(
                  180000,
                  Math.max(20000, ((v.duration || 60) + 8) * 1000)
                );
                window.clearTimeout(v._tvWatchdog);
                v._tvWatchdog = window.setTimeout(() => {
                  markVideoDone();
                }, maxMs);
              }}
              onEnded={(e) => {
                window.clearTimeout(e.currentTarget._tvWatchdog);
                markVideoDone();
              }}
              onError={(e) => {
                window.clearTimeout(e.currentTarget._tvWatchdog);
                markVideoDone();
              }}
            />
            <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1 text-xs text-amber-100/90">
              Video en turno · solo esta pantalla
            </p>
          </div>
        )}

        {/* Indicador discreto para Smart TV básico */}
        {liteMode && (
          <div className="pointer-events-none absolute right-5 top-5 z-30 rounded-full border border-amber-500/40 bg-stone-950/80 px-3 py-1 text-[11px] font-semibold text-amber-300 shadow-md">
            ⚡ Smart TV Básico · 20s · Solo fotos
          </div>
        )}

        {/* Renderizado de diapositivas: En modo lite SOLO montamos el slide ACTIVO (ahorro crítico de memoria RAM) */}
        {liteMode ? (
          <div
            key={`${slide.id || index}-${slide.imagen_url}`}
            className="absolute inset-0"
          >
            <MediaCover
              url={slide.imagen_url}
              active={true}
              imgFx=""
              liteMode={true}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />
          </div>
        ) : (
          slides.map((s, i) => (
            <div
              key={`${s.id || i}-${s.imagen_url}`}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === index && !hasVideoTurn ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={i !== index || hasVideoTurn}
            >
              <MediaCover
                url={s.imagen_url}
                active={i === index && !hasVideoTurn}
                imgFx={imgFx}
                liteMode={false}
              />
              {i === index && activeEffect === "persiana" && (
                <div
                  className={`pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_18px,rgba(0,0,0,0.55)_18px_22px)] transition-opacity duration-700 ${
                    visible ? "opacity-0" : "opacity-100"
                  }`}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />
            </div>
          ))
        )}

        {mostrarLogo && (
          <div className="absolute left-8 top-8 z-20 flex items-center gap-4">
            <img
              src={LOGO_URL}
              alt="El Callejón"
              className="h-20 w-auto object-contain drop-shadow-xl"
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
          <div className={`max-w-5xl ${textAnim}`}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-amber-300/90">
              Buffet-Restaurante · León
            </p>
            <h1
              className={`font-display font-bold leading-tight text-white drop-shadow-xl ${titleClass}`}
            >
              {slide.texto_principal || "El Callejón"}
            </h1>
            <p
              className={`font-display mt-3 italic text-amber-100/95 ${subClass}`}
            >
              {slide.texto_secundario || ""}
            </p>
          </div>
        </div>

        {/* Promociones: arriba a la derecha */}
        <FicoshaBanner />

        {/* Puntos de slide: abajo centro */}
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-3">
          {slides.map((s, i) => (
            <button
              key={s.id || i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => {
                setIndex(i);
                setVisible(true);
              }}
              className={`h-3 rounded-full transition-all duration-300 ${
                i === index ? "w-12 bg-amber-400" : "w-3 bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Sabías qué / Chef: abajo derecha */}
        {mostrarMensajes && (
          <div className="pub-banners-br">
            <MensajesDinamicosBanner
              mensajes={mensajes}
              duracionMs={duracionMensaje}
              enabled={mostrarMensajes}
            />
          </div>
        )}

        {/* Ahora suena: abajo izquierda, solo 5s al inicio de canción */}
        <div className="pub-banners-bl">
          <NowPlayingBanner enabled />
        </div>
      </div>
    );
  })();

  return (
    <TvRuntimeShell tvId={tvId} snapshotExtra={snapshotExtra}>
      {body}
    </TvRuntimeShell>
  );
}

/** Imagen con letterbox / blur; en modo lite se desactiva blur-2xl y transformaciones pesadas */
function MediaCover({ url, active, imgFx, liteMode = false }) {
  const [vertical, setVertical] = useState(false);
  const [src, setSrc] = useState(url || "/images/slides/slide1-buffet.jpg");

  useEffect(() => {
    let alive = true;
    const fallback = url || "/images/slides/slide1-buffet.jpg";
    setSrc(fallback);
    resolveLocalUrl(fallback).then((u) => {
      if (alive && u) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="absolute inset-0 bg-black">
      {!liteMode && vertical && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          aria-hidden
        />
      )}
      <img
        src={src}
        alt=""
        decoding={liteMode ? "async" : "auto"}
        className={`absolute inset-0 h-full w-full ${
          vertical ? "object-contain" : "object-cover"
        } ${active && !liteMode ? imgFx : ""}`}
        onLoad={(e) => {
          if (!liteMode) {
            const im = e.currentTarget;
            setVertical(im.naturalHeight > im.naturalWidth * 1.12);
          }
        }}
        onError={(e) => {
          e.currentTarget.src = "/images/slides/slide1-buffet.jpg";
        }}
      />
    </div>
  );
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

function textAnimClass(anim, visible) {
  if (!visible) return "opacity-0";
  switch (anim) {
    case "bounce":
      return "anim-txt-bounce";
    case "marquee":
      return "anim-txt-marquee";
    case "slide-left":
      return "anim-txt-slide-left";
    case "zoom":
      return "anim-txt-zoom";
    case "fade":
      return "anim-txt-fade";
    case "none":
      return "opacity-100";
    case "fade-in-up":
    default:
      return "anim-txt-fade-in-up";
  }
}

function imageEffectClass(efecto, active) {
  if (!active) return "";
  if (!efecto || efecto === "none" || efecto === "lite") return "";
  if (efecto === "zoom-in") return "kenburns";
  if (efecto === "scale-soft")
    return "transition-transform duration-[7000ms] scale-105";
  return "";
}
