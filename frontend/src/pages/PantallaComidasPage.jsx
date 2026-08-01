import { useCallback, useMemo } from "react";
import MenuBoardScreen from "../components/tv/MenuBoardScreen";
import TvRuntimeShell from "../components/tv/TvRuntimeShell";
import { sortMenuItems } from "../components/tv/MenuBoard";
import { useMenuTv } from "../hooks/useMenuTv";
import { imageForProduct, imageForProductCard } from "../lib/constants";

/**
 * TV 50" #1 — Menú comidas + runtime industrial (cache/HB/power).
 */
export default function PantallaComidasPage() {
  const { menu, flash, ready } = useMenuTv();

  const platillos = useMemo(
    () => sortMenuItems(menu.platillos || []),
    [menu.platillos]
  );

  const heroPool = useMemo(() => {
    const all = platillos.filter(Boolean);
    if (!all.length) return [];
    const promos = all.filter((p) => p.dst === 1 || p.dst === true);
    const seen = new Set();
    const ordered = [];
    for (const p of [...promos, ...all]) {
      const key = p.id || p.c;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(p);
    }
    return ordered;
  }, [platillos]);

  const mid = Math.ceil(platillos.length / 2) || 1;
  const colLeft = platillos.slice(0, mid);
  const colRight = platillos.slice(mid);

  const snapshotExtra = useCallback(() => {
    const hero = heroPool[0] || platillos[0];
    const preview =
      hero?.imgCard ||
      hero?.img ||
      (hero
        ? imageForProductCard(hero.c, hero.tp, hero.imgV) ||
          imageForProduct(hero.c, hero.tp, hero.imgV)
        : null) ||
      "/images/slides/slide-platos-mixtos.jpg";
    return {
      screen: "comidas",
      n_platillos: platillos.length,
      ready,
      display_ready: !!ready && platillos.length > 0,
      preview_url: preview,
      label: hero?.n || "Menú comidas",
    };
  }, [platillos, heroPool, ready]);

  return (
    <TvRuntimeShell tvId={1} snapshotExtra={snapshotExtra}>
      <MenuBoardScreen
        boardKey="comidas"
        ready={ready}
        loadingText="Cargando platillos…"
        colLeft={colLeft}
        colRight={colRight}
        heroPool={heroPool}
        flash={flash}
        leftIndexBase={0}
        rightIndexBase={mid}
      />
    </TvRuntimeShell>
  );
}
