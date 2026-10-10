/** A place we want a forecast for (landing sites are chosen in Issue #5). */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** One hour of forecast, already cleaned up for the risk engine (Issue #1). */
export interface HourlyPoint {
  /** Local time at the site, ISO format without offset, e.g. "2026-10-09T14:00" */
  time: string;
  /** Wind gust at 10 m, km/h. null if the API had no value for this hour. */
  windGustKmh: number | null;
  /** Rain in the hour, mm. null if missing. */
  precipitationMm: number | null;
  /** Raw WMO weather code. null if missing. */
  weatherCode: number | null;
  /** Visibility in km. null if missing. */
  visibilityKm: number | null;
  /** 0-100 thunderstorm risk score derived from the WMO code. */
  thunderstormRisk: number;
}

export interface SiteForecast {
  coordinates: Coordinates;
  timezone: string;
  hours: HourlyPoint[];
}

/** Why a request failed. The UI uses this to pick a message. */
export type ForecastErrorKind =
  | "offline"
  | "timeout"
  | "rate_limited"
  | "server_error"
  | "bad_response"
  | "unknown";

/**
 * getForecast() never throws. It always returns one of these three states,
 * so the UI can handle every case without try/catch.
 */
export type ForecastResult =
  /** Got good data (from the network or from a still-fresh cache). */
  | { status: "fresh"; data: SiteForecast; fetchedAt: number }
  /** Network failed, but we are showing an older saved forecast. */
  | { status: "stale"; data: SiteForecast; fetchedAt: number; reason: ForecastErrorKind }
  /** Network failed and there is nothing saved to fall back on. */
  | { status: "unavailable"; reason: ForecastErrorKind; message: string };

/** Summary of several hours, handy for the risk engine and the time-window picker. */
export interface HoursSummary {
  maxWindGustKmh: number | null;
  minVisibilityKm: number | null;
  totalPrecipitationMm: number | null;
  maxPrecipitationMmPerHour: number | null;
  maxThunderstormRisk: number;
  hourCount: number;
}
