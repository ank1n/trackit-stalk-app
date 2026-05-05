import { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../lib/auth-context";
import { hasPortalSession } from "../lib/portal-api";
import { colors } from "../lib/theme";

const MODE_KEY = "trackit_app_mode";

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const [portalAuth, setPortalAuth] = useState<boolean | null>(null);
  const [goTo, setGoTo] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading before deciding
    if (isLoading) return;

    (async () => {
      const [mode, hasPortal] = await Promise.all([
        SecureStore.getItemAsync(MODE_KEY),
        hasPortalSession(),
      ]);

      console.log("[Index] mode=", mode, "isAuth=", isAuthenticated, "hasPortal=", hasPortal);

      if (mode === "pm" && isAuthenticated) {
        setGoTo("/(tabs)");
      } else if (mode === "portal" && hasPortal) {
        setGoTo("/(portal)/issues");
      } else if (isAuthenticated) {
        await SecureStore.setItemAsync(MODE_KEY, "pm");
        setGoTo("/(tabs)");
      } else if (hasPortal) {
        await SecureStore.setItemAsync(MODE_KEY, "portal");
        setGoTo("/(portal)/issues");
      } else {
        await SecureStore.deleteItemAsync(MODE_KEY);
        setGoTo("/email-entry");
      }
    })();
  }, [isLoading, isAuthenticated]);

  if (isLoading || !goTo) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={goTo as any} />;
}

export async function resetAppMode(): Promise<void> {
  await SecureStore.deleteItemAsync(MODE_KEY);
}
