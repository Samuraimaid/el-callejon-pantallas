import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ControlCenterPage from "./pages/ControlCenterPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PantallaComidasPage from "./pages/PantallaComidasPage";
import PantallaComplementosPage from "./pages/PantallaComplementosPage";
import PantallaPublicidadPage from "./pages/PantallaPublicidadPage";

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
        {/* Alias legacy */}
        <Route path="/cajero" element={<Navigate to="/admin" replace />} />

        {/* TV #1 y #2 — Menú 50" */}
        <Route path="/pantalla/comidas" element={<PantallaComidasPage />} />
        <Route
          path="/pantalla/complementos"
          element={<PantallaComplementosPage />}
        />

        {/* TV #3 y #4 — Publicidad Barra 50" */}
        <Route
          path="/pantalla/publicidad/barra"
          element={
            <PantallaPublicidadPage
              zona="BARRA_BEBIDAS"
              tituloZona="Barra de bebidas y licores"
            />
          }
        />
        {/* TV #5 y #6 — Publicidad VIP 60" */}
        <Route
          path="/pantalla/publicidad/vip"
          element={
            <PantallaPublicidadPage
              zona="SALON_VIP"
              tituloZona="Área VIP climatizada"
            />
          }
        />

        {/* Aliases Smart TV / bookmarks */}
        <Route
          path="/pantalla/barra"
          element={<Navigate to="/pantalla/comidas" replace />}
        />
        <Route
          path="/pantalla/bebidas"
          element={<Navigate to="/pantalla/publicidad/barra" replace />}
        />
        <Route
          path="/tv/comida"
          element={<Navigate to="/pantalla/comidas" replace />}
        />
        <Route
          path="/tv/comidas"
          element={<Navigate to="/pantalla/comidas" replace />}
        />
        <Route
          path="/tv/complementos"
          element={<Navigate to="/pantalla/complementos" replace />}
        />
        <Route
          path="/tv/bebidas"
          element={<Navigate to="/pantalla/publicidad/barra" replace />}
        />
        <Route
          path="/tv/vip"
          element={<Navigate to="/pantalla/publicidad/vip" replace />}
        />
        <Route
          path="/tv/1"
          element={<Navigate to="/pantalla/comidas" replace />}
        />
        <Route
          path="/tv/2"
          element={<Navigate to="/pantalla/complementos" replace />}
        />
        <Route
          path="/tv/3"
          element={<Navigate to="/pantalla/publicidad/barra" replace />}
        />
        <Route
          path="/tv/4"
          element={<Navigate to="/pantalla/publicidad/barra" replace />}
        />
        <Route
          path="/tv/5"
          element={<Navigate to="/pantalla/publicidad/vip" replace />}
        />
        <Route
          path="/tv/6"
          element={<Navigate to="/pantalla/publicidad/vip" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
