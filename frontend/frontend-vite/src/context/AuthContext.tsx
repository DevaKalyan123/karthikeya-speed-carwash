import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import type { User } from "../types";
import api, { AuthAPI } from "../services/api";

interface AuthContextType {
  user: User | null;
  login: (mobile: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const validRole = (role: unknown): role is User["role"] =>
  role === "admin" ||
  role === "customer" ||
  role === "management";

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(() => {
    try {
      const token = sessionStorage.getItem("access_token");
      const stored = sessionStorage.getItem("user");
      const parsed = stored ? JSON.parse(stored) : null;

      return token && parsed && validRole(parsed.role)
        ? parsed
        : null;
    } catch {
      return null;
    }
  });

  const login = async (mobile: string, password: string) => {
    const { data } = await AuthAPI.login({
      mobile,
      password,
    });

    if (
      !data.access_token ||
      !data.user ||
      !validRole(data.user.role)
    ) {
      throw new Error("Unsupported account role");
    }

    sessionStorage.setItem("access_token", data.access_token);

    sessionStorage.setItem(
      "user",
      JSON.stringify(data.user)
    );

    setUser(data.user);

    return data.user as User;
  };

  const clearSession = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate("/", { replace: true });
  }, [clearSession, navigate]);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      response => response,

      error => {
        if (error.response?.status === 401) {
          clearSession();
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("AuthProvider is required");
  }

  return context;
}