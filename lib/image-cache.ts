/**
 * Disk-based image cache for TrackIT mobile.
 * Downloads images once, serves from FileSystem cache on subsequent loads.
 * Works with auth headers (proxy URLs).
 */
import * as FileSystem from "expo-file-system";
import { getSessionCookie } from "./api";

const CACHE_DIR = `${FileSystem.cacheDirectory}img/`;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory map: url → local file URI (avoids FileSystem.getInfoAsync on every render)
const _memCache: Record<string, string> = {};

// Ensure cache dir exists
let _dirReady = false;
async function ensureDir() {
  if (_dirReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  _dirReady = true;
}

function urlToKey(url: string): string {
  // Hash URL to filename — simple but collision-free for our use case
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached image URI. Returns local file:// URI if cached, null if not.
 */
export async function getCachedImage(url: string): Promise<string | null> {
  if (_memCache[url]) {
    console.log("[ImageCache] MEM HIT:", url.split("/proxy/")[1]?.substring(0, 8) || "avatar");
    return _memCache[url];
  }

  await ensureDir();
  const key = urlToKey(url);
  const path = `${CACHE_DIR}${key}.img`;

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      // Check TTL
      const age = Date.now() - (info.modificationTime ?? 0) * 1000;
      if (age < TTL_MS) {
        _memCache[url] = path;
        return path;
      }
      // Expired — delete
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {}

  return null;
}

/**
 * Download and cache image. Returns local file URI.
 */
export async function cacheImage(url: string): Promise<string> {
  // Already cached?
  const cached = await getCachedImage(url);
  if (cached) return cached;

  await ensureDir();
  const key = urlToKey(url);
  const path = `${CACHE_DIR}${key}.img`;

  const cookie = await getSessionCookie();

  try {
    console.log("[ImageCache] Downloading:", url.split("/proxy/")[1]?.substring(0, 8) || url.substring(url.length - 20));
    const t1 = Date.now();
    const result = await FileSystem.downloadAsync(url, path, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    console.log("[ImageCache] Downloaded in", Date.now() - t1, "ms, status:", result.status);

    if (result.status === 200) {
      _memCache[url] = result.uri;
      return result.uri;
    }
    // Failed — cleanup
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {}

  // Fallback — return original URL (will load with auth headers via Image)
  return url;
}

/**
 * Preload multiple images into cache.
 */
export async function preloadImages(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map(cacheImage));
}

/**
 * Clear all cached images.
 */
export async function clearImageCache(): Promise<void> {
  Object.keys(_memCache).forEach(k => delete _memCache[k]);
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    _dirReady = false;
  } catch {}
}
