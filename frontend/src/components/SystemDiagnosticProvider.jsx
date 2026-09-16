import { useEffect, useState } from "react";
import {
  getLastCrashSnapshot,
  installGlobalDiagnostics,
} from "../lib/diagnostics";
import CrashDiagnosticModal from "./CrashDiagnosticModal";

/**
 * Proveedor Global de Diagnóstico.
 * Escucha errores no capturados en todo el sistema (asíncronos, eventos, promesas)
 * y muestra la pantalla de diagnóstico asistido cuando ocurre un fallo.
 */
export default function SystemDiagnosticProvider({ children }) {
  const [activeSnapshot, setActiveSnapshot] = useState(null);

  useEffect(() => {
    // Instalar capturadores de errores globales en window
    installGlobalDiagnostics((snapshot) => {
      setActiveSnapshot(snapshot);
    });

    // Atajo de teclado para abrir el último diagnóstico: Ctrl + Shift + D
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        const last = getLastCrashSnapshot();
        if (last) {
          setActiveSnapshot(last);
        } else {
          alert("No hay ningún reporte de fallo registrado en esta sesión.");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {children}
      {activeSnapshot && (
        <CrashDiagnosticModal
          snapshot={activeSnapshot}
          onClose={() => setActiveSnapshot(null)}
          onRetry={() => {
            setActiveSnapshot(null);
          }}
        />
      )}
    </>
  );
}
