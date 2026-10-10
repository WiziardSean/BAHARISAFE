export interface MarineHourlyData {
  time: string[];
  wave_height: (number | null)[];
}

export interface MarineForecastResponse {
  latitude: number;
  longitude: number;
  hourly: MarineHourlyData;
}

export type MarineFetchResult =
  | { status: 'fresh'; data: MarineForecastResponse; cachedAt: number }
  | { status: 'stale'; data: MarineForecastResponse; cachedAt: number; error: string }
  | { status: 'unavailable'; message: string };