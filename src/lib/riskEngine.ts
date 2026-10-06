export type RiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'EXTREME';

export interface WeatherMetrics {
  windSpeedKnots: number; // in knots
  waveHeightMeters: number; // in meters
  visibilityKm: number; // in km
  isSquallWarning?: boolean;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0 (Safe) to 100 (Extreme)
  canGoFishing: boolean;
  warnings: string[];
}

export function evaluateRisk(metrics: WeatherMetrics): RiskAssessment {
  const warnings: string[] = [];
  let score = 0;

  // 1. Wind Speed Assessment (Knots)
  if (metrics.windSpeedKnots >= 25) {
    score += 50;
    warnings.push('Gale force winds detected (>= 25 knots). Severe capsize risk.');
  } else if (metrics.windSpeedKnots >= 15) {
    score += 25;
    warnings.push('Moderate to high winds (15-24 knots). Rough surface conditions.');
  } else if (metrics.windSpeedKnots >= 10) {
    score += 10;
  }

  // 2. Wave Height Assessment (Meters)
  if (metrics.waveHeightMeters >= 2.5) {
    score += 50;
    warnings.push('High wave swell (>= 2.5m). Unsafe for small crafts.');
  } else if (metrics.waveHeightMeters >= 1.5) {
    score += 25;
    warnings.push('Moderate wave swell (1.5m - 2.4m). Increased vessel instability.');
  } else if (metrics.waveHeightMeters >= 0.8) {
    score += 10;
  }

  // 3. Visibility Assessment (Km)
  if (metrics.visibilityKm < 2) {
    score += 30;
    warnings.push('Poor visibility (< 2km). High collision and navigation risk.');
  } else if (metrics.visibilityKm < 5) {
    score += 10;
    warnings.push('Reduced visibility (2km - 5km). Maintain high vigilance.');
  }

  // 4. Squall Warning
  if (metrics.isSquallWarning) {
    score += 40;
    warnings.push('Sudden squall / storm alert active.');
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine Overall Risk Level
  let level: RiskLevel = 'SAFE';
  if (score >= 60) {
    level = 'EXTREME';
  } else if (score >= 40) {
    level = 'DANGER';
  } else if (score >= 20) {
    level = 'CAUTION';
  }

  return {
    level,
    score,
    canGoFishing: level === 'SAFE' || level === 'CAUTION',
    warnings,
  };
}