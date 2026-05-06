// TrackIT API — session cookie auth (web-only via storage-web shim)
import { SecureStore } from "./storage-web";

const BASE_URL = "https://trackit.implica.ru";
const WORKSPACE = "implica";
const KEYCLOAK_TOKEN_URL = "https://auth.trackit.implica.ru/realms/plane/protocol/openid-connect/token";
const KEYCLOAK_CLIENT_ID = "trackit-mobile";

const SESSION_KEY = "trackit_session_id";
const CSRF_KEY = "trackit_csrf_token";

// ==================== SESSION STORAGE ====================

export { BASE_URL };

export function invalidateAuthCache() { _cachedCookie = null; _cachedCsrf = null; }

export async function getSessionCookie(): Promise<string> {
  const sid = await SecureStore.getItemAsync(SESSION_KEY);
  const csrf = await SecureStore.getItemAsync(CSRF_KEY);
  if (!sid) return "";
  let cookie = `session-id=${sid}`;
  if (csrf) cookie += `; csrftoken=${csrf}`;
  return cookie;
}

async function saveSession(sessionId: string, csrfToken?: string) {
  await SecureStore.setItemAsync(SESSION_KEY, sessionId);
  if (csrfToken) await SecureStore.setItemAsync(CSRF_KEY, csrfToken);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(CSRF_KEY);
}

export async function hasSession(): Promise<boolean> {
  const sid = await SecureStore.getItemAsync(SESSION_KEY);
  return !!sid;
}

// ==================== AUTH ====================

export async function loginWithKeycloak(email: string, password: string): Promise<{ ok: boolean; user?: any; error?: string }> {
  try {
    // Step 1: Keycloak direct grant
    const kcRes = await fetch(KEYCLOAK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${KEYCLOAK_CLIENT_ID}&grant_type=password&username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&scope=openid+profile+email`,
    });
    if (!kcRes.ok) {
      const err = await kcRes.json().catch(() => ({}));
      return { ok: false, error: err.error === "invalid_grant" ? "Неверный email или пароль" : (err.error_description || "Ошибка Keycloak") };
    }
    const { access_token } = await kcRes.json();

    // Step 2: Get CSRF token first
    const csrfRes = await fetch(`${BASE_URL}/api/config/`, { credentials: "include" });
    const csrfCookie = csrfRes.headers.get("set-cookie")?.match(/csrftoken=([^;]+)/)?.[1] || "";

    // Step 3: Exchange for Plane session
    const authRes = await fetch(`${BASE_URL}/api/v1/mobile/auth/oidc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": `${BASE_URL}/`,
        "X-CSRFToken": csrfCookie,
      },
      credentials: "include",
      body: JSON.stringify({ access_token }),
    });
    if (!authRes.ok) {
      const errBody = await authRes.text().catch(() => "");
      return { ok: false, error: `Не удалось создать сессию (${authRes.status}: ${errBody.substring(0, 100)})` };
    }

    const data = await authRes.json();

    // Get session_id and csrf_token from response body
    if (data.session_id) {
      await saveSession(data.session_id, data.csrf_token || "");
    } else {
      return { ok: false, error: "Сессия не получена от сервера" };
    }

    return { ok: true, user: data.user };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Ошибка подключения" };
  }
}

/**
 * Exchange a Keycloak access_token (provided by sTalk parent via postMessage)
 * for a Plane session cookie. The token must be issued by KC realm `plane`
 * — the same realm TrackIT uses. If parent has a different-realm token
 * (e.g. `matrix`), it must obtain a `plane`-realm token via token-exchange
 * grant before forwarding here.
 */
