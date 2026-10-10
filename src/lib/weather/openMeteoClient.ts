import { weatherConfig, type WeatherConfig } from "../../config/env";
import { ForecastCache, cacheKey } from "./cache";
import { thunderstormRiskFromCode } from "./weatherCodes";
import type {
  Coordinates,
  ForecastErrorKind,
  ForecastResult,
  HourlyPoint,
  HoursSummary,
  SiteForecast,
} from "./types";

/** Thrown internally; never leaves this file (getForecast converts it to a ForecastResult). */
class ForecastError extends Error {
  kind: ForecastErrorKind;
  retryable: boolean;

  constructor(kind: ForecastErrorKind, message: string, retryable = false) {
    super(message);
    this.kind = kind;
    this.retryable = retryable;
  }
}

export interface ForecastClientOptions {
  config?: WeatherConfig;
  /** Replace fetch in tests. */
  fetchImpl?: typeof fetch;
  /** Replace the clock in tests. */
  now?: () => number;
  /** Replace the cache in tests. */
  cache?: ForecastCache;
  /** Pause between retries in ms (set to 0 in tests). */
  retryDelayMs?: number;
  /** Override the browser's online/offline signal (tests). */
  isOnline?: () => boolean;
}

export interface GetForecastOptions {
  /** Skip the fresh cache and ask the API again (used by the Retry button). */
  forceRefresh?: boolean;
  /** How many hours ahead to request. Open-Meteo returns 24 hours per day. Default 2 days. */
  forecastDays?: number;
}

export class OpenMeteoClient {
  private config: WeatherConfig;
  private fetchImpl: typeof fetch;
  private now: () => number;
  private cache: ForecastCache;
  private retryDelayMs: number;
  private isOnline: () => boolean;
  /** Requests currently in flight, keyed like the cache. */
  private inFlight = new Map<string, Promise<ForecastResult>>();

  constructor(opts: ForecastClientOptions = {}) {
    this.config = opts.config ?? weatherConfig;
    this.fetchImpl = opts.fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.now = opts.now ?? Date.now;
    this.cache = opts.cache ?? new ForecastCache();
    this.retryDelayMs = opts.retryDelayMs ?? 600;
    this.isOnline = opts.isOnline ?? (() => globalThis.navigator?.onLine !== false);
  }

  /**
   * Get the forecast for a landing site. Never throws.
   *
   * Order of attempts:
   *  1. fresh cache  -> return it, no network call
   *  2. network      -> cache it and return it
   *  3. old cache    -> return it marked "stale" (degraded mode)
   *  4. nothing      -> return "unavailable" with a reason
   */
  getForecast(coords: Coordinates, options: GetForecastOptions = {}): Promise<ForecastResult> {
    const key = cacheKey(coords.latitude, coords.longitude);
    const cached = this.cache.get(key);
    const age = cached ? this.now() - cached.fetchedAt : Infinity;

    if (cached && age < this.config.cacheTtlMs && !options.forceRefresh) {
      return Promise.resolve({ status: "fresh", data: cached.data, fetchedAt: cached.fetchedAt });
    }

    // If the same site is already being fetched (user tapping quickly), share that request.
    const running = this.inFlight.get(key);
    if (running) return running;

    const request = this.fetchWithFallback(coords, key, options).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }

  private async fetchWithFallback(
    coords: Coordinates,
    key: string,
    options: GetForecastOptions,
  ): Promise<ForecastResult> {
    try {
      if (!this.isOnline()) throw new ForecastError("offline", "No internet connection");
      const data = await this.fetchWithRetry(coords, options.forecastDays ?? 2);
      const fetchedAt = this.now();
      this.cache.set(key, { data, fetchedAt });
      return { status: "fresh", data, fetchedAt };
    } catch (err) {
      const kind: ForecastErrorKind = err instanceof ForecastError ? err.kind : "unknown";
      const cached = this.cache.get(key);
      if (cached && this.now() - cached.fetchedAt <= this.config.staleMaxMs) {
        return { status: "stale", data: cached.data, fetchedAt: cached.fetchedAt, reason: kind };
      }
      return { status: "unavailable", reason: kind, message: friendlyMessage(kind) };
    }
  }

