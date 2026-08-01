import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { api } from "../lib/api";
import { isSmartTvBrowser, setSession } from "../lib/auth";

/**
 * Acceso solo con PIN (sin usuario/contraseña).
 */
export default function LoginPage() {
  const nav = useNavigate();
  const tvBlocked = isSmartTvBrowser();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinInfo, setPinInfo] = useState(null);
  const [lockLeft, setLockLeft] = useState(0);

  const refreshPinStatus = useCallback(async () => {
    try {
      const s = await api.pinStatus();
      setPinInfo(s);
      setLockLeft(Number(s.retry_after_s) || 0);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("TV") || msg.includes("403")) {
        setError("Este dispositivo TV no puede abrir el Centro de Control.");
      }
    }
  }, []);

  useEffect(() => {
    if (tvBlocked) return;
    refreshPinStatus();
  }, [tvBlocked, refreshPinStatus]);

  useEffect(() => {
    if (lockLeft <= 0) return undefined;
    const id = window.setInterval(() => {
      setLockLeft((n) => {
        if (n <= 1) {
          window.clearInterval(id);
          refreshPinStatus();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockLeft > 0, refreshPinStatus]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.pinLogin(pin.trim());
      setSession(res.access_token, res.usuario);
      nav("/admin", { replace: true });
    } catch (err) {
      let detail = err.message || "PIN incorrecto";
      try {
        const j = JSON.parse(detail);
        if (j.message) detail = j.message;
        if (j.retry_after_s) setLockLeft(Number(j.retry_after_s));
        if (j.attempts_left != null) setPinInfo(j);
      } catch {
        /* texto */
      }
      setError(typeof detail === "string" ? detail : "PIN incorrecto");
      refreshPinStatus();
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
            <code className="text-amber-200/90">/tv/1…6</code> o un PC/tablet
            de personal.
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
      <div className="panel-oak w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="xl" />
          <h1 className="font-display mt-4 text-3xl text-ivory">
            Centro de Control
          </h1>
          <p className="mt-1 text-sm text-cream/70">
            Acceso con PIN · personal autorizado
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {pinInfo && !lockLeft ? (
            <p className="text-center text-xs text-amber-200/80">
              Intentos restantes: {pinInfo.attempts_left ?? "—"}
              {pinInfo.next_lock_s
                ? ` · si falla 3 veces: bloqueo ${pinInfo.next_lock_s}s`
                : ""}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm text-cream/70">PIN (4–8 dígitos)</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={pin}
              disabled={lockLeft > 0 || loading}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className="tap w-full rounded-2xl border border-[rgba(232,197,106,0.25)] bg-black/35 px-4 py-4 text-center text-2xl tracking-[0.4em] text-ivory outline-none focus:border-gold"
              placeholder="••••"
              maxLength={8}
            />
          </label>

          {lockLeft > 0 && (
            <p className="rounded-xl bg-amber-950/50 px-3 py-2 text-center text-sm text-amber-100">
              Bloqueado · reintente en <strong>{lockLeft}s</strong>
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-rose-950/60 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || lockLeft > 0 || pin.length < 4}
            className="tap w-full rounded-2xl bg-gradient-to-r from-[#a33a28] to-[#d4a84b] py-4 text-lg font-bold text-[#1a120c] shadow-lg disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-cream/40">
          PIN inicial: 2580 · cámbielo en Ambiente → Seguridad
        </p>
      </div>
    </div>
  );
}