export async function exchangeStalkSession(planeRealmAccessToken: string): Promise<{ ok: boolean; user?: any; error?: string }> {
  try {
    const csrfRes = await fetch(`${BASE_URL}/api/config/`, { credentials: "include" });
    const csrfCookie = csrfRes.headers.get("set-cookie")?.match(/csrftoken=([^;]+)/)?.[1] || "";

    const authRes = await fetch(`${BASE_URL}/api/v1/mobile/auth/oidc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": `${BASE_URL}/`,
        "X-CSRFToken": csrfCookie,
      },
      credentials: "include",
      body: JSON.stringify({ access_token: planeRealmAccessToken }),
    });
    if (!authRes.ok) {
      const errBody = await authRes.text().catch(() => "");
      return { ok: false, error: `Не удалось создать сессию (${authRes.status}: ${errBody.substring(0, 200)})` };
    }
    const data = await authRes.json();
    if (!data.session_id) return { ok: false, error: "Сессия не получена от сервера" };
    await saveSession(data.session_id, data.csrf_token || "");
    invalidateAuthCache();
    return { ok: true, user: data.user };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Ошибка подключения" };
  }
}

// ==================== CACHE LAYER ====================

import AsyncStorage from "./storage-web";

const CACHE_PREFIX = "api_cache_";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

// In-memory cache — avoids AsyncStorage disk I/O on every request
const _memCache: Record<string, { data: any; ts: number }> = {};

function getMemCached(key: string): any | null {
  const entry = _memCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { delete _memCache[key]; return null; }
  return entry.data;
}

function setMemCache(key: string, data: any) {
  _memCache[key] = { data, ts: Date.now() };
}

async function getDiskCached(key: string): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    _memCache[key] = { data, ts }; // promote to memory
    return data;
  } catch { return null; }
}

function saveToDisk(key: string, data: any) {
  AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() })).catch(() => {});
}

// Invalidate cache after a non-GET request: drop the exact path plus any
// cached entries that start with the parent collection path (e.g. a PATCH on
// /issues/:id/ clears the list /issues/?per_page=100 too).
function invalidateCache(path: string) {
  const exact = path.split("?")[0];
  const parent = exact.replace(/\/$/, "").replace(/\/[^/]+$/, "/");
  for (const key of Object.keys(_memCache)) {
    const base = key.split("?")[0];
    if (base === exact || base.startsWith(parent)) {
      delete _memCache[key];
      AsyncStorage.removeItem(CACHE_PREFIX + key).catch(() => {});
    }
  }
}

// ==================== AUTH CACHE ====================

let _cachedCookie: string | null = null;
let _cachedCsrf: string | null = null;

async function getCachedAuth() {
  if (!_cachedCookie) _cachedCookie = await getSessionCookie();
  if (!_cachedCsrf) _cachedCsrf = await SecureStore.getItemAsync(CSRF_KEY);
  return { cookie: _cachedCookie, csrf: _cachedCsrf };
}

// ==================== IN-FLIGHT DEDUP ====================
const _inFlight: Record<string, Promise<any>> = {};

// Paths that should always hit the network because they mutate cross-device.
// Includes both detail endpoints and the issue/page lists that show cover,
// state, priority, description previews on Kanban and Pages screens.
// Dictionaries (labels, states, members) keep the cache.
function isFreshOnlyPath(path: string): boolean {
  const noQs = path.split("?")[0];
  return (
    /\/issues\/[0-9a-f-]{36}\/$/.test(noQs) ||
    /\/issues\/[0-9a-f-]{36}\/comments\/$/.test(noQs) ||
    /\/issues\/[0-9a-f-]{36}\/mobile-attachments\/?$/.test(noQs) ||
    /\/pages\/[0-9a-f-]{36}\/$/.test(noQs) ||
    /\/projects\/[0-9a-f-]{36}\/issues\/$/.test(noQs) ||
    /\/projects\/[0-9a-f-]{36}\/pages\/$/.test(noQs) ||
    /\/v1\/workspaces\/[^/]+\/issues\/[A-Z]+-\d+\/$/.test(noQs)
  );
}

// ==================== FETCH HELPERS ====================

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const { cookie, csrf } = await getCachedAuth();
  const isGet = !options?.method || options.method === "GET";
  const freshOnly = isGet && isFreshOnlyPath(path);

  // Check memory cache first for GET (except for always-fresh paths)
  if (isGet && !freshOnly) {
    const memCached = getMemCached(path);
    if (memCached) return memCached;
    // Dedup: if same request already in flight, wait for it
    if (_inFlight[path]) return _inFlight[path];
  }

  // Browser sets Cookie automatically via cookie jar (credentials:"include").
  // Manual Cookie header is forbidden in fetch — silently dropped.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(csrf && !isGet ? { "X-CSRFToken": csrf } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };
  void cookie; // kept for parity with mobile flow / debug logging

  const doFetch = async () => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) {
          console.warn(`[apiFetch] 403 Forbidden: ${path}`);
          return null;
        }
        if (res.status === 401) {
          console.warn(`[apiFetch] 401 Unauthorized: ${path} cookie=${cookie ? "yes" : "no"}`);
          return null;
        }
        console.warn(`[apiFetch] ${res.status} ${path}`);
        throw new Error(`API ${res.status}: ${path}`);
      }
      // Parse body only if non-empty — some PATCH/DELETE endpoints return 200 with no body
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (isGet && !freshOnly) {
        setMemCache(path, json);
        saveToDisk(path, json);
      } else if (!isGet) {
        invalidateCache(path);
      }
      return json;
    } catch (e) {
      if (isGet) {
        const cached = getMemCached(path) ?? await getDiskCached(path);
        if (cached) return cached;
      }
      throw e;
    } finally {
      delete _inFlight[path];
    }
  };

  if (isGet) {
    _inFlight[path] = doFetch();
    return _inFlight[path];
  }
  return doFetch();
}

// ==================== TYPES ====================

export type TProject = { id: string; identifier: string; name: string; emoji?: string; inbox_view?: boolean };
export type TIssue = {
  id: string; name: string; description_html?: string; priority?: string;
  state_id?: string; state?: string; state__group?: string; sequence_id?: number;
  project?: string; project_id?: string;
  assignee_ids?: string[]; label_ids?: string[]; target_date?: string;
  attachment_count?: number; sub_issues_count?: number; link_count?: number;
  cover_image_asset_id?: string;
  created_by?: string;
  created_at?: string; updated_at?: string;
};
export type TState = { id: string; name: string; color: string; group: string; sequence?: number; wip_limit?: number | null };
export type TLabel = { id: string; name: string; color: string };
export type TDashboard = {
  assigned_issues_count?: number; pending_issues_count?: number;
  completed_issues_count?: number; issues_due_week_count?: number;
  overdue_issues?: TDashboardIssue[];
};
export type TDashboardIssue = {
  id: string; name: string; priority?: string; state__group?: string;
  target_date?: string; updated_at?: string;
  project_detail?: { id?: string; identifier?: string; name?: string };
};
export type TComment = { id: string; comment_html: string; access?: string; actor_detail?: { display_name?: string; first_name?: string }; created_at?: string };
export type TAttachment = { id: string; asset_url?: string; asset?: string; attributes?: { name?: string; size?: number }; created_at?: string };

export function issueStateId(issue: TIssue): string { return issue.state_id || issue.state || ""; }

// Download file with session cookie → returns base64 data URI.
// Web: browser attaches cookies automatically (credentials:"include"); the
// manual Cookie header is forbidden in fetch and silently dropped.
export async function fetchImageBase64(assetUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}${assetUrl}`, { credentials: "include" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

export async function fetchImageAsDataUri(assetUrl: string): Promise<string | null> {
  const b64 = await fetchImageBase64(assetUrl);
  return b64 ? `data:image/jpeg;base64,${b64}` : null;
}

// ==================== API FUNCTIONS ====================

export async function fetchMe(): Promise<any> { return apiFetch("/api/users/me/"); }
export async function fetchDashboard(): Promise<TDashboard> { return apiFetch(`/api/users/me/workspaces/${WORKSPACE}/dashboard/`); }
export async function fetchProjects(): Promise<TProject[]> {
  const data = await apiFetch(`/api/workspaces/${WORKSPACE}/projects/`);
  return (data?.results ?? data ?? []).filter(Boolean);
}

export async function fetchIssues(projectId: string, lite = true): Promise<TIssue[]> {
  const data = await apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/?per_page=500${lite ? "&lite=true" : ""}`);
  return data?.results ?? data ?? [];
}

export async function fetchIssueByIdentifier(identifier: string, seq: number): Promise<{ id: string } | null> {
  try {
    return await apiFetch(`/api/v1/workspaces/${WORKSPACE}/issues/${identifier}-${seq}/`);
  } catch { return null; }
}

export async function fetchIssue(projectId: string, issueId: string): Promise<TIssue> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/`);
}

export async function fetchStates(projectId: string): Promise<TState[]> {
  return (await apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/states/`)) ?? [];
}

export async function fetchLabels(projectId: string): Promise<TLabel[]> {
  return (await apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issue-labels/`)) ?? [];
}

export type TPage = { id: string; name: string; description_html?: string; owned_by?: string; parent?: string | null; access?: number; archived_at?: string | null; created_at: string; updated_at: string };

export async function searchIssues(query: string): Promise<{ results: { work_items?: TIssue[] } }> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/search/?search=${encodeURIComponent(query)}&type=work_item`) ?? { results: {} };
}

export async function fetchPages(projectId: string): Promise<TPage[]> {
  const data = await apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/pages/?per_page=100`);
  const items = data?.results ?? data ?? [];
  // Log first item to debug parent field
  if (items.length > 0) console.log("Page sample keys:", Object.keys(items[0]), "parent:", items[0].parent);
  return items;
}