  /** One retry for temporary problems (timeouts, server errors). Not for rate limits or bad requests. */
  private async fetchWithRetry(coords: Coordinates, days: number): Promise<SiteForecast> {
    try {
      return await this.fetchOnce(coords, days);
    } catch (err) {
      if (err instanceof ForecastError && err.retryable) {
        if (this.retryDelayMs > 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
        return this.fetchOnce(coords, days);
      }
      throw err;
    }
  }

  private async fetchOnce(coords: Coordinates, days: number): Promise<SiteForecast> {
    const url = buildForecastUrl(this.config, coords, days);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, { signal: controller.signal });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        throw new ForecastError("timeout", "Request timed out", true);
      }
      throw new ForecastError("offline", "Network request failed", true);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) throw new ForecastError("rate_limited", "Too many requests");
    if (response.status >= 500) throw new ForecastError("server_error", `Server error ${response.status}`, true);
    if (!response.ok) throw new ForecastError("bad_response", `Unexpected status ${response.status}`);

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ForecastError("bad_response", "Response was not valid JSON");
    }
    return parseForecast(json, coords);
  }
}

export function buildForecastUrl(config: WeatherConfig, coords: Coordinates, days: number): string {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    hourly: "wind_gusts_10m,precipitation,weather_code,visibility",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timezone: config.timezone,
    forecast_days: String(days),
  });
  return `${config.baseUrl}/forecast?${params.toString()}`;
}

/**
 * Turn Open-Meteo's "columns" format (one array per variable) into one object
 * per hour. Rejects anything that does not look right, so bad data never
 * reaches the risk engine.
 */
export function parseForecast(json: unknown, coords: Coordinates): SiteForecast {
  const hourly = (json as { hourly?: Record<string, unknown> } | null)?.hourly;
  const times = hourly?.time;
  const gusts = hourly?.wind_gusts_10m;
  const rain = hourly?.precipitation;
  const codes = hourly?.weather_code;
  // Visibility is optional: older cached data or a partial response should not break parsing.
  const visibility = Array.isArray(hourly?.visibility) ? (hourly?.visibility as unknown[]) : null;

  if (
    !Array.isArray(times) || !Array.isArray(gusts) || !Array.isArray(rain) || !Array.isArray(codes) ||
    times.length === 0 ||
    gusts.length !== times.length || rain.length !== times.length || codes.length !== times.length
  ) {
    throw new ForecastError("bad_response", "Forecast data was missing or incomplete");
  }

  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const hours: HourlyPoint[] = times.map((t, i) => {
    const code = num(codes[i]);
    return {
      time: String(t),
      windGustKmh: num(gusts[i]),
      precipitationMm: num(rain[i]),
      weatherCode: code,
      // Open-Meteo reports visibility in metres; the app works in km.
      visibilityKm: visibility && num(visibility[i]) !== null ? (num(visibility[i]) as number) / 1000 : null,
      thunderstormRisk: thunderstormRiskFromCode(code),
    };
  });

  const tz = (json as { timezone?: unknown }).timezone;
  return { coordinates: coords, timezone: typeof tz === "string" ? tz : weatherConfig.timezone, hours };
}

/** Worst-case numbers over a set of hours. Missing values are skipped, not treated as zero. */
export function summarizeHours(hours: HourlyPoint[]): HoursSummary {
  const gusts = hours.map((h) => h.windGustKmh).filter((v): v is number => v !== null);
  const rain = hours.map((h) => h.precipitationMm).filter((v): v is number => v !== null);
  const vis = hours.map((h) => h.visibilityKm).filter((v): v is number => v !== null);
  return {
    minVisibilityKm: vis.length ? Math.min(...vis) : null,
    maxWindGustKmh: gusts.length ? Math.max(...gusts) : null,
    totalPrecipitationMm: rain.length ? rain.reduce((a, b) => a + b, 0) : null,
    maxPrecipitationMmPerHour: rain.length ? Math.max(...rain) : null,
    maxThunderstormRisk: hours.reduce((m, h) => Math.max(m, h.thunderstormRisk), 0),
    hourCount: hours.length,
  };
}

/** Plain-language text for each failure, written for the person using the app. */
export function friendlyMessage(kind: ForecastErrorKind): string {
  switch (kind) {
    case "offline":
      return "No internet connection. Connect and try again.";
    case "timeout":
      return "The weather service is slow to respond. Try again in a moment.";
    case "rate_limited":
      return "Too many forecast requests. Wait a minute, then try again.";
    case "server_error":
      return "The weather service is having problems. Try again later.";
    case "bad_response":
      return "The weather service sent data we could not read. Try again later.";
    default:
      return "Could not load the forecast. Try again.";
  }
}

/** One shared client for the whole app. */
export const weatherClient = new OpenMeteoClient();
