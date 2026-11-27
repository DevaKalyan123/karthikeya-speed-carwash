import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "../types";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role }: { children: ReactNode; role: User["role"] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace/>;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace/>;
  return children;
}