export async function fetchPage(projectId: string, pageId: string): Promise<TPage | null> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/pages/${pageId}/`);
}

export async function createPage(projectId: string, data: { name: string; description_html?: string; access?: number }): Promise<TPage> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/pages/`, {
    method: "POST", body: JSON.stringify(data),
  });
}

export async function updatePage(projectId: string, pageId: string, data: { name?: string; description_html?: string; access?: number }): Promise<TPage> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/pages/${pageId}/`, {
    method: "PATCH", body: JSON.stringify(data),
  });
}

export async function createLabel(projectId: string, name: string, color: string): Promise<TLabel> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issue-labels/`, {
    method: "POST", body: JSON.stringify({ name, color }),
  });
}

export type TMember = { id: string; display_name: string; first_name?: string; last_name?: string; avatar?: string; email?: string };

// Global member cache (like Plane web's memberMap)
let _memberCache: TMember[] | null = null;

export async function fetchAllMembers(): Promise<TMember[]> {
  if (_memberCache) return _memberCache;
  const raw = await apiFetch(`/api/workspaces/${WORKSPACE}/members/`);
  if (!raw) return [];
  const data = Array.isArray(raw) ? raw : (raw.results ?? []);
  _memberCache = data.map((m: any) => {
    const user = m.member ?? m;
    return { id: String(user.id ?? ""), display_name: String(user.display_name ?? ""), first_name: String(user.first_name ?? ""), avatar: String(user.avatar_url ?? user.avatar ?? "") };
  }).filter((m: TMember) => m.id);
  return _memberCache;
}

