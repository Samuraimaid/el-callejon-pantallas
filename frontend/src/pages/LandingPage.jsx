import { useEffect, useState, useMemo } from "react";
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  detectBrowserLanguage,
  buildWhatsAppEventLink,
} from "../lib/landingTranslations";

// Diapositivas para el carrusel de alto impacto inspirado en TV3 y TV4
const HERO_CAROUSEL_SLIDES = [
  {
    id: "costilla",
    titulo: "Costilla Ahumada a la Barbacoa",
    subtitulo: "Cocción lenta a la brasa con el auténtico sabor tradicional de la casa",
    imagen: "/images/slides/slide-costilla-bbq.jpg",
  },
  {
    id: "asados",
    titulo: "Asados Tradicionales a la Parrilla",
    subtitulo: "Cortes seleccionados marinados con la receta tradicional leonesa de 25 años",
    imagen: "/images/slides/slide-asados-1.jpg",
  },
  {
    id: "camarones",
    titulo: "Camarones al Ajillo",
    subtitulo: "Porción generosa de mariscos frescos salteados con mantequilla y ajo criollo",
    imagen: "/images/slides/slide-camarones.jpg",
  },
  {
    id: "buffet",
    titulo: "Buffet Tradicional Diario",
    subtitulo: "Más de 12 opciones calientes, guarniciones típicas y ensaladas frescas",
    imagen: "/images/slides/slide1-buffet.jpg",
  },
  {
    id: "salon-vip",
    titulo: "Exclusivo Salón VIP Climatizado",
    subtitulo: "Ambiente reservado con aire acondicionado para tus almuerzos y eventos privados",
    imagen: "/images/slides/slide3-salon.jpg",
  },
  {
    id: "pollo",
    titulo: "Pollo en Salsa Tradicional",
    subtitulo: "Sabor casero inconfundible servido con orgullo leonés",
    imagen: "/images/slides/slide-pollo-salsa.jpg",
  },
];

const SLIDE_TRANSLATIONS = {
  costilla: {
    en: { titulo: "Smoked BBQ Ribs", subtitulo: "Juicy ribs slow-glazed in homemade sweet BBQ sauce" },
    fr: { titulo: "Côtes de Porc BBQ", subtitulo: "Côtes juteuses laquées à la sauce BBQ maison" },
    it: { titulo: "Costine BBQ Affumicate", subtitulo: "Costine tenere glassate con salsa barbecue artigianale" },
    de: { titulo: "Geräucherte BBQ-Rippchen", subtitulo: "Zarte Rippchen mit hausgemachter BBQ-Sauce" },
    pt: { titulo: "Costelinha BBQ Defumada", subtitulo: "Costelas suculentas glaceadas ao molho barbecue caseiro" },
    zh: { titulo: "特色炭烤猪肋排", subtitulo: "秘制甜香酱汁慢烤，肉质细嫩多汁" },
    ja: { titulo: "特製バーベキューリブ", subtitulo: "自家製BBQソースで香ばしく焼き上げたジューシーなリブ" },
    ko: { titulo: "특제 바비큐 립", subtitulo: "수제 바비큐 소스로 훈연하여 부드럽고 촉촉한 립 요리" },
  },
  asados: {
    en: { titulo: "Charcoal Grilled Steaks", subtitulo: "Choice beef cuts marinated with our 25-year-old family recipe" },
    fr: { titulo: "Grillades au Charbon de Bois", subtitulo: "Morceaux choisis marinés selon notre recette traditionnelle de 25 ans" },
    it: { titulo: "Carne alla Brace Tradizionale", subtitulo: "Tagli selezionati marinati con la ricetta familiare di 25 anni" },
    de: { titulo: "Holzkohle-Grillspezialitäten", subtitulo: "Ausgewählte Fleischstücke nach traditionellem 25-Jahre-Familienrezept" },
    pt: { titulo: "Churrasco na Brasa Tradicional", subtitulo: "Cortes selecionados marinados com a tradicional receita de 25 anos" },
    zh: { titulo: "传统炭火精选烤肉", subtitulo: "25年秘制家传腌方，炭火慢烤香气四溢" },
    ja: { titulo: "伝統の炭火焼きステーキ", subtitulo: "創業25年の秘伝レシピでマリネした厳選牛ステーキ" },
    ko: { titulo: "정통 숯불 구이 스테이크", subtitulo: "25년 전통 레시피로 숙성한 엄선된 비프 바비큐" },
  },
  camarones: {
    en: { titulo: "Garlic Butter Shrimp", subtitulo: "Generous portion of fresh shrimp sautéed in Creole garlic butter" },
    fr: { titulo: "Crevettes à l'Ail Créole", subtitulo: "Généreuse portion de crevettes fraîches sautées au beurre et à l'ail" },
    it: { titulo: "Gamberi all'Aglio Criollo", subtitulo: "Generosa porzione di gamberi freschi saltati al burro e aglio" },
    de: { titulo: "Garnelen in Knoblauchbutter", subtitulo: "Frische Garnelen geschwenkt in kreolischer Knoblauchbutter" },
    pt: { titulo: "Camarões ao Alho Crioulo", subtitulo: "Generosa porção de frutos do mar frescos salteados com manteiga e alho" },
    zh: { titulo: "蒜蓉黄油鲜虾", subtitulo: "特选新鲜大虾，佐以浓郁蒜香黄油与香蕉脆片" },
    ja: { titulo: "ガーリックシュリンプ", subtitulo: "新鮮な海老を特製ガーリックバターでソテーした逸品" },
    ko: { titulo: "갈릭 버터 새우 요리", subtitulo: "크리올 갈릭 버터에 고소하게 볶아낸 신선한 새우" },
  },
  buffet: {
    en: { titulo: "Daily Traditional Buffet", subtitulo: "Over 12 hot entrees, typical side dishes, and fresh garden salads" },
    fr: { titulo: "Buffet Traditionnel Quotidien", subtitulo: "Plus de 12 plats chauds, garnitures locales et salades fraîches" },
    it: { titulo: "Buffet Tradizionale Quotidiano", subtitulo: "Oltre 12 piatti caldi, contorni tipici e insalate fresche" },
    de: { titulo: "Traditionelles Mittagsbuffet", subtitulo: "Über 12 warme Gerichte, typische Beilagen und frische Salate" },
    pt: { titulo: "Buffet Tradicional Diário", subtitulo: "Mais de 12 opções quentes, guarnições típicas e saladas frescas" },
    zh: { titulo: "每日传统热菜自助", subtitulo: "12道以上当日热菜、传统配菜与新鲜自选沙拉" },
    ja: { titulo: "日替わり伝統ビュッフェ", subtitulo: "12種類以上の温かい主菜、伝統の付け合わせ、新鮮サラダ" },
    ko: { titulo: "데일리 전통 뷔페", subtitulo: "12가지 이상의 따뜻한 메인 디시, 전통 사이드 및 신선한 샐러드" },
  },
  "salon-vip": {
    en: { titulo: "Exclusive Air-Conditioned VIP Room", subtitulo: "Private air-conditioned venue for your lunches and special events" },
    fr: { titulo: "Salon VIP Climatisé Exclusif", subtitulo: "Espace privé avec climatisation pour vos déjeuners et événements" },
    it: { titulo: "Esclusiva Sala VIP Climatizzata", subtitulo: "Ambiente riservato con aria condizionata per pranzi ed eventi privati" },
    de: { titulo: "Exklusiver klimatisierter VIP-Saal", subtitulo: "Privater Raum mit Klimaanlage für Ihre Feiern und geschäftliche Essen" },
    pt: { titulo: "Exclusivo Salão VIP Climatizado", subtitulo: "Ambiente reservado com ar-condicionado para almoços e eventos privados" },
    zh: { titulo: "独立空调 VIP 宴会大厅", subtitulo: "舒适静谧的恒温专属包厢，满足商务宴请与私人聚会需求" },
    ja: { titulo: "冷房完備の特別VIPホール", subtitulo: "エアコン完備のプライベート空間でランチや貸切パーティーを" },
    ko: { titulo: "냉난방 완비 단독 VIP 룸", subtitulo: "비즈니스 런치 및 프라이빗 행사를 위한 쾌적한 전용 공간" },
  },
  pollo: {
    en: { titulo: "Traditional Stewed Chicken", subtitulo: "Unmistakable homemade flavor served with pride" },
    fr: { titulo: "Poulet en Sauce Traditionnelle", subtitulo: "Saveur maison inimitable servie avec passion" },
    it: { titulo: "Pollo in Salsa Tradizionale", subtitulo: "Inconfondibile sapore fatto in casa servito con orgoglio" },
    de: { titulo: "Traditionelles Hähnchen in Sauce", subtitulo: "Unverwechselbarer hausgemachter Geschmack" },
    pt: { titulo: "Frango ao Molho Tradicional", subtitulo: "Sabor caseiro inconfundível servido com muito orgulho" },
    zh: { titulo: "秘制风味酱汁鸡肉", subtitulo: "原汁原味的纯正家常风味，传递尼加拉瓜烹饪热情" },
    ja: { titulo: "伝統ソースのチキン料理", subtitulo: "代々受け継がれる家庭の味をレオンの誇りをもってお届け" },
    ko: { titulo: "전통 소스 치킨 요리", subtitulo: "정갈하고 깊은 홈메이드 손맛을 그대로 담은 대표 치킨" },
  },
};

