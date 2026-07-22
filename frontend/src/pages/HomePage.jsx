import { Link } from "react-router-dom";
import Logo from "../components/Logo";

const SCREENS = [
  {
    to: "/pantalla/comidas",
    label: "TV #1 · Menú Comidas 50″",
    desc: "12 platillos + extras · autoscroll",
  },
  {
    to: "/pantalla/complementos",
    label: "TV #2 · Complementos 50″",
    desc: "Jugos, refrescos y cafés",
  },
  {
    to: "/pantalla/publicidad/barra",
    label: "TV #3–#4 · Publicidad Barra 50″",
    desc: "Carrusel + mensajes del Chef",
  },
  {
    to: "/pantalla/publicidad/vip",
    label: "TV #5–#6 · Publicidad VIP 60″",
    desc: "Campaña independiente + mensajes",
  },
];

export default function HomePage() {
  return (
    <div className="bg-oak-wood flex h-full min-h-screen flex-col items-center justify-center gap-8 p-6 text-ivory">
      <Logo size="xl" showText />
      <h1 className="font-display text-center text-3xl text-ivory">
        El Callejón · Pantallas Digitales
      </h1>
      <p className="max-w-md text-center text-cream/70">
        Cartelería en tiempo real · 6 Smart TVs · León, Nicaragua
      </p>
      <div className="grid w-full max-w-lg gap-3">
        <Link
          to="/login"
          className="tap rounded-2xl bg-gradient-to-r from-[#a33a28] to-[#d4a84b] py-4 text-center text-lg font-bold text-[#1a120c]"
        >
          Centro de Control de Pantallas
        </Link>
        {SCREENS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="tap panel-oak rounded-2xl px-4 py-4 text-center"
          >
            <span className="block text-lg font-semibold text-ivory">
              {s.label}
            </span>
            <span className="mt-0.5 block text-sm text-cream/55">{s.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
