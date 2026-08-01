import { Navigate, useLocation } from "react-router-dom";
import { getToken, isSmartTvBrowser } from "../lib/auth";

export default function ProtectedRoute({ children }) {
  const loc = useLocation();

  // Smart TVs no entran al Centro de Control
  if (isSmartTvBrowser()) {
    return <Navigate to="/" replace />;
  }

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return children;
}
