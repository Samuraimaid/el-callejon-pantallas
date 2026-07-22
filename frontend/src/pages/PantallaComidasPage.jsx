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
import { isAgotado, useMenuTv } from "../hooks/useMenuTv";

/**
 * TV 50" #1 — Menú board estilo franquicia sobre roble.
 * Hero central rota por TODOS los platillos + promociones (destacados).
 * Scroll vertical automático recorre la lista completa y extras.
 */
export default function PantallaComidasPage() {
  const { menu, flash, ready, wsStatus } = useMenuTv();
  const [clock, setClock] = useState(() => new Date());
  const scrollRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useAutoScroll(scrollRef, {
    pxPerFrame: 0.9,
    pauseMs: 4000,
    enabled: true,
    startDelayMs: 900,
  });

  const platillos = useMemo(
    () => sortMenuItems(menu.platillos || []),
    [menu.platillos]
  );
  const extras = useMemo(
    () => sortMenuItems(menu.extras || []),
    [menu.extras]
  );

  /** Carrusel: todos los platillos + destacados al frente como promo del día */
  const heroPool = useMemo(() => {
    const all = platillos.filter(Boolean);
    if (!all.length) return [];
    // Promos (destacados) primero, luego el resto sin duplicar
    const promos = all.filter((p) => p.dst === 1 || p.dst === true);
    const rest = all.filter((p) => !(p.dst === 1 || p.dst === true));
    // Orden: cada promo, luego todos los platillos en orden de combo
    // para que el ciclo cubra 100% del menú + énfasis en promociones
    const seen = new Set();
    const ordered = [];
    for (const p of [...promos, ...all]) {
      const key = p.id || p.c;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(p);
    }
    // Si no hay promos, es simplemente la lista completa
    return ordered.length ? ordered : rest.length ? rest : all;
  }, [platillos]);

  const promociones = useMemo(
    () =>
      platillos.filter(
        (p) => (p.dst === 1 || p.dst === true) && !isAgotado(p)
      ),
    [platillos]
  );

  // Columnas laterales: lista completa en dos mitades (siempre todos)
  const mid = Math.ceil(platillos.length / 2) || 1;
  const colLeft = platillos.slice(0, mid);
  const colRight = platillos.slice(mid);

  return (
    <div className="bg-oak-wood relative h-screen max-h-screen overflow-hidden text-ivory">
      <header className="block h-[112px] w-full shrink-0 overflow-hidden">
        <TvHeader
          subtitle={`Menú del día · ${platillos.length} platillos · Board en vivo`}
          wsStatus={wsStatus}
          clock={clock}
        />
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-none block h-[calc(100vh-112px)] overflow-y-auto"
        style={{
          height: "calc(100vh - 112px)",
          maxHeight: "calc(100vh - 112px)",
        }}
        data-autoscroll="comidas"
      >
        <div className="space-y-4 p-4 pb-28">
          {!ready && (
            <p className="py-16 text-center text-2xl text-cream/50">
              Cargando menú board…
            </p>
          )}

          {/* Fila principal: lista completa + hero de TODOS los platillos */}
          <div className="grid grid-cols-12 gap-3 xl:gap-4">
            <MenuBoardPanel
              title="Platillos"
              subtitle={`1–${colLeft.length || 0} · lista completa`}
              className="col-span-12 lg:col-span-3"
            >
              <div className="space-y-2">
                {colLeft.map((p, i) => (
                  <MenuBoardItem
                    key={p.id}
                    p={p}
                    index={i}
                    flash={flash === p.c}
                    dense
                  />
                ))}
                {ready && !colLeft.length && (
                  <p className="py-8 text-center text-cream/45">Sin platillos</p>
                )}
              </div>
            </MenuBoardPanel>

            <div className="col-span-12 min-h-[420px] lg:col-span-6 lg:min-h-[560px]">
              <MenuBoardHero
                products={heroPool}
                intervalMs={5000}
                title="Menú del día"
                includeAgotados={false}
              />
              <p className="mt-2 text-center text-xs text-cream/50">
                Carrusel: {heroPool.length} platillos
                {promociones.length
                  ? ` · ${promociones.length} promoción(es) del día`
                  : ""}{" "}
                · efectos aleatorios
              </p>
            </div>

            <MenuBoardPanel
              title="Más opciones"
              subtitle={
                colRight.length
                  ? `${mid + 1}–${platillos.length}`
                  : "Continúa el menú"
              }
              className="col-span-12 lg:col-span-3"
            >
              <div className="space-y-2">
                {colRight.map((p, i) => (
                  <MenuBoardItem
                    key={p.id}
                    p={p}
                    index={mid + i}
                    flash={flash === p.c}
                    dense
                  />
                ))}
                {ready && !colRight.length && colLeft.length > 0 && (
                  <p className="py-6 text-center text-sm text-cream/40">
                    Todos los platillos a la izquierda
                  </p>
                )}
              </div>
            </MenuBoardPanel>
          </div>

          {/* Promociones del día (destacados) — lista + segundo hero si hay varias */}
          {!!promociones.length && (
            <div className="grid grid-cols-12 gap-3">
              <MenuBoardPanel
                title="Promociones del día"
                subtitle="Marcadas como ⭐ Destacado en el control"
                className="col-span-12 lg:col-span-5"
              >
                <div className="space-y-2">
                  {promociones.map((p, i) => (
                    <MenuBoardItem
                      key={`promo-${p.id}`}
                      p={p}
                      index={i}
                      flash={flash === p.c}
                      dense
                    />
                  ))}
                </div>
              </MenuBoardPanel>
              <div className="col-span-12 min-h-[320px] lg:col-span-7 lg:min-h-[380px]">
                <MenuBoardHero
                  products={promociones}
                  intervalMs={4500}
                  title="Promoción del día"
                />
              </div>
            </div>
          )}

          {/* Todos los platillos en una sola franja scrolleable (refuerzo de lista completa) */}
          {platillos.length > 0 && (
            <MenuBoardPanel
              title="Carta completa"
              subtitle={`${platillos.length} platillos · scroll automático`}
              className="w-full"
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {platillos.map((p, i) => (
                  <MenuBoardItem
                    key={`full-${p.id}`}
                    p={p}
                    index={i}
                    flash={flash === p.c}
                    dense
                  />
                ))}
              </div>
            </MenuBoardPanel>
          )}

          {!!extras.length && (
            <MenuBoardPanel
              title="Extras"
              subtitle="Complementa tu plato"
              className="w-full"
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {extras.map((p, i) => (
                  <MenuBoardItem
                    key={p.id}
                    p={p}
                    index={i}
                    flash={flash === p.c}
                    dense
                  />
                ))}
              </div>
            </MenuBoardPanel>
          )}

          <section className="panel-oak-deep rounded-2xl px-6 py-5 text-center">
            <p className="font-display text-2xl text-ivory">
              Sabor auténtico · Tradición de León
            </p>
            <p className="mt-1 text-gold-soft">
              Buffet-Restaurante El Callejón
            </p>
          </section>

          <footer className="flex items-center justify-between px-1 text-cream/55">
            <span className="text-sm">
              TV #1 · {platillos.length} platillos · autoscroll
            </span>
            <Logo size="sm" />
          </footer>
        </div>
      </div>
    </div>
  );
}
