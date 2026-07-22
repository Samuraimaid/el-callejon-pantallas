import { LOGO_URL } from "../lib/constants";

export default function Logo({
  size = "md",
  className = "",
  showText = false,
}) {
  const sizes = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20",
    xl: "h-28 w-28",
    voucher: "h-16 w-16",
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={LOGO_URL}
        alt="Buffet-Restaurante El Callejón"
        className={`${sizes[size] || sizes.md} rounded-full object-cover shadow-md ring-2 ring-amber-500/40 bg-yellow-300`}
        draggable={false}
      />
      {showText && (
        <div className="leading-tight">
          <p className="font-display text-lg text-amber-100">El Callejón</p>
          <p className="text-xs text-stone-400">Buffet · León, NI</p>
        </div>
      )}
    </div>
  );
}
