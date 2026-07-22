import { LOGO_URL, LOGO_URL_FALLBACK } from "../lib/constants";

/**
 * @param {{ size?: string, className?: string, showText?: boolean, variant?: 'default' | 'tv', style?: object }} props
 * variant "tv": sin círculo; PNG transparente. style se aplica al <img> (contorno, etc.).
 */
export default function Logo({
  size = "md",
  className = "",
  showText = false,
  variant = "default",
  style,
}) {
  const sizes = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    tv: "h-full w-auto max-h-full max-w-full",
    lg: "h-20 w-20",
    xl: "h-28 w-28",
    voucher: "h-16 w-16",
  };

  const isTv = variant === "tv" || size === "tv";

  return (
    <div
      className={`flex items-center gap-3 ${isTv ? "h-full w-full justify-center" : ""} ${className}`}
    >
      <img
        src={LOGO_URL}
        alt="Buffet-Restaurante El Callejón"
        className={
          isTv
            ? `${sizes.tv} object-contain`
            : `${sizes[size] || sizes.md} rounded-full object-cover shadow-md ring-2 ring-amber-500/40 bg-yellow-300`
        }
        style={isTv ? style : undefined}
        draggable={false}
        onError={(e) => {
          if (e.currentTarget.src.indexOf("logo-el-callejon.jpg") === -1) {
            e.currentTarget.src = LOGO_URL_FALLBACK;
          }
        }}
      />
      {showText && !isTv && (
        <div className="leading-tight">
          <p className="font-display text-lg text-amber-100">El Callejón</p>
          <p className="text-xs text-stone-400">Buffet · León, NI</p>
        </div>
      )}
    </div>
  );
}
