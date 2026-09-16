import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { api } from "../lib/api";
import { isSmartTvBrowser, setSession } from "../lib/auth";

/**
 * Acceso formal al Centro de Control con Usuario y Contraseña segura.
 */
export default function LoginPage() {
  const nav = useNavigate();
  const tvBlocked = isSmartTvBrowser();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setError("Por favor ingrese su usuario y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(u, p);
      setSession(res.access_token, res.usuario);
      nav("/admin", { replace: true });
    } catch (err) {
      let detail = err.message || "Usuario o contraseña incorrectos";
      try {
        const j = JSON.parse(detail);
        if (j.detail) detail = j.detail;
        else if (j.message) detail = j.message;
      } catch {
        /* texto simple */
      }
      setError(
        typeof detail === "string" ? detail : "Usuario o contraseña incorrectos"
      );
    } finally {
      setLoading(false);
    }
  }

  if (tvBlocked) {
    return (
      <div className="bg-oak-wood flex min-h-screen items-center justify-center p-6 text-ivory">
        <div className="panel-oak max-w-md rounded-3xl p-8 text-center">
          <Logo size="lg" />
          <h1 className="font-display mt-4 text-2xl">Acceso bloqueado</h1>
          <p className="mt-3 text-sm text-cream/70">
            Las Smart TVs no pueden abrir el Centro de Control. Use el hub{" "}
            <code className="text-amber-200/90">/tv/1…6</code> o un PC/tablet de personal.
          </p>
          <a
            href="/"
            className="tap mt-6 inline-block rounded-xl bg-amber-700/90 px-4 py-2 text-sm font-bold text-stone-950"
          >
            Ir al hub de pantallas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-oak-wood flex h-full min-h-screen items-center justify-center p-4 text-ivory">
      <div className="panel-oak w-full max-w-md rounded-3xl p-8 shadow-2xl border border-amber-600/30">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="xl" />
          <h1 className="font-display mt-4 text-3xl text-ivory tracking-wide">
            Centro de Control
          </h1>
          <p className="mt-1 text-sm text-cream/70">
            Acceso administrativo · Personal autorizado
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-950/70 border border-rose-800/80 px-4 py-2.5 text-center text-sm font-semibold text-rose-200">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-amber-200/80 uppercase tracking-wider">
              Usuario
            </span>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              disabled={loading}
              onChange={(e) => setUsername(e.target.value)}
              className="tap w-full rounded-xl border border-[rgba(232,197,106,0.3)] bg-black/40 px-4 py-3 text-base text-ivory placeholder-stone-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all"
              placeholder="Ingrese su usuario"
            />
          </label>

          <label className="block relative">
            <span className="mb-1.5 block text-xs font-bold text-amber-200/80 uppercase tracking-wider">
              Contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                disabled={loading}
                onChange={(e) => setPassword(e.target.value)}
                className="tap w-full rounded-xl border border-[rgba(232,197,106,0.3)] bg-black/40 px-4 py-3 pr-12 text-base text-ivory placeholder-stone-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-amber-200 text-xs px-1.5 py-1 rounded transition-colors cursor-pointer select-none"
                tabIndex={-1}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="tap mt-2 w-full rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 py-3.5 text-base font-extrabold text-stone-950 shadow-lg disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? "Verificando…" : "Iniciar Sesión"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-cream/50">
            El Callejón POS · Cartelería y Administración en Vivo
          </p>
        </div>
      </div>
    </div>
  );
}
