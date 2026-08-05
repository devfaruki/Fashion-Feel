/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useContext,
  type ReactNode,
} from "react";

interface Admin {
  id: number;
  email: string;
  name?: string;
  role?: { id: string; name: string };
  permissions?: Record<string, { view: boolean; edit: boolean }>;
}

interface AuthContextType {
  admin: Admin | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    sessionStorage.getItem("accessToken"),
  );
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Login function
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await fetch(`${API_URL}/api/login/admin-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.data || "Login failed");
        }

        const data = await response.json();

        // Store access token in sessionStorage (persists across page refresh but clears on tab close)
        sessionStorage.setItem("accessToken", data.data.accessToken);
        setAccessToken(data.data.accessToken);
        setAdmin(data.data.admin);

        return;
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    [API_URL],
  );

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/login/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      sessionStorage.removeItem("accessToken");
      setAccessToken(null);
      setAdmin(null);
    }
  }, [API_URL]);

  // Check if user is authenticated (try to refresh token on mount)
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/login/refresh-token`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const newAccessToken = data.data.accessToken;
        sessionStorage.setItem("accessToken", newAccessToken);
        setAccessToken(newAccessToken);

        setAdmin(data.data.admin);
      } else {
        sessionStorage.removeItem("accessToken");
        setAccessToken(null);
        setAdmin(null);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      sessionStorage.removeItem("accessToken");
      setAccessToken(null);
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  // Check authentication on component mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = {
    admin,
    accessToken,
    isAuthenticated: !!accessToken,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
