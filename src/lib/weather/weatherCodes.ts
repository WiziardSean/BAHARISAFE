/**
 * WMO weather codes 95, 96 and 99 mean thunderstorm.
 *   95 = thunderstorm (slight or moderate)
 *   96 = thunderstorm with slight hail
 *   99 = thunderstorm with heavy hail
 *
 * Open-Meteo does not give a "chance of thunderstorm" percentage, so we turn the
 * code into a 0-100 score. The risk engine (Issue #1) compares this score with
 * the storm thresholds in Issue #11 (30 = CAUTION, 60 = HIGH RISK).
 *
 * Scores are a team decision, not a measured probability. Keep them here in one
 * place so they can be cited and adjusted under Issue #14.
 */
export const THUNDERSTORM_SCORES: Readonly<Record<number, number>> = {
  95: 70,
  96: 85,
  99: 95,
};

export function thunderstormRiskFromCode(code: number | null | undefined): number {
  if (code === null || code === undefined) return 0;
  return THUNDERSTORM_SCORES[code] ?? 0;
}

export function isThunderstormCode(code: number | null | undefined): boolean {
  return code !== null && code !== undefined && code in THUNDERSTORM_SCORES;
}
