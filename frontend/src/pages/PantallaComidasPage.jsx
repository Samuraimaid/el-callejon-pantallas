import { useMemo } from "react";
import MenuBoardScreen from "../components/tv/MenuBoardScreen";
import { sortMenuItems } from "../components/tv/MenuBoard";
import { useMenuTv } from "../hooks/useMenuTv";

/**
 * TV 50" #1 — Solo platillos, layout menú board a pantalla completa.
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

  return (
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
  );
}
