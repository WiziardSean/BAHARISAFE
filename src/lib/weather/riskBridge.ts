import type { WeatherMetrics } from "../riskEngine";
import type { HoursSummary } from "./types";

const KMH_PER_KNOT = 1.852;

/**
 * Storm score at or above this turns on the engine's squall warning.
 * 60 is the HIGH RISK storm threshold in Issue #11.
 */
export const SQUALL_THUNDERSTORM_THRESHOLD = 60;

/** Used only when the API gave no visibility at all. Listed in `assumptions` so the UI can say so. */
const DEFAULT_VISIBILITY_KM = 10;

export interface BridgeResult {
  metrics: WeatherMetrics;
  /** Plain-language notes about any value we had to assume. Show these to the user. */
  assumptions: string[];
}

/**
 * Converts the weather summary for a trip window into the input the risk
 * engine (riskEngine.ts) expects:
 *   - wind: worst gust, km/h -> knots
 *   - visibility: worst (lowest) value, km
 *   - squall warning: a thunderstorm code (95/96/99) scored at or above the threshold
 *   - waves: NOT available from this API. The caller must pass a value (Marine API in
 *     Issue #3, or the lake estimate from Issue #1) and show it as an estimate if it is one.
 *
 * Returns null when there is no wind data, because we cannot honestly assess risk without it.
 */
export function toWeatherMetrics(summary: HoursSummary, waveHeightMeters: number): BridgeResult | null {
  if (summary.maxWindGustKmh === null) return null;

  const assumptions: string[] = [];
  let visibilityKm = summary.minVisibilityKm;
  if (visibilityKm === null) {
    visibilityKm = DEFAULT_VISIBILITY_KM;
    assumptions.push(`No visibility data, so ${DEFAULT_VISIBILITY_KM} km was assumed.`);
  }

  return {
    metrics: {
      windSpeedKnots: Math.round((summary.maxWindGustKmh / KMH_PER_KNOT) * 10) / 10,
      waveHeightMeters,
      visibilityKm,
      isSquallWarning: summary.maxThunderstormRisk >= SQUALL_THUNDERSTORM_THRESHOLD,
    },
    assumptions,
  };
}
