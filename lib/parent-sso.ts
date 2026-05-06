/*
Parent SSO bridge — sTalk parent → trackit-stalk-app iframe.

Flow:
1. iframe loads, posts {type:"stalk:trackit:hello"} to parent (window.parent)
2. parent replies with {type:"stalk:trackit:auth", access_token}
3. iframe exchanges access_token → Plane session via /api/v1/mobile/auth/oidc/

Origin lock: only accept messages from STALK_ORIGIN (allowlist below).
The parent can be either ozzy (market.implica.ru) or misty (stalk.implica.ru).
*/

import { SecureStore } from "./storage-web";

const STALK_ORIGINS = [
    "https://stalk.implica.ru",
    "https://market.implica.ru",
];

const SESSION_KEY = "trackit_session_id";
const CSRF_KEY = "trackit_csrf_token";

export type ParentAuthHandler = (accessToken: string) => Promise<{ ok: boolean; error?: string }>;

/**
 * Listen for parent SSO messages. Calls `onToken` with the KC access_token
 * received from sTalk parent. Returns unsubscribe function.
 */
export function listenForParentAuth(onToken: ParentAuthHandler): () => void {
    const handler = (e: MessageEvent): void => {
        if (!STALK_ORIGINS.includes(e.origin)) return;
        const data = e.data;
        if (typeof data !== "object" || !data) return;
        if (data.type !== "stalk:trackit:auth") return;
        const token = String(data.access_token || "");
        if (!token) return;
        onToken(token).catch(() => {});
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
}

/**
 * Notify parent that iframe is ready and waiting for SSO token.
 */
export function announceReady(): void {
    if (window.parent && window.parent !== window) {
        try {
            window.parent.postMessage({ type: "stalk:trackit:hello" }, "*");
        } catch {}
    }
}

/**
 * Notify parent of auth state change (e.g. session expired).
 */
export function notifyAuthState(state: "ready" | "expired" | "ok"): void {
    if (window.parent && window.parent !== window) {
        try {
            window.parent.postMessage({ type: "stalk:trackit:auth-state", state }, "*");
        } catch {}
    }
}

/**
 * Save Plane session locally (used after exchangeStalkSession returns ok).
 */
export async function savePlaneSession(sessionId: string, csrfToken?: string): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, sessionId);
    if (csrfToken) await SecureStore.setItemAsync(CSRF_KEY, csrfToken);
}

export async function clearPlaneSession(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(CSRF_KEY);
}

export async function hasPlaneSession(): Promise<boolean> {
    const sid = await SecureStore.getItemAsync(SESSION_KEY);
    return !!sid;
}
