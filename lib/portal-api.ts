// TrackIT Mobile Portal API — JWT auth for external users
import * as SecureStore from "expo-secure-store";

const BASE_URL = "https://trackit.implica.ru";
const PORTAL_TOKEN_KEY = "portal_jwt_token";
const PORTAL_EMAIL_KEY = "portal_email";

// ==================== TYPES ====================

export type PortalIssue = {
  id: string;
  name: string;
  sequence_id: number;
  state_group: string;
  created_at: string;
  project_id: string;
};

export type PortalIssueDetail = {
  id: string;
  name: string;
  description_html?: string;
  state_group: string;
  comments: PortalComment[];
};

export type PortalComment = {
  comment_html: string;
  created_at: string;
  is_requester: boolean;
};

export type PortalRequestType = {
  id: string;
  name: string;
  description?: string;
  form_fields?: PortalFormField[];
  project_id: string;
};

export type PortalFormField = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
};

// ==================== EMAIL CHECK ====================

export async function checkEmailIsMember(email: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${BASE_URL}/support/api/portal/check-email?email=${encodeURIComponent(email)}`
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.is_member === true;
  } catch {
    return false;
  }
}

// ==================== TOKEN STORAGE ====================

export async function getPortalToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PORTAL_TOKEN_KEY);
}

export async function getPortalEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(PORTAL_EMAIL_KEY);
}

async function savePortalAuth(token: string, email: string): Promise<void> {
  await SecureStore.setItemAsync(PORTAL_TOKEN_KEY, token);
  await SecureStore.setItemAsync(PORTAL_EMAIL_KEY, email);
}

export async function clearPortalAuth(): Promise<void> {
  await SecureStore.deleteItemAsync(PORTAL_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PORTAL_EMAIL_KEY);
}

export async function hasPortalSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(PORTAL_TOKEN_KEY);
  return !!token;
}

// ==================== FETCH HELPER ====================

async function portalFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getPortalToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    await clearPortalAuth();
    throw new PortalAuthError("Session expired");
  }

  return res;
}

export class PortalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalAuthError";
  }
}

// ==================== AUTH ENDPOINTS ====================

export async function requestCode(email: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${BASE_URL}/support/api/portal/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { success: false, message: err.message || err.detail || "Request failed" };
  }
  return res.json();
}

export async function verifyCode(email: string, code: string): Promise<{ success: boolean; email?: string; expires_in?: number; message?: string }> {
  const res = await fetch(`${BASE_URL}/support/api/portal/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message || data.detail || "Verification failed" };
  }
  if (data.token) {
    await savePortalAuth(data.token, data.email || email);
  }
  return { success: true, email: data.email, expires_in: data.expires_in };
}

// ==================== PORTAL ENDPOINTS ====================

export async function fetchPortalIssues(): Promise<PortalIssue[]> {
  const res = await portalFetch("/support/api/portal/issues");
  if (!res.ok) throw new Error(`Portal issues: ${res.status}`);
  return res.json();
}

export async function fetchPortalIssue(issueId: string): Promise<PortalIssueDetail> {
  const res = await portalFetch(`/support/api/portal/issues/${issueId}`);
  if (!res.ok) throw new Error(`Portal issue: ${res.status}`);
  return res.json();
}

export async function createPortalComment(issueId: string, text: string): Promise<{ success: boolean }> {
  const res = await portalFetch(`/support/api/portal/issues/${issueId}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Portal comment: ${res.status}`);
  return res.json();
}

export async function fetchPortalRequestTypes(): Promise<PortalRequestType[]> {
  const res = await portalFetch("/support/api/portal/request-types");
  if (!res.ok) throw new Error(`Portal request types: ${res.status}`);
  return res.json();
}

export async function createPortalIssue(data: {
  title: string;
  description: string;
  project_id: string;
  request_type_id: string;
}): Promise<{ success: boolean; issue_id?: string }> {
  const res = await portalFetch("/support/api/portal/issues", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Portal create issue: ${res.status}`);
  return res.json();
}
