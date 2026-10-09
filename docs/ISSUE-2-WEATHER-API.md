# Issue #2 - Open-Meteo Weather API integration

Fetches multi-hour forecasts for a landing site and prepares them for the risk engine.

## Files

| File | Job |
|---|---|
| `src/config/env.ts` | Reads settings from `.env.local` (defaults work without it) |
| `src/lib/weather/openMeteoClient.ts` | Client: builds the request, retries once, validates, falls back |
| `src/lib/weather/weatherCodes.ts` | WMO codes 95/96/99 -> thunderstorm risk score (70/85/95) |
| `src/lib/weather/cache.ts` | Memory + localStorage cache, 10 min fresh, up to 6 h as "saved forecast" |
| `src/lib/weather/riskBridge.ts` | Turns a forecast summary into the `WeatherMetrics` that `evaluateRisk` expects |
| `src/hooks/useWeatherForecast.ts` | React hook for screens |
| `src/components/ForecastStatus.tsx` | Loading / saved forecast / unavailable states |
| `src/lib/weather/weather.test.ts` | 27 tests with a mocked network |

## Usage

```tsx
import { useWeatherForecast } from './hooks/useWeatherForecast';
import { summarizeHours, toWeatherMetrics } from './lib/weather';
import { evaluateRisk } from './lib/riskEngine';
import { ForecastStatus } from './components/ForecastStatus';

const { result, loading, retry } = useWeatherForecast({ latitude: -0.1022, longitude: 34.7617 });

// in the JSX:
<ForecastStatus result={result} loading={loading} onRetry={retry} />

// once data is available:
if (result && result.status !== 'unavailable') {
  const bridged = toWeatherMetrics(summarizeHours(result.data.hours.slice(0, 12)), waveHeightMeters);
  const assessment = bridged ? evaluateRisk(bridged.metrics) : null;
}
```

`getForecast` never throws; it returns `fresh`, `stale` or `unavailable`.

## Settings

Copy `.env.example` to `.env.local` (already git-ignored by `*.local`). Vite sends every
`VITE_` variable to the browser, so never put secrets there. Open-Meteo needs no key.

## Notes

- Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0). Show this attribution in the app.
- Thunderstorm scores are a team decision derived from the weather code, not a measured probability (see Issue #14).
- Wave height is not in this API. Pass it to `toWeatherMetrics` from the Marine API (Issue #3) or the lake estimate (Issue #1).
