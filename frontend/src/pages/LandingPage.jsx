import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  detectBrowserLanguage,
  buildWhatsAppEventLink,
} from "../lib/landingTranslations";

export default function LandingPage() {
  const [lang, setLang] = useState(() => detectBrowserLanguage());
  const [currency, setCurrency] = useState("NIO"); // NIO | USD
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

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

  // Carga diferida del iframe de Google Maps (evita que el navegador mantenga el spinner de carga en la pestaña)
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
    direccion: "Supermercados La Colonia, 2½ al Oeste, León, Nicaragua",
    horarios_texto: "Martes a Domingo: 8:00 a. m. – 3:00 p. m.",
    google_maps_url: "https://maps.google.com/?q=Supermercados+La+Colonia+Leon+Nicaragua",
    logo_url: "/images/logo_callejon_catalog.jpg",
  };

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
      image: window.location.origin + (info.logo_url || "/images/logo_callejon_catalog.jpg"),
      telephone: info.telefono,
      email: info.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Supermercados La Colonia, 2½ al Oeste",
        addressLocality: "León",
        addressRegion: "León",
        addressCountry: "NI",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: "12.43787",
        longitude: "-86.87804",
      },
      url: window.location.href,
      servesCuisine: ["Nicaraguan", "Buffet", "Barbecue", "Latin American"],
      priceRange: "$$",
      openingHours: "Tu,We,Th,Fr,Sa,Su 08:00-15:00",
    });
    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [info]);

  return (
    <div className="min-h-screen bg-[#110f0d] text-[#fbf8f2] font-sans antialiased selection:bg-[#e8c56a] selection:text-[#110f0d]">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#181411]/90 border-b border-[#e8c56a]/20 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <a href="#inicio" className="flex items-center gap-3 group">
            <img
              src={info.logo_url || "/images/logo_callejon_catalog.jpg"}
              alt={info.nombre}
              className="h-12 w-12 rounded-full border border-[#e8c56a]/40 object-cover shadow-md group-hover:scale-105 transition-transform"
              onError={(e) => {
                e.currentTarget.src = "/logo-el-callejon.jpg";
              }}
            />
            <div>
              <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-[#fbf8f2] block leading-tight">
                {info.nombre_corto || "El Callejón"}
              </span>
              <span className="text-[11px] text-[#e8c56a] font-medium tracking-wide uppercase">
                {info.eslogan || "Buffet & Restaurante"}
              </span>
            </div>
          </a>

          {/* Menú enlaces en desktop */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#e6ded3]">
            <a href="#inicio" className="hover:text-[#e8c56a] transition-colors">
              {t.nav.inicio}
            </a>
            <a href="#nosotros" className="hover:text-[#e8c56a] transition-colors">
              {t.nav.sobre_nosotros}
            </a>
            <a href="#menu" className="hover:text-[#e8c56a] transition-colors">
              {t.nav.menu}
            </a>
            <a href="#eventos" className="hover:text-[#e8c56a] transition-colors">
              {t.nav.eventos}
            </a>
            <a href="#galeria" className="hover:text-[#e8c56a] transition-colors">
              {t.nav.galeria}
            </a>
            <a href="#ubicacion" className="hover:text-[#e8c56a] transition-colors">
              {t.nav.ubicacion}
            </a>
          </nav>

          {/* Selector de idioma y botón WhatsApp */}
          <div className="flex items-center gap-2.5">
            {/* Selector de Idioma */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#241e19] border border-[#e8c56a]/30 text-xs font-semibold hover:border-[#e8c56a] transition-colors"
                title="Cambiar idioma / Change language"
              >
                <span className="text-base leading-none">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.flag || "🌐"}
                </span>
                <span className="uppercase text-[#e8c56a] font-bold">{lang}</span>
                <svg
                  className="w-3 h-3 text-[#e6ded3] transition-transform group-hover:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col bg-[#211b16] border border-[#e8c56a]/30 rounded-xl shadow-2xl py-1.5 min-w-[130px] z-50 backdrop-blur-lg">
                {SUPPORTED_LANGUAGES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLang(item.code)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors hover:bg-[#322a22] ${
                      lang === item.code ? "text-[#e8c56a] font-bold bg-[#29221b]" : "text-[#fbf8f2]"
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
              className="hidden sm:inline-flex items-center gap-2 bg-[#25d366] hover:bg-[#20ba59] text-black font-semibold text-xs px-4 py-2.5 rounded-full shadow-lg shadow-[#25d366]/20 transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              <span>{t.nav.reservar_btn}</span>
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section id="inicio" className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Imagen de fondo con overlay cinematográfico */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('${config?.hero?.imagen_fondo || "/images/slides/slide-ambiente-salon-1.jpg"}')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#110f0d] via-[#110f0d]/80 to-[#110f0d]/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#110f0d]/40 to-[#110f0d]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#e8c56a]/15 border border-[#e8c56a]/40 text-[#e8c56a] text-xs font-semibold tracking-wider uppercase mb-6 shadow-md">
            <span>✨</span>
            <span>{config?.hero?.badge || t.hero.badge}</span>
            <span>✨</span>
          </div>

          <h1 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl text-[#fbf8f2] tracking-tight leading-tight mb-6">
            {t.hero.title_p1}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e8c56a] via-[#f7e4a1] to-[#d99f36] block mt-1">
              {t.hero.title_p2}
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-base sm:text-xl text-[#d4c8b8] leading-relaxed mb-10 font-normal">
            {config?.hero?.subtitulo || t.hero.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="#menu"
              className="px-7 py-3.5 rounded-full bg-gradient-to-r from-[#e8c56a] to-[#d49e37] text-black font-bold text-sm tracking-wide shadow-lg shadow-[#e8c56a]/25 hover:shadow-xl hover:scale-105 transition-all"
            >
              🍽️ {t.hero.btn_menu}
            </a>
            <a
              href="#eventos"
              className="px-7 py-3.5 rounded-full bg-[#241e19] border border-[#e8c56a]/50 text-[#fbf8f2] font-semibold text-sm tracking-wide hover:bg-[#2e261f] hover:border-[#e8c56a] transition-all"
            >
              🎉 {t.hero.btn_eventos}
            </a>
            <a
              href={info.google_maps_url || "https://maps.google.com/?q=Supermercados+La+Colonia+Leon+Nicaragua"}
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3.5 rounded-full bg-[#1e2329] border border-blue-400/40 text-blue-300 font-semibold text-sm tracking-wide hover:bg-blue-900/30 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>{t.hero.btn_maps}</span>
            </a>
          </div>
        </div>
      </section>

      {/* SOBRE NOSOTROS */}
      <section id="nosotros" className="py-20 bg-[#16120f] border-t border-[#e8c56a]/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Texto */}
            <div className="lg:col-span-7">
              <span className="text-[#e8c56a] text-xs font-bold uppercase tracking-widest block mb-2">
                {t.about.badge}
              </span>
              <h2 className="font-display font-bold text-2xl sm:text-4xl text-[#fbf8f2] leading-tight mb-6">
                {t.about.title}
              </h2>
              <p className="text-[#d4c8b8] text-base leading-relaxed mb-4">
                {config?.sobre_nosotros?.parrafo_1 || t.about.p1}
              </p>
              <p className="text-[#d4c8b8] text-base leading-relaxed mb-8">
                {config?.sobre_nosotros?.parrafo_2 || t.about.p2}
              </p>

              {/* Estadísticas / Valores */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#e8c56a]/15">
                <div className="p-4 rounded-xl bg-[#211a14] border border-[#e8c56a]/20 text-center">
                  <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#e8c56a] block">
                    25+
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#a89b8c] uppercase tracking-wide">
                    {t.about.stat_years}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#211a14] border border-[#e8c56a]/20 text-center">
                  <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#e8c56a] block">
                    40+
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#a89b8c] uppercase tracking-wide">
                    {t.about.stat_dishes}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#211a14] border border-[#e8c56a]/20 text-center">
                  <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#e8c56a] block">
                    100%
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#a89b8c] uppercase tracking-wide">
                    {t.about.stat_events}
                  </span>
                </div>
              </div>
            </div>

            {/* Imagen compuesta */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#e8c56a]/30 shadow-2xl shadow-black/60 group">
                <img
                  src={config?.sobre_nosotros?.imagen_secundaria || "/images/publicidad/buffet-platos.jpg"}
                  alt="Buffet y Restaurante El Callejón"
                  className="w-full h-96 object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                  <div>
                    <span className="text-xs text-[#e8c56a] font-bold uppercase tracking-wider block">
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

      {/* MENÚ & ESPECIALIDADES */}
      <section id="menu" className="py-20 bg-[#110f0d] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-[#e8c56a] text-xs font-bold uppercase tracking-widest block mb-2">
              {t.menu.badge}
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#fbf8f2] mb-4">
              {t.menu.title}
            </h2>
            <p className="text-[#a89b8c] text-sm sm:text-base">
              {t.menu.subtitle}
            </p>

            {/* Toggle de Moneda (Córdobas NIO vs Dólares USD) */}
            <div className="inline-flex items-center gap-2 mt-6 p-1 rounded-full bg-[#1d1712] border border-[#e8c56a]/30">
              <span className="text-xs font-semibold px-3 text-[#a89b8c]">{t.menu.currency_label}</span>
              <button
                type="button"
                onClick={() => setCurrency("NIO")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  currency === "NIO" ? "bg-[#e8c56a] text-black shadow-md" : "text-[#d4c8b8] hover:text-white"
                }`}
              >
                C$ NIO
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  currency === "USD" ? "bg-[#e8c56a] text-black shadow-md" : "text-[#d4c8b8] hover:text-white"
                }`}
              >
                $ USD
              </button>
            </div>
          </div>

          {/* Filtros de categorías */}
          {categories.length > 2 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all ${
                    activeCategory === cat
                      ? "bg-[#e8c56a] text-black font-bold shadow-md shadow-[#e8c56a]/20 scale-105"
                      : "bg-[#1d1712] border border-[#e8c56a]/20 text-[#d4c8b8] hover:border-[#e8c56a]"
                  }`}
                >
                  {cat === "all" ? t.menu.all : cat}
                </button>
              ))}
            </div>
          )}

          {/* Grid de Platillos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenuItems.map((dish) => {
              const displayPrice =
                currency === "USD"
                  ? `$ ${Number(dish.precio_usd || dish.precio_nio / 36.7).toFixed(2)}`
                  : `C$ ${Number(dish.precio_nio || 0).toFixed(2)}`;

              return (
                <div
                  key={dish.id}
                  className="rounded-2xl bg-[#191410] border border-[#e8c56a]/15 overflow-hidden hover:border-[#e8c56a]/50 transition-all hover:shadow-xl hover:shadow-black/50 group flex flex-col"
                >
                  <div className="relative h-48 sm:h-52 overflow-hidden bg-black/40">
                    <img
                      src={dish.imagen || "/images/logo_callejon_catalog.jpg"}
                      alt={dish.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.src = "/images/logo_callejon_catalog.jpg";
                      }}
                    />
                    {dish.destacado && (
                      <span className="absolute top-3 left-3 bg-[#e8c56a] text-black text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-md">
                        ⭐ Especial
                      </span>
                    )}
                    {dish.categoria && (
                      <span className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm text-[#e8c56a] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#e8c56a]/30">
                        {dish.categoria}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-display font-bold text-lg text-[#fbf8f2] group-hover:text-[#e8c56a] transition-colors leading-snug">
                          {dish.nombre}
                        </h3>
                        <span className="font-display font-black text-base text-[#e8c56a] whitespace-nowrap">
                          {displayPrice}
                        </span>
                      </div>
                      <p className="text-xs text-[#a89b8c] leading-relaxed mb-4">
                        {dish.descripcion}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickOrder(dish.nombre)}
                      className="w-full py-2.5 rounded-xl bg-[#231d17] border border-[#e8c56a]/30 hover:bg-[#25d366] hover:border-[#25d366] hover:text-black text-xs font-semibold text-[#fbf8f2] flex items-center justify-center gap-2 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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

      {/* COTIZADOR DE EVENTOS PRIVADOS & CATERING */}
      <section id="eventos" className="py-20 bg-[#16120f] border-t border-[#e8c56a]/15 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[#e8c56a] text-xs font-bold uppercase tracking-widest block mb-2">
              {t.events.badge}
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#fbf8f2] mb-4">
              {t.events.title}
            </h2>
            <p className="text-[#a89b8c] text-sm sm:text-base">
              {t.events.subtitle}
            </p>
          </div>

          {/* Cards de Tipos de Eventos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {eventsList.map((evt) => (
              <div
                key={evt.id}
                className="rounded-2xl bg-[#1f1914] border border-[#e8c56a]/20 overflow-hidden hover:border-[#e8c56a]/60 transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{evt.icono || "🎉"}</span>
                    <h3 className="font-display font-bold text-lg text-[#fbf8f2]">
                      {evt.titulo}
                    </h3>
                  </div>
                  <p className="text-xs text-[#d4c8b8] leading-relaxed mb-4">
                    {evt.descripcion}
                  </p>
                </div>
                {evt.imagen && (
                  <div className="h-32 rounded-xl overflow-hidden mt-2">
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
          <div className="max-w-3xl mx-auto bg-[#1c1611] border-2 border-[#e8c56a]/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-40 h-40 bg-[#e8c56a]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="text-center mb-8">
              <h3 className="font-display font-bold text-2xl text-[#fbf8f2] mb-2">
                {t.events.form_title}
              </h3>
              <p className="text-xs sm:text-sm text-[#a89b8c]">
                {t.events.form_desc}
              </p>
            </div>

            <form onSubmit={handleQuoteSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[#e6ded3] mb-1.5">
                    {t.events.input_name} *
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteForm.name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                    placeholder={t.events.input_name_ph}
                    className="w-full bg-[#120e0b] border border-[#e8c56a]/30 rounded-xl px-4 py-3 text-sm text-[#fbf8f2] placeholder-[#6b6156] focus:outline-none focus:border-[#e8c56a] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6ded3] mb-1.5">
                    {t.events.input_type}
                  </label>
                  <select
                    value={quoteForm.type}
                    onChange={(e) => setQuoteForm({ ...quoteForm, type: e.target.value })}
                    className="w-full bg-[#120e0b] border border-[#e8c56a]/30 rounded-xl px-4 py-3 text-sm text-[#fbf8f2] focus:outline-none focus:border-[#e8c56a] transition-colors"
                  >
                    {Object.entries(t.events.types).map(([key, label]) => (
                      <option key={key} value={key} className="bg-[#1c1611]">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[#e6ded3] mb-1.5">
                    {t.events.input_date}
                  </label>
                  <input
                    type="date"
                    value={quoteForm.date}
                    onChange={(e) => setQuoteForm({ ...quoteForm, date: e.target.value })}
                    className="w-full bg-[#120e0b] border border-[#e8c56a]/30 rounded-xl px-4 py-3 text-sm text-[#fbf8f2] focus:outline-none focus:border-[#e8c56a] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#e6ded3] mb-1.5">
                    {t.events.input_guests}
                  </label>
                  <input
                    type="text"
                    value={quoteForm.guests}
                    onChange={(e) => setQuoteForm({ ...quoteForm, guests: e.target.value })}
                    placeholder={t.events.input_guests_ph}
                    className="w-full bg-[#120e0b] border border-[#e8c56a]/30 rounded-xl px-4 py-3 text-sm text-[#fbf8f2] placeholder-[#6b6156] focus:outline-none focus:border-[#e8c56a] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#e6ded3] mb-1.5">
                  {t.events.input_notes}
                </label>
                <textarea
                  rows={3}
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder={t.events.input_notes_ph}
                  className="w-full bg-[#120e0b] border border-[#e8c56a]/30 rounded-xl px-4 py-3 text-sm text-[#fbf8f2] placeholder-[#6b6156] focus:outline-none focus:border-[#e8c56a] transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25d366] to-[#1eb854] text-black font-extrabold text-sm tracking-wide shadow-xl shadow-[#25d366]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
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
      <section id="galeria" className="py-20 bg-[#110f0d] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-[#e8c56a] text-xs font-bold uppercase tracking-widest block mb-2">
              {t.gallery.badge}
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#fbf8f2] mb-4">
              {t.gallery.title}
            </h2>
            <p className="text-[#a89b8c] text-sm sm:text-base">
              {t.gallery.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {gallery.map((img, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl overflow-hidden h-52 sm:h-64 border border-[#e8c56a]/15 group cursor-pointer"
              >
                <img
                  src={img.url}
                  alt={img.titulo || "Instalaciones El Callejón"}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="font-display font-bold text-sm text-[#fbf8f2]">
                    {img.titulo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UBICACIÓN & CONTACTO */}
      <section id="ubicacion" className="py-20 bg-[#16120f] border-t border-[#e8c56a]/15 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-[#e8c56a] text-xs font-bold uppercase tracking-widest block mb-2">
                  {t.location.badge}
                </span>
                <h2 className="font-display font-bold text-3xl text-[#fbf8f2]">
                  {t.location.title}
                </h2>
              </div>

              {/* Dirección */}
              <div className="p-5 rounded-2xl bg-[#1f1914] border border-[#e8c56a]/20">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl">📍</span>
                  <div>
                    <h3 className="font-bold text-sm text-[#fbf8f2] mb-1">
                      {t.location.address_title}
                    </h3>
                    <p className="text-xs text-[#d4c8b8] leading-relaxed">
                      {info.direccion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Horario */}
              <div className="p-5 rounded-2xl bg-[#1f1914] border border-[#e8c56a]/20">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl">🕒</span>
                  <div>
                    <h3 className="font-bold text-sm text-[#fbf8f2] mb-1">
                      {t.location.hours_title}
                    </h3>
                    <p className="text-xs text-[#d4c8b8] leading-relaxed">
                      {info.horarios_texto}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contacto Directo */}
              <div className="p-5 rounded-2xl bg-[#1f1914] border border-[#e8c56a]/20">
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl">📞</span>
                  <div>
                    <h3 className="font-bold text-sm text-[#fbf8f2] mb-1">
                      {t.location.contact_title}
                    </h3>
                    <p className="text-xs text-[#d4c8b8] mb-1">
                      WhatsApp / Tel: <strong className="text-[#e8c56a]">{info.telefono}</strong>
                    </p>
                    <p className="text-xs text-[#d4c8b8]">
                      Email: <strong className="text-[#e8c56a]">{info.email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de Navegación GPS */}
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={info.google_maps_url || "https://maps.google.com/?q=Supermercados+La+Colonia+Leon+Nicaragua"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-transform hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>{t.location.btn_open_maps}</span>
                </a>
                <a
                  href="https://waze.com/ul?q=Supermercados+La+Colonia+Leon+Nicaragua"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-[#33ccff] hover:bg-[#2bb8e6] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#33ccff]/20 transition-transform hover:scale-105"
                >
                  <span>🚗</span>
                  <span>{t.location.btn_open_waze}</span>
                </a>
              </div>
            </div>

            {/* Mapa Interactivo con carga diferida anti-bloqueo */}
            <div className="lg:col-span-7 h-96 rounded-3xl overflow-hidden border-2 border-[#e8c56a]/30 shadow-2xl shadow-black/80 relative">
              {mapLoaded ? (
                <iframe
                  title="Mapa de Ubicación El Callejón"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3893.3824040986915!2d-86.88022862415174!3d12.437869987826315!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8f711e1f74ec5d09%3A0x8e8749e7987258b3!2sSupermercado%20La%20Colonia%20Le%C3%B3n!5e0!3m2!1ses!2sni!4v1710540000000!5m2!1ses!2sni"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: "brightness(0.9) contrast(1.1)" }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="w-full h-full bg-[#18130f] flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-4xl mb-3 animate-bounce">📍</span>
                  <p className="font-bold text-base text-[#fbf8f2] mb-1">Buffet y Restaurante El Callejón</p>
                  <p className="text-xs text-[#a89b8c] max-w-sm mb-4">
                    Supermercados La Colonia, 2½ al Oeste, León, Nicaragua
                  </p>
                  <button
                    type="button"
                    onClick={() => setMapLoaded(true)}
                    className="px-6 py-2.5 rounded-full bg-[#e8c56a] text-black font-bold text-xs hover:bg-[#f3d996] transition-all shadow-lg shadow-[#e8c56a]/20"
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
      <footer className="py-10 bg-[#0c0a08] border-t border-[#e8c56a]/15 text-[#8f8273] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <img
              src={info.logo_url || "/images/logo_callejon_catalog.jpg"}
              alt={info.nombre}
              className="h-8 w-8 rounded-full border border-[#e8c56a]/30 object-cover"
              onError={(e) => {
                e.currentTarget.src = "/logo-el-callejon.jpg";
              }}
            />
            <div>
              <p className="font-bold text-[#fbf8f2]">{info.nombre}</p>
              <p className="text-[11px] text-[#e8c56a]">{info.eslogan}</p>
            </div>
          </div>

          <p>{t.footer.rights}</p>

          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/login" className="hover:text-[#e8c56a] transition-colors underline">
              {t.nav.admin_link}
            </Link>
            <span>·</span>
            <Link to="/" className="hover:text-[#e8c56a] transition-colors">
              Pantallas TV
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
