import { useCallback, useMemo } from "react";
import MenuBoardScreen from "../components/tv/MenuBoardScreen";
import TvRuntimeShell from "../components/tv/TvRuntimeShell";
import { sortMenuItems } from "../components/tv/MenuBoard";
import { useMenuTv } from "../hooks/useMenuTv";
import { imageForProduct, imageForProductCard } from "../lib/constants";

/**
 * TV 50" #2 — Complementos + runtime industrial.
 */
export default function PantallaComplementosPage() {
  const { menu, flash, ready } = useMenuTv();

  const items = useMemo(() => {
    const extras = sortMenuItems(menu.extras || []);
    const jugos = sortMenuItems(menu.jugos || []);
    const bebidas = sortMenuItems(menu.bebidas || []);
    const cafes = sortMenuItems(menu.cafes || []);
    const licores = sortMenuItems(menu.licores || []);
    return [...extras, ...jugos, ...bebidas, ...cafes, ...licores];
  }, [menu]);

  const heroPool = useMemo(() => {
    const all = items.filter(Boolean);
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
  }, [items]);

  const mid = Math.ceil(items.length / 2) || 1;
  const colLeft = items.slice(0, mid);
  const colRight = items.slice(mid);

  const snapshotExtra = useCallback(() => {
    const hero = heroPool[0] || items[0];
    const preview =
      hero?.imgCard ||
      hero?.img ||
      (hero
        ? imageForProductCard(hero.c, hero.tp, hero.imgV) ||
          imageForProduct(hero.c, hero.tp, hero.imgV)
        : null) ||
      "/images/bebidas/jugos-naturales.jpg";
    return {
      screen: "complementos",
      n_items: items.length,
      ready,
      display_ready: !!ready && items.length > 0,
      preview_url: preview,
      label: hero?.n || "Complementos",
    };
  }, [items, heroPool, ready]);

  return (
    <TvRuntimeShell tvId={2} snapshotExtra={snapshotExtra}>
      <MenuBoardScreen
        boardKey="complementos"
        ready={ready}
        loadingText="Cargando complementos…"
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