const EVENT_TRANSLATIONS = {
  bodas: {
    en: {
      titulo: "Weddings & Receptions",
      descripcion: "Banquet packages, elegant decor, beverage bar, and reserved VIP hall for your wedding day.",
    },
    fr: {
      titulo: "Mariages & Réceptions",
      descripcion: "Formules banquet, décoration élégante, bar et salon VIP réservé pour votre grand jour.",
    },
    it: {
      titulo: "Matrimoni & Ricevimenti",
      descripcion: "Pacchetti banchetto, decorazioni eleganti, open bar e sala VIP riservata per le tue nozze.",
    },
    de: {
      titulo: "Hochzeiten & Empfänge",
      descripcion: "Bankett-Pakete, stilvolle Dekoration, Bar und reservierter VIP-Festsaal für Ihren großen Tag.",
    },
    pt: {
      titulo: "Casamentos & Recepções",
      descripcion: "Pacotes de banquete, decoração elegante, bar e salão VIP reservado para o seu grande dia.",
    },
    zh: {
      titulo: "婚礼与婚宴庆典",
      descripcion: "全套宴会餐饮套餐、雅致场地布置、酒水饮品吧及专属私密空调宴会大厅。",
    },
    ja: {
      titulo: "結婚式・披露宴",
      descripcion: "豪華バンケットプラン、洗練された装飾、ドリンクバー、貸切VIPホールをご用意。",
    },
    ko: {
      titulo: "결혼식 및 피로연",
      descripcion: "연회 풀 패키지, 품격 있는 데코레이션, 음료 바 및 독립된 단독 VIP 연회장 제공.",
    },
  },
  quinceanos: {
    en: {
      titulo: "Sweet 15 Celebrations",
      descripcion: "The perfect venue with sound, ambient lighting, and rich buffet menus for the celebrated birthday girl.",
    },
    fr: {
      titulo: "Fêtes de 15 Ans",
      descripcion: "L'espace idéal avec sonorisation, éclairage chaleureux et buffets variés pour une célébration unique.",
    },
    it: {
      titulo: "Feste per i 15 Anni",
      descripcion: "Lo spazio perfetto con impianto audio, luci d'atmosfera e ricchi menu a buffet per festeggiare al meglio.",
    },
    de: {
      titulo: "15. Geburtstagsfeiern",
      descripcion: "Perfektes Ambiente mit Sound, stimmungsvollem Licht und vielfältigen Buffet-Menüs für das Geburtstagskind.",
    },
    pt: {
      titulo: "Festas de 15 Anos",
      descripcion: "O espaço perfeito com som, iluminação acolhedora e cardápios buffet variados para comemorar em grande estilo.",
    },
    zh: {
      titulo: "15岁成人礼盛典",
      descripcion: "配备专业音响、温馨灯光与丰盛自助盛宴，为主角打造难忘青春回忆。",
    },
    ja: {
      titulo: "15歳成人祝い (キンセアニェーラ)",
      descripcion: "音響・温かみのある照明設備と多彩なビュッフェメニューで祝宴を演出。",
    },
    ko: {
      titulo: "15세 성인식 파티",
      descripcion: "전문 음향 및 아늑한 조명, 다채로운 뷔페 코스로 특별한 날을 축하합니다.",
    },
  },
  cumpleanos: {
    en: {
      titulo: "Birthdays & Anniversaries",
      descripcion: "Celebrate life with family and friends enjoying wood-fired barbecues, appetizers, and refreshing local drinks.",
    },
    fr: {
      titulo: "Anniversaires & Fêtes",
      descripcion: "Célébrez la vie en famille et entre amis autour de grillades au feu de bois et cocktails rafraîchissants.",
    },
    it: {
      titulo: "Compleanni & Anniversari",
      descripcion: "Festeggia con amici e parenti gustando carni alla brace, antipasti e bevande tipiche rinfrescanti.",
    },
    de: {
      titulo: "Geburtstage & Jubiläen",
      descripcion: "Feiern Sie mit Freunden und Familie bei Holzfeuer-Grillspezialitäten und erfrischenden Drinks.",
    },
    pt: {
      titulo: "Aniversários & Comemorações",
      descripcion: "Comemore com amigos e família saboreando churrascos na brasa, petiscos e bebidas típicas refrescantes.",
    },
    zh: {
      titulo: "生日派对与纪念日",
      descripcion: "与亲朋好友畅聚，品味炭火烧烤拼盘、地道特色小吃与爽口特调饮品。",
    },
    ja: {
      titulo: "お誕生日・各種記念日",
      descripcion: "炭火焼きバーベキューや特製盛り合わせ、爽やかなドリンクで乾杯。",
    },
    ko: {
      titulo: "생일 및 기념일 파티",
      descripcion: "숯불 바비큐 요리와 정갈한 플래터, 시원한 음료와 함께 소중한 시간을 만끽하세요.",
    },
  },
  corporativo: {
    en: {
      titulo: "Corporate Events & Meetings",
      descripcion: "Executive lunches, coffee breaks, and conferences in a private air-conditioned room with high-speed Wi-Fi.",
    },
    fr: {
      titulo: "Événements d'Entreprise",
      descripcion: "Déjeuners exécutifs, pauses-café et réunions dans un salon climatisé privé avec Wi-Fi haut débit.",
    },
    it: {
      titulo: "Eventi Aziendali & Riunioni",
      descripcion: "Pranzi aziendali, coffee break e conferenze in una sala climatizzata privata con Wi-Fi veloce.",
    },
    de: {
      titulo: "Firmenevents & Tagungen",
      descripcion: "Geschäftsessen, Kaffeepausen und Konferenzen im klimatisierten VIP-Raum mit Highspeed-WLAN.",
    },
    pt: {
      titulo: "Eventos Corporativos & Reuniões",
      descripcion: "Almoços executivos, coffee breaks e conferências em sala climatizada privativa com Wi-Fi veloz.",
    },
    zh: {
      titulo: "商务会议与企业活动",
      descripcion: "提供商务行政午餐、茶歇点心及独立空调会议环境，配备高速光纤网络。",
    },
    ja: {
      titulo: "企業研修・ビジネス宴会",
      descripcion: "高速Wi-Fi・冷房完備の個室にて、エグゼクティブランチやコーヒーブレイクを提供。",
    },
    ko: {
      titulo: "기업 세미나 및 비즈니스 모임",
      descripcion: "초고속 Wi-Fi 및 냉난방 완비 단독 룸에서 진행되는 비즈니스 런치 및 커피 브레이크.",
    },
  },
  bautizos: {
    en: {
      titulo: "Baptisms & First Communions",
      descripcion: "A tranquil, welcoming atmosphere with custom menus tailored for both children and adults.",
    },
    fr: {
      titulo: "Baptêmes & Communions",
      descripcion: "Un cadre serein et chaleureux avec des menus gourmands adaptés aux petits et grands.",
    },
    it: {
      titulo: "Battesimi & Prime Comunioni",
      descripcion: "Atmosfera serena e accogliente con menu adatti a grandi e piccini.",
    },
    de: {
      titulo: "Taufen & Erstkommunionen",
      descripcion: "Ruhiges, herzliches Ambiente mit individuellen Menüs für Groß und Klein.",
    },
    pt: {
      titulo: "Batizados & Primeiras Comunhões",
      descripcion: "Ambiente tranquilo e acolhedor com cardápios pensados especialmente para crianças e adultos.",
    },
    zh: {
      titulo: "洗礼仪式与家庭聚会",
      descripcion: "宁静温馨的家庭氛围，专为长辈与儿童量身定制营养美味的专属宴席。",
    },
    ja: {
      titulo: "洗礼式・お子様のお祝い",
      descripcion: "大人からお子様までお楽しみいただける、心温まる特別メニューとおもてなし。",
    },
    ko: {
      titulo: "세례식 및 가족 기념 축하",
      descripcion: "온 가족이 편안히 머물 수 있는 따뜻한 분위기와 남녀노소 맞춤형 정갈한 메뉴.",
    },
  },
  despedidas: {
    en: {
      titulo: "Special Gatherings & Parties",
      descripcion: "Evenings with grilled steaks, select meat platters, cold local beer, and cocktail craft.",
    },
    fr: {
      titulo: "Soirées & Fêtes Privées",
      descripcion: "Dîners autour de grillades savoureuses, bières locales fraîches et cocktails artisanaux.",
    },
    it: {
      titulo: "Cene di Gruppo & Feste Speciali",
      descripcion: "Cene con ottime carni alla brace, birra locale ghiacciata e cocktail ricercati.",
    },
    de: {
      titulo: "Feiern & Besondere Anlässe",
      descripcion: "Abende mit bestem Grillfleisch, eiskaltem nationalem Bier und erlesenen Cocktails.",
    },
    pt: {
      titulo: "Confraternizações & Festas",
      descripcion: "Jantares com carnes nobres grelhadas, cerveja bem gelada e coquetelaria especial.",
    },
    zh: {
      titulo: "欢聚庆典与朋友派对",
      descripcion: "精致炭烤肉排、精选冷饮鲜啤与特色特调鸡尾酒，点燃欢聚热烈氛围。",
    },
    ja: {
      titulo: "歓送迎会・プライベートパーティー",
      descripcion: "極上の炭火焼きステーキ、冷えたビール、カクテルを囲む特別な夜。",
    },
    ko: {
      titulo: "친목 모임 및 환송회",
      descripcion: "엄선된 숯불 스테이크와 시원한 맥주, 다채로운 칵테일이 어우러진 만찬.",
    },
  },
};

