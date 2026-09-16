import { useEffect, useState, useMemo } from "react";
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  detectBrowserLanguage,
  buildWhatsAppEventLink,
} from "../lib/landingTranslations";

// Platillos estrella para la animación flotante del Hero
const HERO_FEATURED_DISHES = [
  {
    id: "pollo-salsa",
    nombre: "Pollo en Salsa Criolla",
    tag: "🍗 Especialidad de la Casa",
    imagen: "/images/platillos/pollo-salsa.jpg",
    sabor: "Receta tradicional con 25 años de sazón",
    precioNio: 160,
    precioUsd: 4.5,
  },
  {
    id: "asados-parrilla",
    nombre: "Asados a la Parrilla",
    tag: "🥩 Al Carbón & Leña",
    imagen: "/images/platillos/asados-parrilla.jpg",
    sabor: "Cortes jugosos marinados al estilo leonés",
    precioNio: 190,
    precioUsd: 5.2,
  },
  {
    id: "camarones-ajillo",
    nombre: "Camarones al Ajillo",
    tag: "🍤 Mariscos Gourmet",
    imagen: "/images/platillos/camarones-ajillo.jpg",
    sabor: "Frescura del Pacífico salteada en ajo y mantequilla",
    precioNio: 240,
    precioUsd: 6.5,
  },
  {
    id: "costilla-bbq",
    nombre: "Costilla BBQ Glaseada",
    tag: "🔥 Tierna & Caramelizada",
    imagen: "/images/platillos/costilla-bbq.jpg",
    sabor: "Cocción lenta con salsa barbacoa artesanal",
    precioNio: 210,
    precioUsd: 5.8,
  },
];

