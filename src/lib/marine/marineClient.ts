import type { MarineFetchResult, MarineForecastResponse } from './types';

const MARINE_API_BASE = 'https://marine-api.open-meteo.com/v1/marine';

// Predefined oceanic locations as specified in Issue #3 checklist
export const OCEAN_LOCATIONS = [
  { name: 'Mombasa', latitude: -4.0435, longitude: 39.6682 },
  { name: 'Kilifi', latitude: -3.6305, longitude: 39.8499 },
  { name: 'Malindi', latitude: -3.2192, longitude: 40.1169 },
  { name: 'Lamu', latitude: -2.2717, longitude: 40.9020 },
  { name: 'Vanga', latitude: -4.6756, longitude: 39.2239 },
];

export function isOceanLocation(lat: number, lon: number): boolean {
  // Check if coordinates match or are close to known ocean sites (~0.2 degree threshold)
  return OCEAN_LOCATIONS.some(
    (loc) => Math.abs(loc.latitude - lat) < 0.2 && Math.abs(loc.longitude - lon) < 0.2
  );
}

const memoryCache = new Map<string, { data: MarineForecastResponse; timestamp: number }>();

export const marineClient = {
  async getMarineForecast(lat: number, lon: number): Promise<MarineFetchResult> {
    // Restrict querying strictly to ocean locations
    if (!isOceanLocation(lat, lon)) {
      return {
        status: 'unavailable',
        message: 'Marine API is restricted to coastal/ocean locations only.',
      };
    }

    const roundedLat = Number(lat.toFixed(2));
    const roundedLon = Number(lon.toFixed(2));
    const cacheKey = `${roundedLat},${roundedLon}`;
    const now = Date.now();
    const TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

    const cached = memoryCache.get(cacheKey);
    if (cached && now - cached.timestamp < TTL_MS) {
      return { status: 'fresh', data: cached.data, cachedAt: cached.timestamp };
    }

    try {
      const url = `${MARINE_API_BASE}?latitude=${roundedLat}&longitude=${roundedLon}&hourly=wave_height&timezone=Africa/Nairobi`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Marine API responded with status ${response.status}`);
      }

      const data: MarineForecastResponse = await response.json();

      if (!data.hourly || !data.hourly.wave_height) {
        throw new Error('Invalid marine forecast response format');
      }

      memoryCache.set(cacheKey, { data, timestamp: now });
      return { status: 'fresh', data, cachedAt: now };
    } catch (error: any) {
      if (cached) {
        return {
          status: 'stale',
          data: cached.data,
          cachedAt: cached.timestamp,
          error: error.message || 'Network request failed',
        };
      }
      return {
        status: 'unavailable',
        message: error.message || 'Unable to fetch coastal marine data.',
      };
    }
  },
};