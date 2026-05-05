import { Stack } from "expo-router";
import { PortalAuthProvider } from "../../lib/portal-auth-context";
import { t } from "../../lib/i18n";

export default function PortalLayout() {
  return (
    <PortalAuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login-email" />
        <Stack.Screen name="login-code" />
        <Stack.Screen name="issues" />
        <Stack.Screen
          name="ticket/[id]"
          options={{ headerShown: true, headerBackTitle: t("issue.back"), headerTitle: t("portal.issue") }}
        />
        <Stack.Screen
          name="create"
          options={{ headerShown: true, presentation: "modal", headerTitle: t("portal.createIssue") }}
        />
      </Stack>
    </PortalAuthProvider>
  );
}
