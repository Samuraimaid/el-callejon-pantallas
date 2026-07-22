import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../lib/auth";

export default function ProtectedRoute({ children }) {
  const loc = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return children;
}
