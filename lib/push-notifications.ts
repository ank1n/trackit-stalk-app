import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { BASE_URL, getSessionCookie } from "./api";

const PUSH_TOKEN_KEY = "trackit_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function extractIssueIdFromNotification(
  response: Notifications.NotificationResponse
): { type: "uuid"; id: string } | { type: "sequence"; identifier: string; seq: number } | null {
  const content = response.notification.request.content;
  const data = content.data as Record<string, any> | undefined;

  // Direct issueId in data (UUID)
  if (data?.issueId) return { type: "uuid", id: data.issueId as string };

  // Extract from url in data
  const url = data?.url as string | undefined;
  if (url) {
    const match = url.match(/issues\/([0-9a-f-]+)/);
    if (match) return { type: "uuid", id: match[1] };
  }

  // APNs thread-id → threadIdentifier
  const threadId = (content as any).threadIdentifier as string | undefined;
  if (threadId && threadId.match(/^[0-9a-f-]+$/)) return { type: "uuid", id: threadId };

  // Extract from title: "TRKIT-256 Some title" → sequence 256
  const title = content.title || "";
  const seqMatch = title.match(/^([A-Z]+)-(\d+)\s/);
  if (seqMatch) {
    return { type: "sequence", identifier: seqMatch[1], seq: parseInt(seqMatch[2], 10) };
  }

  return null;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[Push] Simulator — skip registration");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission denied");
    return null;
  }

  // Get native APNs device token (NOT Expo push token)
  const tokenData = await Notifications.getDevicePushTokenAsync();
  const token = tokenData.data as string;

  console.log("[Push] APNs device token:", token.substring(0, 20) + "...");

  // Send to backend
  const registered = await sendTokenToBackend(token);
  if (registered) {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  }

  return token;
}

async function sendTokenToBackend(token: string): Promise<boolean> {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) return false;

    const res = await fetch(`${BASE_URL}/api/users/me/push/subscribe/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        device_type: "IOS",
        push_token: token,
        device_name: Device.modelName || "iPhone",
      }),
    });

    if (!res.ok) {
      console.warn("[Push] Subscribe failed:", res.status);
      return false;
    }

    console.log("[Push] Registered on backend");
    return true;
  } catch (e) {
    console.warn("[Push] Subscribe error:", e);
    return false;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;

    const cookie = await getSessionCookie();
    if (!cookie) return;

    await fetch(`${BASE_URL}/api/users/me/push/subscribe/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ push_token: token }),
    });

    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    console.log("[Push] Unregistered");
  } catch (e) {
    console.warn("[Push] Unregister error:", e);
  }
}