const GALLERY_TRANSLATIONS = {
  "/images/slides/slide-ambiente-salon-1.jpg": {
    en: "Salón VIP Climatizado (A/C)",
    fr: "Salon VIP Climatisé",
    it: "Sala VIP Climatizzata",
    de: "Klimatisierter VIP-Saal",
    pt: "Salão VIP Climatizado",
    zh: "独立空调 VIP 宴会大厅",
    ja: "冷房完備 VIPホール",
    ko: "냉난방 완비 VIP 룸",
  },
  "/images/slides/slide-ambiente-luz-1.jpg": {
    en: "Warm & Cozy Ambience",
    fr: "Ambiance Chaleureuse",
    it: "Ambiente Accogliente",
    de: "Gemütliches Ambiente",
    pt: "Ambiente Acolhedor",
    zh: "温馨典雅空间",
    ja: "温かみのある空間",
    ko: "아늑한 패밀리 분위기",
  },
  "/images/slides/slide-mesa-1.jpg": {
    en: "Banquets & Event Tables",
    fr: "Tables de Réception",
    it: "Tavoli per Eventi",
    de: "Festliche Tafeln",
    pt: "Mesas para Eventos",
    zh: "宴会专属席位",
    ja: "宴会・パーティー席",
    ko: "행사 전용 연회 테이블",
  },
  "/images/publicidad/buffet-platos.jpg": {
    en: "Fresh Daily Buffet Bar",
    fr: "Buffet Frais du Jour",
    it: "Barra Buffet Fresco",
    de: "Frische Buffet-Bar",
    pt: "Barra de Buffet Fresco",
    zh: "当日新鲜自选餐台",
    ja: "新鮮ビュッフェバー",
    ko: "신선한 데일리 뷔페 바",
  },
  "/images/publicidad/asados-parrilla-1.jpg": {
    en: "Charcoal Barbecue & Grill",
    fr: "Grillades au Feu de Bois",
    it: "Grigliate alla Brace",
    de: "Holzkohle-Grill",
    pt: "Churrascos na Brasa",
    zh: "传统炭火现烤料理",
    ja: "本格炭火焼きグリル",
    ko: "전통 숯불 구이 바비큐",
  },
  "/images/slides/slide8-barra.jpg": {
    en: "Beverages & Cocktail Bar",
    fr: "Bar à Cocktails & Boissons",
    it: "Bar Drink & Cocktail",
    de: "Getränke- & Cocktailbar",
    pt: "Bar de Bebidas & Coquetéis",
    zh: "特色饮品与特调吧台",
    ja: "ドリンク＆カクテルバー",
    ko: "음료 및 스페셜 칵테일 바",
  },
};

