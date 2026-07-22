import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";

export default function LoginPage() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("admin");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(usuario.trim(), password);
      setSession(res.access_token, res.usuario);
      nav("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-oak-wood flex h-full min-h-screen items-center justify-center p-4 text-ivory">
      <div className="panel-oak w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="xl" />
          <h1 className="font-display mt-4 text-3xl text-ivory">
            Centro de Control
          </h1>
          <p className="mt-1 text-sm text-cream/70">
            Pantallas digitales · El Callejón
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-cream/70">Usuario</span>
            <input
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="tap w-full rounded-2xl border border-[rgba(232,197,106,0.25)] bg-black/35 px-4 py-4 text-lg text-ivory outline-none focus:border-gold"
              placeholder="admin"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-cream/70">
              Contraseña / PIN
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="tap w-full rounded-2xl border border-[rgba(232,197,106,0.25)] bg-black/35 px-4 py-4 text-lg text-ivory outline-none focus:border-gold"
              placeholder="••••"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-rose-950/60 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="tap w-full rounded-2xl bg-gradient-to-r from-[#a33a28] to-[#d4a84b] py-4 text-lg font-bold text-[#1a120c] shadow-lg disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar al control"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-cream/45">
          Dev: admin / operador · PIN 1234
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-cream/55">
          <a href="/pantalla/comidas" className="underline hover:text-gold">
            TV Menú
          </a>
          <span>·</span>
          <a
            href="/pantalla/publicidad/barra"
            className="underline hover:text-gold"
          >
            TV Barra
          </a>
          <span>·</span>
          <a href="/pantalla/publicidad/vip" className="underline hover:text-gold">
            TV VIP
          </a>
        </div>
      </div>
    </div>
  );
}