export default function LandingPage() {
  const [lang, setLang] = useState(() => detectBrowserLanguage());
  const [currency, setCurrency] = useState("NIO"); // NIO | USD
  const [showPrices, setShowPrices] = useState(true);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [heroDishIdx, setHeroDishIdx] = useState(0);

  // Formulario de cotización de eventos
  const [quoteForm, setQuoteForm] = useState({
    name: "",
    type: "boda",
    date: "",
    guests: "50",
    notes: "",
  });

  const t = useMemo(() => TRANSLATIONS[lang] || TRANSLATIONS.es, [lang]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Rotación automática del plato flotante cada 5.5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroDishIdx((prev) => (prev + 1) % HERO_FEATURED_DISHES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  // Título dinámico por idioma para visitantes y turistas
  useEffect(() => {
    const titles = {
      es: "Buffet y Restaurante El Callejón · León, Nicaragua",
      en: "Buffet & Restaurant El Callejón · León, Nicaragua",
      fr: "Buffet & Restaurant El Callejón · León, Nicaragua",
      it: "Buffet e Ristorante El Callejón · León, Nicaragua",
      de: "Buffet & Restaurant El Callejón · León, Nicaragua",
      pt: "Buffet e Restaurante El Callejón · León, Nicaragua",
    };
    document.title = titles[lang] || titles.es;
  }, [lang]);

  // Asegurar scroll nativo fluido en toda la página (mouse, táctil, teclado)
  useEffect(() => {
    document.documentElement.style.overflowY = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.height = "auto";
    const rootEl = document.getElementById("root");
    if (rootEl) {
      rootEl.style.height = "auto";
      rootEl.style.minHeight = "100vh";
      rootEl.style.overflow = "visible";
    }

    return () => {
      document.documentElement.style.overflowY = "";
      document.documentElement.style.height = "";
      document.body.style.overflowY = "";
      document.body.style.height = "";
      if (rootEl) {
        rootEl.style.height = "";
        rootEl.style.minHeight = "";
        rootEl.style.overflow = "";
      }
    };
  }, []);

  // Carga de datos de configuración del landing
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const res = await fetch("/api/landing");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setConfig(data);
        }
      } catch (err) {
        console.warn("Usando configuración local de fallback:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga diferida del iframe de Google Maps
  useEffect(() => {
    const timer = setTimeout(() => {
      setMapLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const info = config?.info_general || {
    nombre: "Buffet y Restaurante El Callejón",
    nombre_corto: "El Callejón",
    eslogan: "¡En la variedad está el sazón!",
    telefono: "+505 8512 1494",
    whatsapp: "+505 8512 1494",
    whatsapp_raw: "50585121494",
    email: "reservaciones.elcallejon@gmail.com",
    direccion: "Supermercado La Colonia, 2 ½ C abajo, León 21000, Nicaragua",
    horarios_texto: "Martes a Domingo: 8:00 a. m. – 3:00 p. m.",
    google_maps_url: "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99",
    google_maps_embed_url: "https://maps.google.com/maps?q=12.4361505,-86.8858488+(Buffet+y+Restaurante+El+Callej%C3%B3n)&t=&z=17&ie=UTF8&iwloc=&output=embed",
    waze_url: "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon",
    logo_url: "/logo-el-callejon.png",
    mostrar_precios: true,
  };

  useEffect(() => {
    if (config?.info_general?.mostrar_precios !== undefined) {
      setShowPrices(Boolean(config.info_general.mostrar_precios));
    }
  }, [config]);

  const menuItems = useMemo(() => {
    if (config?.menu_items && config.menu_items.length > 0) {
      return config.menu_items;
    }
    return [];
  }, [config]);

  const categories = useMemo(() => {
    const set = new Set(menuItems.map((m) => m.categoria).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    if (activeCategory === "all") return menuItems;
    return menuItems.filter((m) => m.categoria === activeCategory);
  }, [menuItems, activeCategory]);

  const eventsList = config?.eventos || [];
  const gallery = config?.galeria_fotos || [];

  const handleQuoteSubmit = (e) => {
    e.preventDefault();
    const eventTypeName = t.events.types[quoteForm.type] || quoteForm.type;
    const url = buildWhatsAppEventLink({
      whatsappRaw: info.whatsapp_raw || "50585121494",
      lang,
      name: quoteForm.name,
      eventType: eventTypeName,
      date: quoteForm.date,
      guests: quoteForm.guests,
      notes: quoteForm.notes,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleQuickOrder = (dishName) => {
    const textByLang = {
      es: `Hola Buffet y Restaurante El Callejón, me interesa consultar sobre el platillo: *${dishName}*. ¿Está disponible hoy?`,
      en: `Hello Buffet & Restaurant El Callejón, I'd like to ask about the dish: *${dishName}*. Is it available today?`,
      fr: `Bonjour Buffet et Restaurant El Callejón, je voudrais me renseigner sur le plat : *${dishName}*.`,
      it: `Ciao Buffet e Ristorante El Callejón, vorrei chiedere informazioni sul piatto: *${dishName}*.`,
      de: `Hallo Buffet & Restaurant El Callejón, ich möchte nach dem Gericht fragen: *${dishName}*.`,
      pt: `Olá Buffet e Restaurante El Callejón, gostaria de saber sobre o prato: *${dishName}*.`,
    };
    const msg = textByLang[lang] || textByLang.es;
    const url = `https://wa.me/${info.whatsapp_raw || "50585121494"}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Inyección de Schema.org en el <head> para Google Maps & SEO
  useEffect(() => {
    const scriptId = "ld-json-restaurant";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: info.nombre,
      image: window.location.origin + (info.logo_url || "/logo-el-callejon.png"),
      telephone: info.telefono,
      email: info.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Supermercado La Colonia, 2 ½ C abajo",
        addressLocality: "León",
        addressRegion: "León",
        postalCode: "21000",
        addressCountry: "NI",
      },
      hasMap: "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99",
      url: "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99",
      servesCuisine: ["Nicaraguan", "Buffet", "Barbecue", "Latin American"],
      priceRange: "$$",
      openingHours: "Tu,We,Th,Fr,Sa,Su 08:00-15:00",
    });
    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [info]);

  const activeHeroDish = HERO_FEATURED_DISHES[heroDishIdx];

  return (
    <div
      className="min-h-screen text-[#24140b] font-sans antialiased selection:bg-[#ea580c] selection:text-white"
      style={{
        backgroundColor: "#2a0808",
        backgroundImage: "url('/images/madera-roja.jpg')",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "center top",
        backgroundSize: "100% auto",
        backgroundAttachment: "scroll",
      }}
    >

      {/* NAVBAR: Diseño cálido y luminoso con efecto vidrio esmerilado */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/95 border-b border-amber-200/70 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <a href="#inicio" className="flex items-center gap-3 group">
            <img
              src={info.logo_url || "/logo-el-callejon.png"}
              alt={info.nombre}
              className="h-14 sm:h-16 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
              onError={(e) => {
                e.currentTarget.src = "/logo-el-callejon.png";
              }}
            />
            <div>
              <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-[#24140b] block leading-tight">
                {info.nombre_corto || "El Callejón"}
              </span>
              <span className="text-[11px] text-amber-700 font-extrabold tracking-wider uppercase">
                {info.eslogan || "Buffet & Restaurante"}
              </span>
            </div>
          </a>

          {/* Menú enlaces en desktop */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-bold text-stone-700">
            <a href="#inicio" className="hover:text-orange-600 transition-colors">
              {t.nav.inicio}
            </a>
            <a href="#nosotros" className="hover:text-orange-600 transition-colors">
              {t.nav.sobre_nosotros}
            </a>
            <a href="#menu" className="hover:text-orange-600 transition-colors">
              {t.nav.menu}
            </a>
            <a href="#eventos" className="hover:text-orange-600 transition-colors">
              {t.nav.eventos}
            </a>
            <a href="#galeria" className="hover:text-orange-600 transition-colors">
              {t.nav.galeria}
            </a>
            <a href="#ubicacion" className="hover:text-orange-600 transition-colors">
              {t.nav.ubicacion}
            </a>
          </nav>

          {/* Selector de idioma y botón WhatsApp */}
          <div className="flex items-center gap-3">
            {/* Selector de Idioma */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-xs font-bold text-stone-800 transition-all shadow-sm"
                title="Cambiar idioma / Change language"
              >
                <span className="text-base leading-none">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.flag || "🌐"}
                </span>
                <span className="uppercase text-amber-800 font-extrabold">{lang}</span>
                <svg
                  className="w-3.5 h-3.5 text-amber-800 transition-transform group-hover:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col bg-white border border-amber-200 rounded-2xl shadow-xl py-1.5 min-w-[140px] z-50 overflow-hidden">
                {SUPPORTED_LANGUAGES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLang(item.code)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors hover:bg-amber-50 ${
                      lang === item.code ? "text-orange-600 font-extrabold bg-amber-100/50" : "text-stone-800"
                    }`}
                  >
                    <span className="text-base">{item.flag}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA WhatsApp */}
            <a
              href={`https://wa.me/${info.whatsapp_raw || "50585121494"}?text=${encodeURIComponent(
                "¡Hola! Vi el sitio web de Buffet y Restaurante El Callejón y me gustaría más información."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 bg-gradient-to-r from-[#25d366] to-[#128c7e] hover:from-[#20ba59] hover:to-[#0f776a] text-white font-black text-xs px-4 py-2.5 rounded-full shadow-md shadow-emerald-600/20 hover:scale-105 transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              <span>{t.nav.reservar_btn}</span>
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION: Efecto Animación Flotante Retro-Moderno sobre Fondo de Madera Roja */}
      <section id="inicio" className="relative min-h-[85vh] lg:min-h-[80vh] flex items-center overflow-hidden bg-gradient-to-b from-black/55 via-black/35 to-black/60 pt-8 pb-16 lg:py-16">
        {/* Destellos y auras de luz cálida */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-orange-500/10 to-transparent pointer-events-none" />
        <div className="absolute top-12 -right-20 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Columna Izquierda: Título de alto impacto, propuesta de valor y llamadas a la acción */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Badge dorado luminoso */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/30 to-amber-500/20 border border-amber-400/80 text-amber-200 text-xs font-extrabold tracking-wide uppercase mb-6 shadow-md backdrop-blur-sm">
                <span>🔥</span>
                <span>{config?.hero?.badge || "25 Años de Tradición Leonesa · Pioneros del Buffet"}</span>
                <span>✨</span>
              </div>

              <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.12] mb-6 drop-shadow-md">
                {t.hero.title_p1}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 block mt-1">
                  {t.hero.title_p2}
                </span>
              </h1>

              <p className="max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg text-amber-100/90 leading-relaxed mb-8 font-medium drop-shadow-sm">
                {config?.hero?.subtitulo || t.hero.subtitle}
              </p>

              {/* Botones de acción principales */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-10">
                <a
                  href="#menu"
                  className="px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-sm tracking-wide shadow-xl shadow-orange-950/60 hover:scale-105 transition-all"
                >
                  🍽️ {t.hero.btn_menu}
                </a>
                <a
                  href="#eventos"
                  className="px-7 py-3.5 rounded-full bg-white/95 hover:bg-white text-stone-900 font-extrabold text-sm tracking-wide shadow-md hover:border-orange-500 hover:scale-105 transition-all"
                >
                  🎉 {t.hero.btn_eventos}
                </a>
                <a
                  href={info.google_maps_url || "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-300/60 text-amber-200 font-bold text-sm tracking-wide hover:scale-105 transition-all flex items-center gap-2 shadow-sm backdrop-blur-sm"
                >
                  <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>{t.hero.btn_maps}</span>
                </a>
              </div>

              {/* Fila de Confianza y Calidad */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 pt-6 border-t border-amber-400/30 text-xs font-bold text-amber-100/90">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-base">⭐⭐⭐⭐⭐</span>
                  <span>4.4 en Google Maps (1,690+ reseñas)</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <div className="flex items-center gap-1.5">
                  <span>🥩</span>
                  <span>Asados al Carbón & Buffet Diario</span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <div className="flex items-center gap-1.5">
                  <span>❄️</span>
                  <span>Salón Climatizado</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: PLATILLO FLOTANTE CON EFECTO RETRO-MODERNO */}
            <div className="lg:col-span-5 relative flex flex-col items-center justify-center">

              {/* Aura cálida pulsante de fondo */}
              <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-orange-400/35 via-amber-400/30 to-red-400/20 blur-3xl animate-warm-glow pointer-events-none" />

              {/* Plato principal con animación flotante continua */}
              <div className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 md:w-92 md:h-92 animate-float-slow">
                <div className="w-full h-full rounded-full p-3 bg-gradient-to-br from-amber-200 via-white to-orange-300 shadow-2xl shadow-orange-950/25 border-4 border-white/95 overflow-hidden relative group">
                  <img
                    src={activeHeroDish.imagen}
                    alt={activeHeroDish.nombre}
                    className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => {
                      e.currentTarget.src = "/images/platillos/pollo-salsa.jpg";
                    }}
                  />
                  {/* Destello de luz suave sobre el plato */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* BADGES SATELITALES FLOTANTES EN ÓRBITA */}
              {/* Badge 1: 25 Años (Superior Derecho) */}
              <div className="absolute -top-3 right-2 sm:-right-4 z-20 animate-float-delayed bg-white/95 backdrop-blur-md border border-amber-300 shadow-warm-xl rounded-2xl px-4 py-2 flex items-center gap-2.5">
                <span className="text-2xl">⭐</span>
                <div>
                  <span className="block font-display font-black text-xs text-[#24140b]">25 Años</span>
                  <span className="block text-[10px] text-amber-700 font-bold uppercase">Sazón Auténtico</span>
                </div>
              </div>

              {/* Badge 2: Asados al Carbón (Inferior Izquierdo) */}
              <div className="absolute -bottom-3 left-2 sm:-left-4 z-20 animate-float-badge bg-white/95 backdrop-blur-md border border-orange-300 shadow-warm-xl rounded-2xl px-4 py-2 flex items-center gap-2.5">
                <span className="text-2xl">🔥</span>
                <div>
                  <span className="block font-display font-black text-xs text-[#24140b]">Asados al Carbón</span>
                  <span className="block text-[10px] text-orange-600 font-bold uppercase">Hechos al Momento</span>
                </div>
              </div>

              {/* Badge 3: Buffet Fresco (Inferior Derecho) */}
              <div className="hidden sm:flex absolute bottom-12 -right-6 z-20 animate-float-slow bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-warm-xl rounded-2xl px-3.5 py-1.5 items-center gap-2 text-xs font-black">
                <span>🥗</span>
                <span>Buffet 8am – 3pm</span>
              </div>

              {/* Badge 4: Pioneros en León (Superior Izquierdo) */}
              <div className="hidden sm:flex absolute top-6 -left-6 z-20 animate-float-badge bg-white/95 backdrop-blur-md border border-emerald-300 shadow-warm rounded-xl px-3 py-1.5 items-center gap-1.5 text-xs font-bold text-emerald-800">
                <span>🏆</span>
                <span>Pioneros en León</span>
              </div>

              {/* Selector interactivo de platillos estrella debajo del plato flotante */}
              <div className="relative z-20 mt-6 flex flex-wrap items-center justify-center gap-2">
                {HERO_FEATURED_DISHES.map((dish, idx) => (
                  <button
                    key={dish.id}
                    type="button"
                    onClick={() => setHeroDishIdx(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                      heroDishIdx === idx
                        ? "bg-orange-500 text-white shadow-orange-500/40 scale-105"
                        : "bg-black/60 hover:bg-black/80 text-amber-100 border border-amber-400/40 backdrop-blur-sm"
                    }`}
                  >
                    <span>{dish.tag.split(" ")[0]}</span>
                    <span>{dish.nombre.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SOBRE NOSOTROS: Presentación cálida, editorial y de orgullo gastronómico */}
      <section id="nosotros" className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#fcf7ee]/95 backdrop-blur-md shadow-2xl border-2 border-amber-200/90 p-6 sm:p-10 lg:p-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Texto */}
            <div className="lg:col-span-7">
              <span className="text-orange-700 text-xs font-extrabold uppercase tracking-widest block mb-2">
                {t.about.badge}
              </span>
              <h2 className="font-display font-black text-2xl sm:text-4xl text-[#24140b] leading-tight mb-6">
                {t.about.title}
              </h2>
              <p className="text-stone-700 text-base leading-relaxed mb-4 font-normal">
                {config?.sobre_nosotros?.parrafo_1 || t.about.p1}
              </p>
              <p className="text-stone-700 text-base leading-relaxed mb-8 font-normal">
                {config?.sobre_nosotros?.parrafo_2 || t.about.p2}
              </p>

              {/* Estadísticas / Valores */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-amber-200/80">
                <div className="p-4 rounded-2xl bg-white border border-amber-200/90 text-center shadow-warm hover:scale-105 transition-transform">
                  <span className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent block">
                    25+
                  </span>
                  <span className="text-[11px] sm:text-xs text-stone-600 font-bold uppercase tracking-wide">
                    {t.about.stat_years}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-amber-200/90 text-center shadow-warm hover:scale-105 transition-transform">
                  <span className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent block">
                    40+
                  </span>
                  <span className="text-[11px] sm:text-xs text-stone-600 font-bold uppercase tracking-wide">
                    {t.about.stat_dishes}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-amber-200/90 text-center shadow-warm hover:scale-105 transition-transform">
                  <span className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent block">
                    100%
                  </span>
                  <span className="text-[11px] sm:text-xs text-stone-600 font-bold uppercase tracking-wide">
                    {t.about.stat_events}
                  </span>
                </div>
              </div>
            </div>

            {/* Imagen compuesta con marco blanco y sombra cálida */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden border-4 border-white shadow-warm-xl group">
                <img
                  src={config?.sobre_nosotros?.imagen_secundaria || "/images/publicidad/buffet-platos.jpg"}
                  alt="Buffet y Restaurante El Callejón"
                  className="w-full h-96 object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#24140b]/85 via-[#24140b]/30 to-transparent flex items-end p-6">
                  <div>
                    <span className="text-xs text-amber-400 font-black uppercase tracking-wider block">
                      Tradición Leonesa
                    </span>
                    <h3 className="font-display font-bold text-lg text-white">
                      Comida casera servida con orgullo nicaragüense
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MENÚ & ESPECIALIDADES: Presentación apetitosa, limpia y de alto contraste ("menu-menu-comida") */}
      <section id="menu" className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#fffdfa]/95 backdrop-blur-md shadow-2xl border-2 border-amber-200/90 p-6 sm:p-10 lg:p-14">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-orange-700 text-xs font-extrabold uppercase tracking-widest block mb-2">
              {t.menu.badge}
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-[#24140b] mb-4">
              {t.menu.title}
            </h2>
            <p className="text-stone-600 text-sm sm:text-base">
              {t.menu.subtitle}
            </p>

            {/* Controles del Menú: Switch Mostrar/Ocultar Precios + Selector de Moneda */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-6">
              {/* Botón Switch de Visibilidad de Precios */}
              <button
                type="button"
                onClick={() => setShowPrices((prev) => !prev)}
                className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-extrabold border shadow-sm transition-all cursor-pointer select-none ${
                  showPrices
                    ? "bg-amber-100/90 border-amber-300 text-stone-900 hover:bg-amber-200"
                    : "bg-white border-stone-300 text-stone-500 hover:bg-stone-50"
                }`}
                title={showPrices ? "Ocultar precios" : "Mostrar precios"}
              >
                <span className="text-sm leading-none">{showPrices ? "👁️" : "🙈"}</span>
                <span>{showPrices ? t.menu.hide_prices : t.menu.show_prices}</span>
                {/* Visual toggle switch */}
                <div
                  className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                    showPrices ? "bg-orange-500 justify-end" : "bg-stone-300 justify-start"
                  }`}
                >
                  <div className="bg-white w-3.5 h-3.5 rounded-full shadow-sm" />
                </div>
              </button>

              {/* Toggle de Moneda (Córdobas NIO vs Dólares USD) si los precios están visibles */}
              {showPrices && (
                <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-amber-100/70 border border-amber-300/80 shadow-sm transition-all">
                  <span className="text-xs font-bold px-2.5 text-stone-700">{t.menu.currency_label}</span>
                  <button
                    type="button"
                    onClick={() => setCurrency("NIO")}
                    className={`px-3 py-0.5 rounded-full text-xs font-black transition-all ${
                      currency === "NIO"
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                        : "text-stone-700 hover:text-stone-900"
                    }`}
                  >
                    C$ NIO
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`px-3 py-0.5 rounded-full text-xs font-black transition-all ${
                      currency === "USD"
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                        : "text-stone-700 hover:text-stone-900"
                    }`}
                  >
                    $ USD
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filtros de categorías: Píldoras coloridas y dinámicas */}
          {categories.length > 2 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-xs font-extrabold capitalize transition-all shadow-sm ${
                    activeCategory === cat
                      ? "bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 text-white shadow-md shadow-orange-500/25 scale-105"
                      : "bg-white border border-amber-200 text-stone-700 hover:border-orange-400 hover:bg-orange-50"
                  }`}
                >
                  {cat === "all" ? `🍽️ ${t.menu.all}` : cat}
                </button>
              ))}
            </div>
          )}

          {/* Grid de Platillos: Tarjetas blancas gourmet, bordes dorados suaves y elevación en hover */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredMenuItems.map((dish) => {
              const displayPrice =
                currency === "USD"
                  ? `$ ${Number(dish.precio_usd || dish.precio_nio / 36.7).toFixed(2)}`
                  : `C$ ${Number(dish.precio_nio || 0).toFixed(2)}`;

              return (
                <div
                  key={dish.id}
                  className="rounded-3xl bg-white border border-amber-100 shadow-warm hover:shadow-warm-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col group"
                >
                  <div className="relative h-48 sm:h-52 overflow-hidden bg-amber-50">
                    <img
                      src={dish.imagen || "/images/logo_callejon_catalog.jpg"}
                      alt={dish.nombre}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        e.target.src = "/images/logo_callejon_catalog.jpg";
                      }}
                    />
                    {dish.destacado && (
                      <span className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
                        ⭐ Especial
                      </span>
                    )}
                    {dish.categoria && (
                      <span className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md text-stone-800 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-200 shadow-sm">
                        {dish.categoria}
                      </span>
                    )}
                  </div>

                  <div className="p-6 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <h3 className="font-display font-bold text-lg text-stone-900 group-hover:text-orange-600 transition-colors leading-snug">
                          {dish.nombre}
                        </h3>
                        {showPrices && (
                          <span className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                            {displayPrice}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed mb-5">
                        {dish.descripcion}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickOrder(dish.nombre)}
                      className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-[#25d366] text-stone-800 hover:text-white border border-amber-200 hover:border-[#25d366] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                      </svg>
                      <span>{t.menu.btn_order}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* COTIZADOR DE EVENTOS PRIVADOS & CATERING: Ambiente festivo y cálido */}
      <section id="eventos" className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#fbf5eb]/95 backdrop-blur-md shadow-2xl border-2 border-amber-200/90 p-6 sm:p-10 lg:p-14">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-orange-700 text-xs font-extrabold uppercase tracking-widest block mb-2">
              {t.events.badge}
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-[#24140b] mb-4">
              {t.events.title}
            </h2>
            <p className="text-stone-600 text-sm sm:text-base">
              {t.events.subtitle}
            </p>
          </div>

          {/* Cards de Tipos de Eventos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {eventsList.map((evt) => (
              <div
                key={evt.id}
                className="rounded-3xl bg-white border border-amber-200/80 overflow-hidden shadow-warm hover:shadow-warm-xl hover:-translate-y-1 transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{evt.icono || "🎉"}</span>
                    <h3 className="font-display font-bold text-lg text-stone-900">
                      {evt.titulo}
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed mb-4">
                    {evt.descripcion}
                  </p>
                </div>
                {evt.imagen && (
                  <div className="h-32 rounded-2xl overflow-hidden mt-2 border border-amber-100">
                    <img
                      src={evt.imagen}
                      alt={evt.titulo}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Formulario Interactivo de Cotización Directa a WhatsApp */}
          <div className="max-w-3xl mx-auto bg-white border-2 border-amber-300/90 rounded-3xl p-6 sm:p-10 shadow-warm-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-44 h-44 bg-amber-200/40 rounded-full blur-2xl pointer-events-none" />

            <div className="text-center mb-8">
              <h3 className="font-display font-black text-2xl text-stone-900 mb-2">
                {t.events.form_title}
              </h3>
              <p className="text-xs sm:text-sm text-stone-600">
                {t.events.form_desc}
              </p>
            </div>

            <form onSubmit={handleQuoteSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    {t.events.input_name} *
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteForm.name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                    placeholder={t.events.input_name_ph}
                    className="w-full bg-stone-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    {t.events.input_type}
                  </label>
                  <select
                    value={quoteForm.type}
                    onChange={(e) => setQuoteForm({ ...quoteForm, type: e.target.value })}
                    className="w-full bg-stone-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  >
                    {Object.entries(t.events.types).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    {t.events.input_date}
                  </label>
                  <input
                    type="date"
                    value={quoteForm.date}
                    onChange={(e) => setQuoteForm({ ...quoteForm, date: e.target.value })}
                    className="w-full bg-stone-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-stone-900 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    {t.events.input_guests}
                  </label>
                  <input
                    type="text"
                    value={quoteForm.guests}
                    onChange={(e) => setQuoteForm({ ...quoteForm, guests: e.target.value })}
                    placeholder={t.events.input_guests_ph}
                    className="w-full bg-stone-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {t.events.input_notes}
                </label>
                <textarea
                  rows={3}
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder={t.events.input_notes_ph}
                  className="w-full bg-stone-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25d366] to-[#128c7e] text-white font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                </svg>
                <span>{t.events.btn_submit}</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* GALERÍA DE INSTALACIONES */}
      <section id="galeria" className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#fffdfa]/95 backdrop-blur-md shadow-2xl border-2 border-amber-200/90 p-6 sm:p-10 lg:p-14">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-orange-700 text-xs font-extrabold uppercase tracking-widest block mb-2">
              {t.gallery.badge}
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-[#24140b] mb-4">
              {t.gallery.title}
            </h2>
            <p className="text-stone-600 text-sm sm:text-base">
              {t.gallery.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {gallery.map((img, idx) => (
              <div
                key={idx}
                className="relative rounded-3xl overflow-hidden h-52 sm:h-64 border-2 border-white shadow-warm group cursor-pointer"
              >
                <img
                  src={img.url}
                  alt={img.titulo || "Instalaciones El Callejón"}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#24140b]/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="font-display font-bold text-sm text-white">
                    {img.titulo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UBICACIÓN & CONTACTO */}
      <section id="ubicacion" className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#faf5ed]/95 backdrop-blur-md shadow-2xl border-2 border-amber-200/90 p-6 sm:p-10 lg:p-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-orange-700 text-xs font-extrabold uppercase tracking-widest block mb-2">
                  {t.location.badge}
                </span>
                <h2 className="font-display font-black text-3xl text-[#24140b]">
                  {t.location.title}
                </h2>
              </div>

              {/* Dirección */}
              <div className="p-5 rounded-2xl bg-white border border-amber-200/80 shadow-warm">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl">📍</span>
                  <div>
                    <h3 className="font-bold text-sm text-stone-900 mb-1">
                      {t.location.address_title}
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {info.direccion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Horario */}
              <div className="p-5 rounded-2xl bg-white border border-amber-200/80 shadow-warm">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl">🕒</span>
                  <div>
                    <h3 className="font-bold text-sm text-stone-900 mb-1">
                      {t.location.hours_title}
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {info.horarios_texto}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contacto Directo */}
              <div className="p-5 rounded-2xl bg-white border border-amber-200/80 shadow-warm">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl">📞</span>
                  <div>
                    <h3 className="font-bold text-sm text-stone-900 mb-1">
                      {t.location.contact_title}
                    </h3>
                    <p className="text-xs text-stone-600 mb-1">
                      WhatsApp / Tel: <strong className="text-orange-700">{info.telefono}</strong>
                    </p>
                    <p className="text-xs text-stone-600">
                      Email: <strong className="text-orange-700">{info.email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de Navegación GPS */}
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={info.google_maps_url || "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-transform hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>{t.location.btn_open_maps}</span>
                </a>
                <a
                  href={info.waze_url || "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-[#00c6ff] hover:bg-[#00b0e6] text-stone-900 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition-transform hover:scale-105"
                >
                  <span>🚗</span>
                  <span>{t.location.btn_open_waze}</span>
                </a>
              </div>
            </div>

            {/* Mapa Interactivo con carga diferida anti-bloqueo */}
            <div className="lg:col-span-7 h-96 rounded-3xl overflow-hidden border-4 border-white shadow-warm-xl relative">
              {mapLoaded ? (
                <iframe
                  title="Mapa de Ubicación El Callejón"
                  src={info.google_maps_embed_url || "https://maps.google.com/maps?q=12.4361505,-86.8858488+(Buffet+y+Restaurante+El+Callej%C3%B3n)&t=&z=17&ie=UTF8&iwloc=&output=embed"}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="w-full h-full bg-amber-50/70 flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-4xl mb-3 animate-bounce">📍</span>
                  <p className="font-bold text-base text-stone-900 mb-1">{info.nombre}</p>
                  <p className="text-xs text-stone-600 max-w-sm mb-4">
                    {info.direccion}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMapLoaded(true)}
                    className="px-6 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-md shadow-orange-500/20"
                  >
                    🗺️ Ver Mapa Interactivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-[#140505]/95 text-[#fbf5ed] border-t-4 border-amber-500 backdrop-blur-md text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <img
              src={info.logo_url || "/logo-el-callejon.png"}
              alt={info.nombre}
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-md"
              onError={(e) => {
                e.currentTarget.src = "/logo-el-callejon.png";
              }}
            />
            <div>
              <p className="font-display font-extrabold text-sm text-white">{info.nombre}</p>
              <p className="text-[11px] text-amber-400 font-bold">{info.eslogan}</p>
            </div>
          </div>

          <p className="text-stone-300 font-medium">{t.footer.rights}</p>

          <div className="flex items-center gap-3 text-xs font-semibold text-amber-300/80">
            <span>📍 León, Nicaragua</span>
            <span className="text-stone-600">·</span>
            <a
              href={`https://wa.me/${info.whatsapp_raw || "50585121494"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
