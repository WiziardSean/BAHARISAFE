import { useCallback, useEffect, useRef, useState } from "react";
import { weatherClient } from "../lib/weather";
import type { Coordinates, ForecastResult } from "../lib/weather";

export interface UseWeatherForecast {
  /** null until the first request finishes (or when no site is selected). */
  result: ForecastResult | null;
  loading: boolean;
  /** Ask the API again, ignoring the fresh cache. Wire this to the Retry button. */
  retry: () => void;
}

/**
 * Fetches the forecast whenever the selected site changes.
 * Pass null when no landing site is selected yet.
 */
export function useWeatherForecast(coords: Coordinates | null): UseWeatherForecast {
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  // Counts requests so a slow, old response can never overwrite a newer one.
  const requestId = useRef(0);

  const lat = coords?.latitude;
  const lon = coords?.longitude;

  const load = useCallback(
    async (forceRefresh: boolean) => {
      if (lat === undefined || lon === undefined) {
        setResult(null);
        setLoading(false);
        return;
      }
      const id = ++requestId.current;
      setLoading(true);
      const next = await weatherClient.getForecast({ latitude: lat, longitude: lon }, { forceRefresh });
      if (id !== requestId.current) return; // user already picked another site
      setResult(next);
      setLoading(false);
    },
    [lat, lon],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // When the phone gets signal back, refresh automatically.
  useEffect(() => {
    const onOnline = () => void load(true);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  const retry = useCallback(() => void load(true), [load]);

  return { result, loading, retry };
}
