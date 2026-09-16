import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import TvErrorBoundary from "./components/TvErrorBoundary";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import SystemDiagnosticProvider from "./components/SystemDiagnosticProvider";
import ControlCenterPage from "./pages/ControlCenterPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PantallaComidasPage from "./pages/PantallaComidasPage";
import PantallaComplementosPage from "./pages/PantallaComplementosPage";
import PantallaPublicidadPage from "./pages/PantallaPublicidadPage";

function TvRoute({ children }) {
  return <TvErrorBoundary>{children}</TvErrorBoundary>;
}

/**
 * Rutas cortas /tv/1 … /tv/6 pensadas para favoritos de Smart TV.
 * Cada publicidad (3–6) es una campaña independiente en el backend.
 */
export default function App() {
  return (
    <GlobalErrorBoundary name="RootApp">
      <SystemDiagnosticProvider>
        <BrowserRouter>
          <Routes>
        {/* Lobby público solo para Smart TVs — sin enlaces al panel de admin */}
        <Route path="/" element={<HomePage />} />
        {/* Acceso staff: URL directa (no aparece en el hub de pantallas) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/control" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <ControlCenterPage />
            </ProtectedRoute>
          }
        />
        {/* Alias legacy de cajero → no se anuncia en el lobby */}
        <Route path="/cajero" element={<Navigate to="/login" replace />} />

        {/* ——— Favoritos Smart TV (URL corta estable) ——— */}
        <Route
          path="/tv/1"
          element={
            <TvRoute>
              <PantallaComidasPage />
            </TvRoute>
          }
        />
        <Route
          path="/tv/2"
          element={
            <TvRoute>
              <PantallaComplementosPage />
            </TvRoute>
          }
        />
        <Route
          path="/tv/3"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV3"
                tituloZona="TV #3 · Barra"
                tvId={3}
              />
            </TvRoute>
          }
        />
        <Route
          path="/tv/4"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV4"
                tituloZona="TV #4 · Parrilla"
                tvId={4}
              />
            </TvRoute>
          }
        />
        <Route
          path="/tv/5"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV5"
                tituloZona="TV #5 · VIP Ambiente"
                tvId={5}
              />
            </TvRoute>
          }
        />
        <Route
          path="/tv/6"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV6"
                tituloZona="TV #6 · VIP Platillos"
                tvId={6}
              />
            </TvRoute>
          }
        />

        {/* Rutas largas (compatibles) */}
        <Route
          path="/pantalla/comidas"
          element={
            <TvRoute>
              <PantallaComidasPage />
            </TvRoute>
          }
        />
        <Route
          path="/pantalla/complementos"
          element={
            <TvRoute>
              <PantallaComplementosPage />
            </TvRoute>
          }
        />
        <Route
          path="/pantalla/publicidad/tv3"
          element={
            <TvRoute>
              <PantallaPublicidadPage zona="TV3" tituloZona="TV #3 · Barra" />
            </TvRoute>
          }
        />
        <Route
          path="/pantalla/publicidad/tv4"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV4"
                tituloZona="TV #4 · Parrilla"
              />
            </TvRoute>
          }
        />
        <Route
          path="/pantalla/publicidad/tv5"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV5"
                tituloZona="TV #5 · VIP Ambiente"
              />
            </TvRoute>
          }
        />
        <Route
          path="/pantalla/publicidad/tv6"
          element={
            <TvRoute>
              <PantallaPublicidadPage
                zona="TV6"
                tituloZona="TV #6 · VIP Platillos"
              />
            </TvRoute>
          }
        />

        {/* Legacy aliases → nuevas rutas independientes */}
        <Route
          path="/pantalla/publicidad/barra"
          element={<Navigate to="/tv/3" replace />}
        />
        <Route
          path="/pantalla/publicidad/vip"
          element={<Navigate to="/tv/5" replace />}
        />
        <Route
          path="/pantalla/barra"
          element={<Navigate to="/tv/1" replace />}
        />
        <Route
          path="/pantalla/bebidas"
          element={<Navigate to="/tv/3" replace />}
        />
        <Route path="/tv/comida" element={<Navigate to="/tv/1" replace />} />
        <Route path="/tv/comidas" element={<Navigate to="/tv/1" replace />} />
        <Route
          path="/tv/complementos"
          element={<Navigate to="/tv/2" replace />}
        />
        <Route path="/tv/bebidas" element={<Navigate to="/tv/3" replace />} />
        <Route path="/tv/vip" element={<Navigate to="/tv/5" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </SystemDiagnosticProvider>
</GlobalErrorBoundary>
  );
}
