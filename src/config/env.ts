/**
 * Central place for reading environment settings.
 * Every value has a safe default so the app still works if .env.local is missing.
 */
const raw = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const weatherConfig = {
  baseUrl: (raw.VITE_OPEN_METEO_BASE_URL as string) || "https://api.open-meteo.com/v1",
  cacheTtlMs: toNumber(raw.VITE_WEATHER_CACHE_TTL_MINUTES, 10) * 60_000,
  staleMaxMs: toNumber(raw.VITE_WEATHER_STALE_MAX_HOURS, 6) * 3_600_000,
  requestTimeoutMs: toNumber(raw.VITE_WEATHER_REQUEST_TIMEOUT_MS, 8000),
  timezone: (raw.VITE_WEATHER_TIMEZONE as string) || "Africa/Nairobi",
};

export type WeatherConfig = typeof weatherConfig;
