import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ControlCenterPage from "./pages/ControlCenterPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PantallaComidasPage from "./pages/PantallaComidasPage";
import PantallaComplementosPage from "./pages/PantallaComplementosPage";
import PantallaPublicidadPage from "./pages/PantallaPublicidadPage";

/**
 * Rutas cortas /tv/1 … /tv/6 pensadas para favoritos de Smart TV.
 * Cada publicidad (3–6) es una campaña independiente en el backend.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <ControlCenterPage />
            </ProtectedRoute>
          }
        />
        <Route path="/cajero" element={<Navigate to="/admin" replace />} />

        {/* ——— Favoritos Smart TV (URL corta estable) ——— */}
        <Route path="/tv/1" element={<PantallaComidasPage />} />
        <Route path="/tv/2" element={<PantallaComplementosPage />} />
        <Route
          path="/tv/3"
          element={
            <PantallaPublicidadPage
              zona="TV3"
              tituloZona="TV #3 · Barra"
              tvId={3}
            />
          }
        />
        <Route
          path="/tv/4"
          element={
            <PantallaPublicidadPage
              zona="TV4"
              tituloZona="TV #4 · Parrilla"
              tvId={4}
            />
          }
        />
        <Route
          path="/tv/5"
          element={
            <PantallaPublicidadPage
              zona="TV5"
              tituloZona="TV #5 · VIP Ambiente"
              tvId={5}
            />
          }
        />
        <Route
          path="/tv/6"
          element={
            <PantallaPublicidadPage
              zona="TV6"
              tituloZona="TV #6 · VIP Platillos"
              tvId={6}
            />
          }
        />

        {/* Rutas largas (compatibles) */}
        <Route path="/pantalla/comidas" element={<PantallaComidasPage />} />
        <Route
          path="/pantalla/complementos"
          element={<PantallaComplementosPage />}
        />
        <Route
          path="/pantalla/publicidad/tv3"
          element={
            <PantallaPublicidadPage zona="TV3" tituloZona="TV #3 · Barra" />
          }
        />
        <Route
          path="/pantalla/publicidad/tv4"
          element={
            <PantallaPublicidadPage zona="TV4" tituloZona="TV #4 · Parrilla" />
          }
        />
        <Route
          path="/pantalla/publicidad/tv5"
          element={
            <PantallaPublicidadPage
              zona="TV5"
              tituloZona="TV #5 · VIP Ambiente"
            />
          }
        />
        <Route
          path="/pantalla/publicidad/tv6"
          element={
            <PantallaPublicidadPage
              zona="TV6"
              tituloZona="TV #6 · VIP Platillos"
            />
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
  );
}
