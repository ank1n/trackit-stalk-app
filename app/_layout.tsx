import { useEffect } from "react";
import { Alert } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "../lib/auth-context";
import { extractIssueIdFromNotification } from "../lib/push-notifications";
import { fetchIssues, createComment } from "../lib/api";
import { initLang, t, getLang } from "../lib/i18n";

export default function RootLayout() {
  useEffect(() => { initLang(); }, []);

  // Register iOS notification categories (inline-reply on comments)
  useEffect(() => {
    const ru = getLang() === "ru";
    Notifications.setNotificationCategoryAsync("ISSUE_COMMENT", [
      {
        identifier: "REPLY",
        buttonTitle: ru ? "Ответить" : "Reply",
        textInput: {
          submitButtonTitle: ru ? "Отправить" : "Send",
          placeholder: ru ? "Ваш ответ..." : "Your reply...",
        },
        // Open app on Reply so the JS handler can reliably POST the comment.
        // A future Notification Service Extension (TRKIT) can handle the reply
        // purely in background, without foregrounding the app.
        options: { opensAppToForeground: true },
      },
    ]).catch((e) => console.warn("[Push] setCategory failed:", e));
  }, []);

  // Handle push notification tap → navigate to issue
  useEffect(() => {
    const PROJECT_MAP: Record<string, string> = {
      TRKIT: "c74892c9-5131-4804-9b07-41fcd30f3082",
      STALK: "ca89973d-1a4a-4fc4-9e21-9a002ac6c53d",
      STMOB: "a0b9904b-b856-422f-9540-3b975e54f42e",
      VOX: "15349b65-9dcb-406c-85f3-20febcfe3a4f",
    };

    const waitForAuth = async (maxWait = 5000): Promise<boolean> => {
      const { getSessionCookie } = await import("../lib/api");
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        const cookie = await getSessionCookie().catch(() => null);
        if (cookie) return true;
        await new Promise((r) => setTimeout(r, 300));
      }
      return false;
    };

    const resolveIssue = async (
      response: Notifications.NotificationResponse,
    ): Promise<{ projectId: string; issueId: string } | null> => {
      const result = extractIssueIdFromNotification(response);
      if (!result) return null;

      const content = response.notification.request.content;
      const data = content.data as Record<string, any> | undefined;
      const title = content.title || "";

      let projectId = data?.projectId as string | undefined;
      if (!projectId) {
        const urlMatch = ((data?.url as string) || "").match(/projects\/([0-9a-f-]+)/);
        if (urlMatch) projectId = urlMatch[1];
      }
      if (!projectId) {
        const idMatch = title.match(/^([A-Z]+)-/);
        projectId = idMatch ? PROJECT_MAP[idMatch[1]] : PROJECT_MAP.TRKIT;
      }
      if (!projectId) return null;

      if (result.type === "uuid") return { projectId, issueId: result.id };
      const issues = await fetchIssues(projectId, true).catch(() => []);
      const found = issues.find((i: any) => i.sequence_id === result.seq);
      return found ? { projectId, issueId: found.id } : null;
    };

    const handleInlineReply = async (response: Notifications.NotificationResponse) => {
      try {
        const userText = (response as any).userText as string | undefined;
        if (!userText?.trim()) return;
        const authReady = await waitForAuth();
        if (!authReady) {
          console.warn("[Inline-reply] Auth not ready");
          return;
        }
        const ref = await resolveIssue(response);
        if (!ref) return;
        await createComment(ref.projectId, ref.issueId, userText.trim(), "EXTERNAL");
        console.log("[Inline-reply] Comment created");
      } catch (e) {
        console.warn("[Inline-reply] error:", e);
      }
    };

    const navigateToIssue = async (response: Notifications.NotificationResponse) => {
      try {
        const authReady = await waitForAuth();
        if (!authReady) {
          console.warn("[Push nav] Auth not ready, skipping navigation");
          return;
        }
        const ref = await resolveIssue(response);
        if (!ref) return;
        router.push(`/issue/${ref.issueId}?projectId=${ref.projectId}`);
      } catch (e) {
        console.warn("[Push nav] error:", e);
      }
    };

    const routeResponse = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier === "REPLY") {
        handleInlineReply(response);
      } else {
        navigateToIssue(response);
      }
    };

    // App was opened from killed state by tapping notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) setTimeout(() => routeResponse(response), 1500);
    });

    // App is running, user taps notification
    const sub = Notifications.addNotificationResponseReceivedListener(routeResponse);

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="email-entry" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(portal)" />
          <Stack.Screen
            name="search"
            options={{ headerShown: false, presentation: "modal" }}
          />
          <Stack.Screen
            name="notes"
            options={{ headerShown: true, headerBackTitle: t("issue.back") }}
          />
          <Stack.Screen
            name="project/[id]"
            options={{ headerShown: true, headerBackTitle: t("issue.back") }}
          />
          <Stack.Screen
            name="project/calendar/[id]"
            options={{ headerShown: true, headerBackTitle: t("issue.back") }}
          />
          <Stack.Screen
            name="project/timeline/[id]"
            options={{ headerShown: true, headerBackTitle: t("issue.back") }}
          />
          <Stack.Screen
            name="issue/[id]"
            options={{ headerShown: true, headerBackTitle: t("issue.back"), headerTitle: t("issue.title") }}
          />
          <Stack.Screen
            name="issue/create"
            options={{ headerShown: true, presentation: "modal", headerTitle: t("create.form.title") }}
          />
          <Stack.Screen
            name="pages/[projectId]"
            options={{ headerShown: true, headerBackTitle: t("issue.back") }}
          />
          <Stack.Screen
            name="page/[id]"
            options={{ headerShown: true, headerBackTitle: t("issue.back") }}
          />
          <Stack.Screen
            name="card-settings"
            options={{ headerShown: true, headerBackTitle: t("issue.back"), headerTitle: t("cardSettings.title") }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
