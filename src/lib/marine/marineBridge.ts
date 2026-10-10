import type { MarineForecastResponse } from './types';

export function getWorstWaveHeight(forecast: MarineForecastResponse, hoursCount: number = 12): number {
  const waveHeights = forecast.hourly.wave_height.slice(0, hoursCount);
  const validHeights = waveHeights.filter((h): h is number => h !== null);

  if (validHeights.length === 0) {
    return 0.5; // Default safe baseline if data is missing
  }

  // Return the maximum wave height expected during the window ("Worst Factor Wins")
  return Math.max(...validHeights);
}