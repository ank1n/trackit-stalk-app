import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import {
  hasPortalSession, getPortalEmail, clearPortalAuth,
  requestCode, verifyCode, PortalAuthError,
} from "./portal-api";

type PortalAuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  email: string;
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  sendCode: (email: string) => Promise<{ ok: boolean; error?: string }>;
  confirmCode: (email: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const PortalAuthContext = createContext<PortalAuthState>({
  isLoading: true,
  isAuthenticated: false,
  email: "",
  pendingEmail: "",
  setPendingEmail: () => {},
  sendCode: async () => ({ ok: false }),
  confirmCode: async () => ({ ok: false }),
  logout: async () => {},
});

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  useEffect(() => {
    (async () => {
      if (await hasPortalSession()) {
        const savedEmail = await getPortalEmail();
        setEmail(savedEmail || "");
        setIsAuthenticated(true);
      }
      // Restore pending email from email-entry screen
      const pending = await SecureStore.getItemAsync("portal_pending_email");
      if (pending) setPendingEmail(pending);
      setIsLoading(false);
    })();
  }, []);

  const sendCode = useCallback(async (emailInput: string) => {
    try {
      const result = await requestCode(emailInput);
      if (result.success) return { ok: true };
      return { ok: false, error: result.message };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection error";
      return { ok: false, error: msg };
    }
  }, []);

  const confirmCode = useCallback(async (emailInput: string, code: string) => {
    try {
      const result = await verifyCode(emailInput, code);
      if (result.success) {
        setEmail(result.email || emailInput);
        setIsAuthenticated(true);
        return { ok: true };
      }
      return { ok: false, error: result.message };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Verification error";
      return { ok: false, error: msg };
    }
  }, []);

  const logout = useCallback(async () => {
    await clearPortalAuth();
    setIsAuthenticated(false);
    setEmail("");
  }, []);

  return (
    <PortalAuthContext.Provider value={{ isLoading, isAuthenticated, email, pendingEmail, setPendingEmail, sendCode, confirmCode, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export const usePortalAuth = () => useContext(PortalAuthContext);
