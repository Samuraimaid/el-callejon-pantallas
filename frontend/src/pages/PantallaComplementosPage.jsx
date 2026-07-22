import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "../components/Logo";
import TvHeader from "../components/tv/TvHeader";
import {
  MenuBoardHero,
  MenuBoardItem,
  MenuBoardPanel,
  sortMenuItems,
} from "../components/tv/MenuBoard";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { useMenuTv } from "../hooks/useMenuTv";

const SECTIONS = [
  {
    key: "jugos",
    title: "Jugos naturales",
    subtitle: "100% frescos",
  },
  {
    key: "bebidas",
    title: "Bebidas",
    subtitle: "Sodas y aguas",
  },
  {
    key: "cafes",
    title: "Cafés",
    subtitle: "Calientes y clásicos",
  },
  {
    key: "licores",
    title: "Licores",
    subtitle: "Barra de la casa",
  },
  {
    key: "extras",
    title: "Extras",
    subtitle: "Porciones extras",
  },
];

/**
 * TV 50" #2 — Complementos en layout menú board comercial sobre roble.
 */
export default function PantallaComplementosPage() {
  const { menu, flash, ready, wsStatus } = useMenuTv();
  const [clock, setClock] = useState(() => new Date());
  const scrollRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useAutoScroll(scrollRef, {
    pxPerFrame: 0.85,
    pauseMs: 3500,
    enabled: true,
    startDelayMs: 800,
  });

  const blocks = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        items: sortMenuItems(menu[s.key] || []),
      })),
    [menu]
  );

  const heroPool = useMemo(() => {
    const all = blocks.flatMap((b) => b.items);
    const marked = all.filter((p) => p.dst === 1 || p.dst === true);
    if (marked.length) return marked;
    return all.filter((p) => p.tp === "bebida_jugo" || p.tp === "cafe").slice(0, 5);
  }, [blocks]);

  return (
    <div className="bg-oak-wood relative h-screen max-h-screen overflow-hidden text-ivory">
      <header className="block h-[120px] w-full shrink-0 overflow-hidden">
        <TvHeader
          subtitle="Complementos · TV #2 · 50″ · Board en vivo"
          wsStatus={wsStatus}
          clock={clock}
        />
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-none block h-[calc(100vh-120px)] overflow-y-auto"
        style={{
          height: "calc(100vh - 120px)",
          maxHeight: "calc(100vh - 120px)",
        }}
        data-autoscroll="complementos"
      >
        <div className="space-y-4 p-4 pb-20">
          {!ready && (
            <p className="py-16 text-center text-2xl text-cream/50">
              Cargando complementos…
            </p>
          )}

          <div className="grid grid-cols-12 gap-3 xl:gap-4">
            <div className="col-span-12 min-h-[300px] lg:col-span-4 lg:min-h-[440px]">
              <MenuBoardHero
                products={heroPool}
                intervalMs={7000}
                title="Recomendados"
              />
            </div>

            <div className="col-span-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:col-span-8">
              {blocks.map((block) =>
                block.items.length ? (
                  <MenuBoardPanel
                    key={block.key}
                    title={block.title}
                    subtitle={block.subtitle}
                    className="min-h-[200px]"
                  >
                    {block.items.map((p, i) => (
                      <MenuBoardItem
                        key={p.id}
                        p={p}
                        index={i}
                        flash={flash === p.c}
                        dense
                      />
                    ))}
                  </MenuBoardPanel>
                ) : null
              )}
            </div>
          </div>

          {ready && blocks.every((b) => !b.items.length) && (
            <p className="py-12 text-center text-xl text-cream/45">
              Sin complementos activos
            </p>
          )}

          <section className="panel-oak-deep rounded-2xl px-6 py-5 text-center">
            <p className="font-display text-2xl text-ivory">
              Cada detalle importa · cada sabor permanece
            </p>
            <p className="mt-1 text-gold-soft">El Callejón · León, Nicaragua</p>
          </section>

          <footer className="flex items-center justify-between px-1 text-cream/55">
            <span className="text-sm">TV #2 · /pantalla/complementos</span>
            <Logo size="sm" />
          </footer>
        </div>
      </div>
    </div>
  );
}
