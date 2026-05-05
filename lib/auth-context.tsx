import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginWithKeycloak, hasSession, fetchMe, clearSession } from "./api";
import { registerForPushNotifications, unregisterPushNotifications } from "./push-notifications";

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  userName: string;
  userId: string;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  userName: "",
  userId: "",
  login: async () => ({ ok: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    (async () => {
      const hasSess = await hasSession();
      console.log("[AuthProvider] hasSession=", hasSess);
      if (hasSess) {
        try {
          const me = await fetchMe();
          console.log("[AuthProvider] fetchMe OK, user=", me?.email);
          setUserName(me.first_name || me.display_name || "");
          setUserId(me.id || "");
          setIsAuthenticated(true);
          registerForPushNotifications().catch(console.warn);
        } catch (e) {
          console.log("[AuthProvider] fetchMe FAILED:", e);
          await clearSession();
        }
      } else {
        console.log("[AuthProvider] No session found");
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await loginWithKeycloak(email, password);
    if (result.ok && result.user) {
      setUserName(result.user.first_name || result.user.display_name || "");
      setUserId(result.user.id || "");
      setIsAuthenticated(true);
      registerForPushNotifications().catch(console.warn);
    }
    return { ok: result.ok, error: result.error };
  };

  const logout = async () => {
    await unregisterPushNotifications().catch(console.warn);
    await clearSession();
    setIsAuthenticated(false);
    setUserName("");
    setUserId("");
  };

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, userName, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