export async function fetchMembers(projectId: string): Promise<TMember[]> {
  // Get project member IDs, then resolve names from workspace cache
  const raw = await apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/members/`);
  const allMembers = await fetchAllMembers();
  if (!raw) return allMembers; // fallback to all if project members fail
  const data = Array.isArray(raw) ? raw : (raw.results ?? []);
  // Extract member UUIDs from project members response
  const memberIds = new Set(data.map((m: any) => String(m.member?.id ?? m.member ?? m.id ?? "")));
  // Filter workspace members to only project members
  const projectMembers = allMembers.filter((m) => memberIds.has(m.id));
  return projectMembers.length > 0 ? projectMembers : allMembers;
}

export async function createIssue(projectId: string, data: { name: string; priority?: string; state?: string }): Promise<TIssue> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/`, {
    method: "POST", body: JSON.stringify(data),
  });
}

export async function updateIssue(projectId: string, issueId: string, data: any): Promise<TIssue> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/`, {
    method: "PATCH", body: JSON.stringify(data),
  });
}

export async function fetchComments(projectId: string, issueId: string): Promise<TComment[]> {
  const data = await apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/comments/`);
  return data?.results ?? data ?? [];
}

export async function createComment(projectId: string, issueId: string, text: string, access: string = "EXTERNAL"): Promise<TComment> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/comments/`, {
    method: "POST", body: JSON.stringify({ comment_html: `<p>${text}</p>`, access }),
  });
}

export async function updateComment(projectId: string, issueId: string, commentId: string, data: { comment_html?: string; access?: string }): Promise<TComment> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/comments/${commentId}/`, {
    method: "PATCH", body: JSON.stringify(data),
  });
}

export async function setCoverImage(projectId: string, issueId: string, assetId: string | null): Promise<any> {
  return updateIssue(projectId, issueId, { cover_image_asset_id: assetId } as any);
}

export async function deleteAttachment(projectId: string, issueId: string, assetId: string): Promise<void> {
  await apiFetch(`/api/assets/v2/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/attachments/${assetId}/`, { method: "DELETE" });
}

export async function fetchAttachments(projectId: string, issueId: string): Promise<TAttachment[]> {
  return apiFetch(`/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/mobile-attachments/`);
}

// Web upload — accept Blob/File (from <input type="file"> or drag-drop)
// instead of RN's {uri, name, type} shape.
export async function uploadAttachment(projectId: string, issueId: string, file: Blob, fileName: string): Promise<TAttachment> {
  const csrf = await SecureStore.getItemAsync(CSRF_KEY);
  const formData = new FormData();
  formData.append("asset", file, fileName);

  const headers: Record<string, string> = csrf ? { "X-CSRFToken": csrf } : {};
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${WORKSPACE}/projects/${projectId}/issues/${issueId}/mobile-attachments/`,
    { method: "POST", body: formData, headers, credentials: "include" }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
