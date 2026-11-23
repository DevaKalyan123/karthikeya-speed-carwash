import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

import type { ReactNode } from "react";
import type { User } from "../types";
import api, { AuthAPI } from "../services/api";

interface AuthContextType {
  user: User | null;
  login: (mobile: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const token = sessionStorage.getItem("access_token");
      const stored = sessionStorage.getItem("user");

      return token && stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = async (mobile: string, password: string) => {
    const { data } = await AuthAPI.login({ mobile, password });

    sessionStorage.setItem("access_token", data.access_token);
    sessionStorage.setItem("user", JSON.stringify(data.user));

    setUser(data.user);

    return data.user as User;
  };

  const logout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    setUser(null);
  };

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

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