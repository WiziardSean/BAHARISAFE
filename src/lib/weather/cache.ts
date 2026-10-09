import type { SiteForecast } from "./types";

export interface CacheEntry {
  data: SiteForecast;
  fetchedAt: number;
}

const STORAGE_PREFIX = "baharisafe:forecast:";

/**
 * Small two-layer cache:
 *  1. In memory  - instant, lost when the page reloads.
 *  2. localStorage - survives reloads, so a fisher who opens the app with no
 *     signal can still see the last forecast we managed to download.
 *
 * Browser storage can be missing or full (private mode, tests), so every
 * storage call is wrapped in try/catch and failure is silently ignored.
 */
export class ForecastCache {
  private memory = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    const hit = this.memory.get(key);
    if (hit) return hit;
    const stored = this.readStorage(key);
    if (stored) this.memory.set(key, stored);
    return stored;
  }

  set(key: string, entry: CacheEntry): void {
    this.memory.set(key, entry);
    try {
      globalThis.localStorage?.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch {
      /* storage full or unavailable - memory cache still works */
    }
  }

  clear(): void {
    this.memory.clear();
    try {
      const ls = globalThis.localStorage;
      if (!ls) return;
      Object.keys(ls)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => ls.removeItem(k));
    } catch {
      /* ignore */
    }
  }

  private readStorage(key: string): CacheEntry | undefined {
    try {
      const text = globalThis.localStorage?.getItem(STORAGE_PREFIX + key);
      if (!text) return undefined;
      const parsed = JSON.parse(text) as CacheEntry;
      if (parsed && typeof parsed.fetchedAt === "number" && parsed.data?.hours) return parsed;
    } catch {
      /* corrupt or unavailable */
    }
    return undefined;
  }
}

/**
 * Round coordinates to 2 decimals (about 1 km) so two taps on the same landing
 * site always share one cache entry, even if the coordinates differ slightly.
 */
export function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}
