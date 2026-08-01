import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Si el texto no cabe en el contenedor, marquesina horizontal infinita.
 * Si cabe, se muestra estático (sin puntos suspensivos).
 */
export default function OverflowMarquee({
  children,
  className = "",
  enabled = true,
  speedPxS = 42,
  title,
}) {
  const outerRef = useRef(null);
  const measureRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [durationS, setDurationS] = useState(10);

  const text =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;

  useLayoutEffect(() => {
    if (!enabled) {
      setOverflow(false);
      return undefined;
    }
    const outer = outerRef.current;
    const measure = measureRef.current;
    if (!outer || !measure) return undefined;

    const check = () => {
      const ow = outer.clientWidth;
      const iw = measure.scrollWidth;
      const over = iw > ow + 2;
      setOverflow(over);
      if (over) {
        const dist = iw + 32;
        const speed = Math.max(12, Number(speedPxS) || 42);
        setDurationS(Math.max(5, Math.min(90, dist / speed)));
      }
    };

    check();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(check);
      ro.observe(outer);
      ro.observe(measure);
    }
    const t = window.setTimeout(check, 80);
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", check);
      ro?.disconnect();
    };
  }, [children, enabled, speedPxS]);

  // Re-medir cuando cambian fuentes / layout TV
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setTimeout(() => {
      const outer = outerRef.current;
      const measure = measureRef.current;
      if (!outer || !measure) return;
      const over = measure.scrollWidth > outer.clientWidth + 2;
      setOverflow(over);
    }, 300);
    return () => window.clearTimeout(id);
  }, [children, enabled]);

  const label = title || (text ?? undefined);

  if (!enabled) {
    return (
      <span className={`block min-w-0 truncate ${className}`} title={label}>
        {children}
      </span>
    );
  }

  return (
    <div
      ref={outerRef}
      className={`overflow-marquee ${overflow ? "is-overflow" : ""} ${className}`}
      title={label}
    >
      {/* Medidor oculto (ancho real del texto) */}
      <span ref={measureRef} className="overflow-marquee-measure" aria-hidden>
        {children}
      </span>

      {overflow ? (
        <div
          className="overflow-marquee-track"
          style={{ animationDuration: `${durationS}s` }}
        >
          <span className="overflow-marquee-item">{children}</span>
          <span className="overflow-marquee-gap" aria-hidden>
            {"  ·  "}
          </span>
          <span className="overflow-marquee-item" aria-hidden>
            {children}
          </span>
          <span className="overflow-marquee-gap" aria-hidden>
            {"  ·  "}
          </span>
        </div>
      ) : (
        <span className="overflow-marquee-static">{children}</span>
      )}
    </div>
  );
}