export default function LandingPage() {
  const [lang, setLang] = useState(() => detectBrowserLanguage());
  // Moneda automática según el idioma: C$ NIO si es español, $ USD para los demás idiomas
  const currency = lang === "es" ? "NIO" : "USD";
  const showPrices = true;
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [carouselIdx, setCarouselIdx] = useState(0);

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

  // Rotación automática del carrusel cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIdx((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () =>
    setCarouselIdx((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length);
  const prevSlide = () =>
    setCarouselIdx(
      (prev) =>
        (prev - 1 + HERO_CAROUSEL_SLIDES.length) % HERO_CAROUSEL_SLIDES.length,
    );

  // Título dinámico por idioma para visitantes y turistas
  useEffect(() => {
    const titles = {
      es: "Buffet y Restaurante El Callejón · León, Nicaragua",
      en: "Buffet & Restaurant El Callejón · León, Nicaragua",
      fr: "Buffet & Restaurant El Callejón · León, Nicaragua",
      it: "Buffet e Ristorante El Callejón · León, Nicaragua",
      de: "Buffet & Restaurant El Callejón · León, Nicaragua",
      pt: "Buffet e Restaurante El Callejón · León, Nicaragua",
      zh: "El Callejón 自助餐与特色餐厅 · 尼加拉瓜莱昂",
      ja: "ビュッフェ＆レストラン El Callejón · ニカラグア・レオン",
      ko: "El Callejón 뷔페 & 레스토랑 · 니카라과 레온",
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
    google_maps_embed_url:
      "https://maps.google.com/maps?q=12.4361505,-86.8858488+(Buffet+y+Restaurante+El+Callej%C3%B3n)&t=&z=17&ie=UTF8&iwloc=&output=embed",
    waze_url:
      "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon",
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
      zh: `您好，El Callejón 餐厅，请问今天有这道菜吗：*${dishName}*？`,
      ja: `こんにちは、El Callejón レストラン様。こちらの料理（*${dishName}*）は本日提供されていますか？`,
      ko: `안녕하세요, El Callejón 레스토랑 담당자님. 오늘 이 메뉴（*${dishName}*）주문 가능한가요?`,
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
      image:
        window.location.origin + (info.logo_url || "/logo-el-callejon.png"),
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
            <a
              href="#inicio"
              className="hover:text-orange-600 transition-colors"
            >
              {t.nav.inicio}
            </a>
            <a
              href="#nosotros"
              className="hover:text-orange-600 transition-colors"
            >
              {t.nav.sobre_nosotros}
            </a>
            <a href="#menu" className="hover:text-orange-600 transition-colors">
              {t.nav.menu}
            </a>
            <a
              href="#eventos"
              className="hover:text-orange-600 transition-colors"
            >
              {t.nav.eventos}
            </a>
            <a
              href="#galeria"
              className="hover:text-orange-600 transition-colors"
            >
              {t.nav.galeria}
            </a>
            <a
              href="#ubicacion"
              className="hover:text-orange-600 transition-colors"
            >
              {t.nav.ubicacion}
            </a>
          </nav>

          {/* Selector de idioma y botón WhatsApp */}
          <div className="flex items-center gap-3">
            {/* Selector de Idioma sin emojis */}
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-xs font-bold text-stone-800 transition-all shadow-sm"
                title="Cambiar idioma / Change language"
              >
                <svg
                  className="w-4 h-4 text-amber-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="uppercase text-amber-900 font-extrabold">
                  {lang}
                </span>
                <svg
                  className="w-3.5 h-3.5 text-amber-900 transition-transform group-hover:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col bg-white border border-amber-200 rounded-2xl shadow-xl py-1.5 min-w-[170px] z-50 overflow-hidden">
                {SUPPORTED_LANGUAGES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLang(item.code)}
                    className={`flex items-center justify-between px-4 py-2 text-xs font-semibold text-left transition-colors hover:bg-amber-50 ${
                      lang === item.code
                        ? "text-orange-600 font-extrabold bg-amber-100/50"
                        : "text-stone-800"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                      {item.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA WhatsApp */}
            <a
              href={`https://wa.me/${info.whatsapp_raw || "50585121494"}?text=${encodeURIComponent(
                "¡Hola! Vi el sitio web de Buffet y Restaurante El Callejón y me gustaría más información.",
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
      <section
        id="inicio"
        className="relative min-h-[85vh] lg:min-h-[80vh] flex items-center overflow-hidden bg-gradient-to-b from-black/55 via-black/35 to-black/60 pt-8 pb-16 lg:py-16"
      >
        {/* Destellos y auras de luz cálida */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-orange-500/10 to-transparent pointer-events-none" />
        <div className="absolute top-12 -right-20 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Columna Izquierda: Título de alto impacto, propuesta de valor y llamadas a la acción */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* Badge dorado luminoso sin emojis */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/30 to-amber-500/20 border border-amber-400/80 text-amber-200 text-xs font-extrabold tracking-wide uppercase mb-6 shadow-md backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {lang === "es"
                    ? config?.hero?.badge || "25 Años de Tradición Leonesa · Pioneros del Buffet"
                    : t.hero.badge}
                </span>
              </div>

              <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.12] mb-6 drop-shadow-md">
                {t.hero.title_p1}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 block mt-1">
                  {t.hero.title_p2}
                </span>
              </h1>

              <p className="max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg text-amber-100/90 leading-relaxed mb-8 font-medium drop-shadow-sm">
                {lang === "es"
                  ? config?.hero?.subtitulo || t.hero.subtitle
                  : t.hero.subtitle}
              </p>

              {/* Botones de acción principales sin emojis */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-10">
                <a
                  href="#menu"
                  className="px-7 py-3.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-sm tracking-wide shadow-xl shadow-orange-950/60 hover:scale-105 transition-all"
                >
                  {t.hero.btn_menu}
                </a>
                <a
                  href="#eventos"
                  className="px-7 py-3.5 rounded-full bg-white/95 hover:bg-white text-stone-900 font-extrabold text-sm tracking-wide shadow-md hover:border-orange-500 hover:scale-105 transition-all"
                >
                  {t.hero.btn_eventos}
                </a>
                <a
                  href={
                    info.google_maps_url ||
                    "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-300/60 text-amber-200 font-bold text-sm tracking-wide hover:scale-105 transition-all flex items-center gap-2 shadow-sm backdrop-blur-sm"
                >
                  <svg
                    className="w-4 h-4 text-amber-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>{t.hero.btn_maps}</span>
                </a>
              </div>

              {/* Fila de Confianza y Calidad sin emojis */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 pt-6 border-t border-amber-400/30 text-xs font-bold text-amber-100/90">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-3.5 h-3.5 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span>
                    {lang === "es"
                      ? "4.4 en Google Maps (1,690+ reseñas)"
                      : "4.4 on Google Maps (1,690+ reviews)"}
                  </span>
                </div>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span>
                  {lang === "es"
                    ? "Asados al Carbón & Buffet Diario"
                    : "Charcoal Grill & Daily Buffet"}
                </span>
                <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span>
                  {lang === "es"
                    ? "Salón VIP Climatizado (A/C)"
                    : "A/C Climatized VIP Room"}
                </span>
              </div>
            </div>

            {/* Columna Derecha: CARRUSEL SOBRIO Y ELEGANTE DE IMÁGENES */}
            <div className="lg:col-span-5 relative w-full flex flex-col items-center">
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-[2rem] overflow-hidden shadow-2xl border-2 border-amber-400/30 bg-[#120505] group">
                {/* Slides de imágenes con transición fluida */}
                {HERO_CAROUSEL_SLIDES.map((slide, idx) => {
                  const slideTitle =
                    lang === "es"
                      ? slide.titulo
                      : SLIDE_TRANSLATIONS[slide.id]?.[lang]?.titulo ||
                        SLIDE_TRANSLATIONS[slide.id]?.en?.titulo ||
                        slide.titulo;
                  const slideSub =
                    lang === "es"
                      ? slide.subtitulo
                      : SLIDE_TRANSLATIONS[slide.id]?.[lang]?.subtitulo ||
                        SLIDE_TRANSLATIONS[slide.id]?.en?.subtitulo ||
                        slide.subtitulo;

                  return (
                    <div
                      key={slide.id}
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                        carouselIdx === idx
                          ? "opacity-100 z-10"
                          : "opacity-0 z-0 pointer-events-none"
                      }`}
                    >
                      <img
                        src={slide.imagen}
                        alt={slideTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                      {/* Sombra degradada inferior para legibilidad elegante */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-6 sm:p-7">
                        <h3 className="font-display font-bold text-lg sm:text-xl text-white tracking-tight drop-shadow-sm">
                          {slideTitle}
                        </h3>
                        <p className="text-xs sm:text-sm text-amber-200/90 font-medium line-clamp-2 mt-0.5">
                          {slideSub}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Flecha Anterior */}
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/80 text-white/90 hover:text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 shadow-md cursor-pointer"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Flecha Siguiente */}
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Siguiente"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/80 text-white/90 hover:text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 shadow-md cursor-pointer"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Indicadores de puntos inferiores */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                  {HERO_CAROUSEL_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCarouselIdx(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        carouselIdx === idx
                          ? "w-6 bg-amber-400"
                          : "w-2 bg-white/40 hover:bg-white/70"
                      }`}
                      aria-label={`Ir a diapositiva ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE NOSOTROS: Presentación cálida, editorial y de orgullo gastronómico */}
      <section
        id="nosotros"
        className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative"
      >
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#1a0806]/92 bg-[url('/images/madera-roja-card.jpg')] bg-cover bg-center backdrop-blur-md shadow-2xl border-2 border-amber-500/30 p-6 sm:p-10 lg:p-14 text-white relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Texto */}
            <div className="lg:col-span-7">
              <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest block mb-2">
                {t.about.badge}
              </span>
              <h2 className="font-display font-black text-2xl sm:text-4xl text-amber-100 leading-tight mb-6">
                {t.about.title}
              </h2>
              <p className="text-amber-100/90 text-base leading-relaxed mb-4 font-normal">
                {lang === "es"
                  ? config?.sobre_nosotros?.parrafo_1 || t.about.p1
                  : t.about.p1}
              </p>
              <p className="text-amber-100/90 text-base leading-relaxed mb-8 font-normal">
                {lang === "es"
                  ? config?.sobre_nosotros?.parrafo_2 || t.about.p2
                  : t.about.p2}
              </p>

              {/* Estadísticas / Valores */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-amber-500/30">
                <div className="p-4 rounded-2xl bg-[#280c09]/85 border border-amber-500/35 text-center shadow-lg hover:scale-105 transition-transform">
                  <span className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 bg-clip-text text-transparent block">
                    25+
                  </span>
                  <span className="text-[11px] sm:text-xs text-amber-200/80 font-bold uppercase tracking-wide">
                    {t.about.stat_years}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#280c09]/85 border border-amber-500/35 text-center shadow-lg hover:scale-105 transition-transform">
                  <span className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 bg-clip-text text-transparent block">
                    40+
                  </span>
                  <span className="text-[11px] sm:text-xs text-amber-200/80 font-bold uppercase tracking-wide">
                    {t.about.stat_dishes}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#280c09]/85 border border-amber-500/35 text-center shadow-lg hover:scale-105 transition-transform">
                  <span className="font-display font-black text-2xl sm:text-3xl bg-gradient-to-r from-amber-300 via-orange-400 to-amber-200 bg-clip-text text-transparent block">
                    100%
                  </span>
                  <span className="text-[11px] sm:text-xs text-amber-200/80 font-bold uppercase tracking-wide">
                    {t.about.stat_events}
                  </span>
                </div>
              </div>
            </div>

            {/* Imagen compuesta con marco dorado y sombra cálida */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden border-4 border-amber-500/30 shadow-2xl group">
                <img
                  src={
                    config?.sobre_nosotros?.imagen_secundaria ||
                    "/images/publicidad/buffet-platos.jpg"
                  }
                  alt="Buffet y Restaurante El Callejón"
                  className="w-full h-96 object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end p-6">
                  <div>
                    <span className="text-xs text-amber-400 font-black uppercase tracking-wider block">
                      {lang === "es" ? "Tradición Leonesa" : t.about.badge}
                    </span>
                    <h3 className="font-display font-bold text-lg text-white">
                      {lang === "es"
                        ? "Comida casera servida con orgullo nicaragüense"
                        : t.about.title}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MENÚ & ESPECIALIDADES: Presentación apetitosa, limpia y de alto contraste ("menu-menu-comida") */}
      <section
        id="menu"
        className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative"
      >
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#1a0806]/92 bg-[url('/images/madera-roja-card.jpg')] bg-cover bg-center backdrop-blur-md shadow-2xl border-2 border-amber-500/30 p-6 sm:p-10 lg:p-14 text-white relative overflow-hidden">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest block mb-2">
              {t.menu.badge}
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-amber-100 mb-4">
              {t.menu.title}
            </h2>
            <p className="text-amber-200/80 text-sm sm:text-base">
              {t.menu.subtitle}
            </p>
          </div>

          {/* Filtros de categorías: Píldoras coloridas y dinámicas */}
          {categories.length > 2 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-xs font-extrabold capitalize transition-all shadow-sm cursor-pointer ${
                    activeCategory === cat
                      ? "bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 text-white shadow-md shadow-orange-500/25 scale-105"
                      : "bg-[#280c09]/80 border border-amber-500/30 text-amber-200 hover:border-amber-400 hover:bg-[#34110d]"
                  }`}
                >
                  {cat === "all"
                    ? t.menu.all
                    : t.menu[cat.toLowerCase()] || cat}
                </button>
              ))}
            </div>
          )}

          {/* Grid de Platillos: Tarjetas gourmet sobre fondo de madera roja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredMenuItems.map((dish) => {
              const displayPrice =
                currency === "USD"
                  ? `$ ${Number(dish.precio_usd || dish.precio_nio / 36.7).toFixed(2)}`
                  : `C$ ${Number(dish.precio_nio || 0).toFixed(2)}`;

              return (
                <div
                  key={dish.id}
                  className="rounded-3xl bg-[#280c09]/90 border border-amber-500/30 shadow-xl hover:shadow-2xl hover:border-amber-400 hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col group"
                >
                  <div className="relative h-48 sm:h-52 overflow-hidden bg-black/40">
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
                        {lang === "es" ? "Especial" : "Special"}
                      </span>
                    )}
                    {dish.categoria && (
                      <span className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md text-amber-200 text-[10px] font-bold px-3 py-1 rounded-full border border-amber-500/40 shadow-sm">
                        {t.menu[dish.categoria.toLowerCase()] || dish.categoria}
                      </span>
                    )}
                  </div>

                  <div className="p-6 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <h3 className="font-display font-bold text-lg text-white group-hover:text-amber-300 transition-colors leading-snug">
                          {dish.nombre}
                        </h3>
                        <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                          {displayPrice}
                        </span>
                      </div>
                      <p className="text-xs text-amber-100/80 leading-relaxed mb-5">
                        {dish.descripcion}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickOrder(dish.nombre)}
                      className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-[#25d366] text-amber-100 hover:text-white border border-amber-500/40 hover:border-[#25d366] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
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
      <section
        id="eventos"
        className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative"
      >
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#1a0806]/92 bg-[url('/images/madera-roja-card.jpg')] bg-cover bg-center backdrop-blur-md shadow-2xl border-2 border-amber-500/30 p-6 sm:p-10 lg:p-14 text-white relative overflow-hidden">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest block mb-2">
              {t.events.badge}
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-amber-100 mb-4 drop-shadow-md">
              {t.events.title}
            </h2>
            <p className="text-amber-200/80 text-sm sm:text-base">
              {t.events.subtitle}
            </p>
          </div>

          {/* Cards de Tipos de Eventos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {eventsList.map((evt) => {
              const evtTitle =
                lang === "es"
                  ? evt.titulo
                  : EVENT_TRANSLATIONS[evt.id]?.[lang]?.titulo ||
                    EVENT_TRANSLATIONS[evt.id]?.en?.titulo ||
                    evt.titulo;
              const evtDesc =
                lang === "es"
                  ? evt.descripcion
                  : EVENT_TRANSLATIONS[evt.id]?.[lang]?.descripcion ||
                    EVENT_TRANSLATIONS[evt.id]?.en?.descripcion ||
                    evt.descripcion;

              return (
                <div
                  key={evt.id}
                  className="rounded-3xl bg-[#280c09]/90 border border-amber-500/30 overflow-hidden shadow-xl hover:shadow-2xl hover:border-amber-400 hover:-translate-y-1 transition-all p-6 flex flex-col justify-between backdrop-blur-sm"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <h3 className="font-display font-bold text-lg text-white">
                        {evtTitle}
                      </h3>
                    </div>
                    <p className="text-xs text-amber-100/80 leading-relaxed mb-4">
                      {evtDesc}
                    </p>
                  </div>
                  {evt.imagen && (
                    <div className="h-36 rounded-2xl overflow-hidden mt-2 border border-amber-500/30">
                      <img
                        src={evt.imagen}
                        alt={evtTitle}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formulario Interactivo de Cotización Directa a WhatsApp */}
          <div className="max-w-3xl mx-auto bg-[#280c09]/95 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="text-center mb-8">
              <h3 className="font-display font-black text-2xl text-white mb-2">
                {t.events.form_title}
              </h3>
              <p className="text-xs sm:text-sm text-amber-200/80">
                {t.events.form_desc}
              </p>
            </div>

            <form onSubmit={handleQuoteSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-amber-200 mb-1.5">
                    {t.events.input_name} *
                  </label>
                  <input
                    type="text"
                    required
                    value={quoteForm.name}
                    onChange={(e) =>
                      setQuoteForm({ ...quoteForm, name: e.target.value })
                    }
                    placeholder={t.events.input_name_ph}
                    className="w-full bg-black/50 border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:bg-black/70 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-200 mb-1.5">
                    {t.events.input_type}
                  </label>
                  <select
                    value={quoteForm.type}
                    onChange={(e) =>
                      setQuoteForm({ ...quoteForm, type: e.target.value })
                    }
                    className="w-full bg-black/50 border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white focus:bg-black/70 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  >
                    {Object.entries(t.events.types).map(([key, label]) => (
                      <option key={key} value={key} className="bg-stone-900 text-white">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-amber-200 mb-1.5">
                    {t.events.input_date}
                  </label>
                  <input
                    type="date"
                    value={quoteForm.date}
                    onChange={(e) =>
                      setQuoteForm({ ...quoteForm, date: e.target.value })
                    }
                    className="w-full bg-black/50 border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white focus:bg-black/70 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-200 mb-1.5">
                    {t.events.input_guests}
                  </label>
                  <input
                    type="text"
                    value={quoteForm.guests}
                    onChange={(e) =>
                      setQuoteForm({ ...quoteForm, guests: e.target.value })
                    }
                    placeholder={t.events.input_guests_ph}
                    className="w-full bg-black/50 border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:bg-black/70 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1.5">
                  {t.events.input_notes}
                </label>
                <textarea
                  rows={3}
                  value={quoteForm.notes}
                  onChange={(e) =>
                    setQuoteForm({ ...quoteForm, notes: e.target.value })
                  }
                  placeholder={t.events.input_notes_ph}
                  className="w-full bg-black/50 border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:bg-black/70 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#25d366] to-[#128c7e] text-white font-black text-sm tracking-wide shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                </svg>
                <span>{t.events.btn_submit}</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* GALERÍA DE INSTALACIONES */}
      <section
        id="galeria"
        className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative"
      >
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#1a0806]/92 bg-[url('/images/madera-roja-card.jpg')] bg-cover bg-center backdrop-blur-md shadow-2xl border-2 border-amber-500/30 p-6 sm:p-10 lg:p-14 text-white relative overflow-hidden">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest block mb-2">
              {t.gallery.badge}
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-amber-100 mb-4 drop-shadow-md">
              {t.gallery.title}
            </h2>
            <p className="text-amber-200/80 text-sm sm:text-base">
              {t.gallery.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {gallery.map((img, idx) => {
              const galleryTitle =
                lang === "es"
                  ? img.titulo
                  : GALLERY_TRANSLATIONS[img.url]?.[lang] ||
                    GALLERY_TRANSLATIONS[img.url]?.en ||
                    img.titulo;

              return (
                <div
                  key={idx}
                  className="relative rounded-3xl overflow-hidden h-52 sm:h-64 border-2 border-amber-500/30 shadow-xl group cursor-pointer"
                >
                  <img
                    src={img.url}
                    alt={galleryTitle || "Instalaciones El Callejón"}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <span className="font-display font-bold text-sm text-white drop-shadow-sm">
                      {galleryTitle}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* UBICACIÓN & CONTACTO */}
      <section
        id="ubicacion"
        className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative"
      >
        <div className="max-w-7xl mx-auto rounded-[2.5rem] bg-[#1a0806]/92 bg-[url('/images/madera-roja-card.jpg')] bg-cover bg-center backdrop-blur-md shadow-2xl border-2 border-amber-500/30 p-6 sm:p-10 lg:p-14 text-white relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest block mb-2">
                  {t.location.badge}
                </span>
                <h2 className="font-display font-black text-3xl sm:text-4xl text-amber-100 mb-2 drop-shadow-md">
                  {t.location.title}
                </h2>
                <p className="text-amber-200/80 text-sm">
                  {lang === "es" ? info.horarios_texto : t.location.hours_text}
                </p>
              </div>

              {/* Dirección */}
              <div className="p-5 rounded-2xl bg-[#280c09]/90 border border-amber-500/30 shadow-xl backdrop-blur-sm">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-orange-500/20 text-amber-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white mb-1">
                      {t.location.address_title}
                    </h3>
                    <p className="text-xs text-amber-100/80 leading-relaxed">
                      {lang === "es" ? info.direccion : t.location.address_text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Horario */}
              <div className="p-5 rounded-2xl bg-[#280c09]/90 border border-amber-500/30 shadow-xl backdrop-blur-sm">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white mb-1">
                      {t.location.hours_title}
                    </h3>
                    <p className="text-xs text-amber-100/80 leading-relaxed">
                      {lang === "es" ? info.horarios_texto : t.location.hours_text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contacto Directo */}
              <div className="p-5 rounded-2xl bg-[#280c09]/90 border border-amber-500/30 shadow-xl backdrop-blur-sm">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white mb-1">
                      {t.location.contact_title}
                    </h3>
                    <p className="text-xs text-amber-100/80 mb-1">
                      WhatsApp / Tel:{" "}
                      <strong className="text-amber-300">
                        {info.telefono}
                      </strong>
                    </p>
                    <p className="text-xs text-amber-100/80">
                      Email:{" "}
                      <strong className="text-amber-300">{info.email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de Navegación GPS */}
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={
                    info.google_maps_url ||
                    "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-transform hover:scale-105"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>{t.location.btn_open_maps}</span>
                </a>
                <a
                  href={
                    info.waze_url ||
                    "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-[#00c6ff] hover:bg-[#00b0e6] text-stone-900 font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20 transition-transform hover:scale-105"
                >
                  <span>{t.location.btn_open_waze}</span>
                </a>
              </div>
            </div>

            {/* Mapa Interactivo con carga diferida anti-bloqueo */}
            <div className="lg:col-span-7 h-96 rounded-3xl overflow-hidden border-4 border-amber-500/35 shadow-2xl relative">
              {mapLoaded ? (
                <iframe
                  title="Mapa de Ubicación El Callejón"
                  src={
                    info.google_maps_embed_url ||
                    "https://maps.google.com/maps?q=12.4361505,-86.8858488+(Buffet+y+Restaurante+El+Callej%C3%B3n)&t=&z=17&ie=UTF8&iwloc=&output=embed"
                  }
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="w-full h-full bg-[#280c09]/90 flex flex-col items-center justify-center p-6 text-center text-white">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mb-3 shadow-sm">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <p className="font-bold text-base text-white mb-1">
                    {info.nombre}
                  </p>
                  <p className="text-xs text-amber-200/80 max-w-sm mb-4">
                    {lang === "es" ? info.direccion : t.location.address_text}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMapLoaded(true)}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs transition-all shadow-md shadow-orange-500/25 cursor-pointer"
                  >
                    {lang === "es" ? "Ver Mapa Interactivo" : (t.location.btn_open_maps || "View Interactive Map")}
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
              <p className="font-display font-extrabold text-sm text-white">
                {info.nombre}
              </p>
              <p className="text-[11px] text-amber-400 font-bold">
                {info.eslogan}
              </p>
            </div>
          </div>

          <p className="text-stone-300 font-medium">{t.footer.rights}</p>

          <div className="flex items-center gap-3 text-xs font-semibold text-amber-300/80">
            <span>León, Nicaragua</span>
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
