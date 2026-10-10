import { useState, useEffect, useMemo } from 'react';
import { LANDING_SITES, type LandingSite } from './data/sites';
import { DEMO_SCENARIOS } from './data/demoScenarios';
import { evaluateRisk, type RiskLevel, type WeatherMetrics } from './lib/riskEngine';
import {
  weatherClient,
  summarizeHours,
  toWeatherMetrics,
  friendlyMessage,
  type HourlyPoint,
} from './lib/weather';
import { marineClient } from './lib/marine/marineClient';
import { getWorstWaveHeight } from './lib/marine/marineBridge';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  Anchor,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';

const WINDOW_HOURS = 12;
const KMH_PER_KNOT = 1.852;
const LAKE_WAVE_PER_KNOT = 0.04; // rough wind-to-wave estimate for inland lakes

const RISK_STYLES: Record<RiskLevel, { card: string; bar: string; label: string }> = {
  SAFE: {
    card: 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200',
    bar: 'bg-emerald-400',
    label: 'Conditions are good. Normal precautions apply.',
  },
  CAUTION: {
    card: 'bg-amber-950/30 border-amber-500/40 text-amber-200',
    bar: 'bg-amber-400',
    label: 'Fishing is possible, but stay alert and stay close to shore.',
  },
  DANGER: {
    card: 'bg-orange-950/30 border-orange-500/40 text-orange-200',
    bar: 'bg-orange-400',
    label: 'Do not go out. Conditions are dangerous for small boats.',
  },
  EXTREME: {
    card: 'bg-rose-950/30 border-rose-500/40 text-rose-200',
    bar: 'bg-rose-500',
    label: 'Stay on land. Conditions are life-threatening.',
  },
};

function RiskIcon({ level }: { level: RiskLevel }) {
  if (level === 'SAFE') return <CheckCircle2 className="w-10 h-10 text-emerald-400" />;
  if (level === 'CAUTION') return <AlertTriangle className="w-10 h-10 text-amber-400" />;
  if (level === 'DANGER') return <ShieldAlert className="w-10 h-10 text-orange-400" />;
  return <OctagonAlert className="w-10 h-10 text-rose-400" />;
}

/**
 * Keeps only the next WINDOW_HOURS hours, counted from "now" in the site's own
 * timezone. Falls back to the first WINDOW_HOURS hours if nothing matches.
 */
function upcomingHours(hours: HourlyPoint[], timezone: string): HourlyPoint[] {
  let nowHour: string | null = null;
  try {
    // sv-SE gives "YYYY-MM-DD HH:mm:ss", which lines up with the API's "YYYY-MM-DDTHH:mm"
    nowHour = new Date()
      .toLocaleString('sv-SE', { timeZone: timezone })
      .replace(' ', 'T')
      .slice(0, 13);
  } catch {
    nowHour = null;
  }
  if (nowHour) {
    const future = hours.filter((h) => h.time.slice(0, 13) >= (nowHour as string));
    if (future.length > 0) return future.slice(0, WINDOW_HOURS);
  }
  return hours.slice(0, WINDOW_HOURS);
}

export default function App() {
  const [selectedSite, setSelectedSite] = useState<LandingSite>(LANDING_SITES[0]);
  const [useDemoMode, setUseDemoMode] = useState<boolean>(true);
  const [demoScenarioId, setDemoScenarioId] = useState<string>('calm-morning');

  const [liveMetrics, setLiveMetrics] = useState<WeatherMetrics | null>(null);
  const [liveNotes, setLiveNotes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (useDemoMode) return;

    let cancelled = false;

    async function loadLiveData() {
      setIsLoading(true);
      setApiError(null);
      setLiveMetrics(null);
      setLiveNotes([]);

      try {
        const notes: string[] = [];

        // 1. Weather (never throws; always returns fresh / stale / unavailable)
        const weather = await weatherClient.getForecast({
          latitude: selectedSite.lat,
          longitude: selectedSite.lon,
        });
        if (cancelled) return;

        if (weather.status === 'unavailable') {
          setApiError(friendlyMessage(weather.reason));
          return;
        }
        if (weather.status === 'stale') {
          notes.push(
            `Showing a saved forecast from ${new Date(weather.fetchedAt).toLocaleTimeString()}. ${friendlyMessage(weather.reason)}`
          );
        }

        const hours = upcomingHours(weather.data.hours, weather.data.timezone);
        const summary = summarizeHours(hours);

        // 2. Waves: marine API for ocean sites, wind-based estimate for lakes
        let waveHeightMeters: number;
        if (selectedSite.isOcean) {
          const marine = await marineClient.getMarineForecast(selectedSite.lat, selectedSite.lon);
          if (cancelled) return;

          if (marine.status === 'unavailable') {
            waveHeightMeters = 0.5;
            notes.push(`Wave data unavailable (${marine.message}). A 0.5 m baseline was assumed.`);
          } else {
            waveHeightMeters = getWorstWaveHeight(marine.data, WINDOW_HOURS);
            if (marine.status === 'stale') {
              notes.push('Wave data is from a saved copy because the marine service could not be reached.');
            }
          }
        } else {
          const windKnots = (summary.maxWindGustKmh ?? 0) / KMH_PER_KNOT;
          waveHeightMeters = Math.round(windKnots * LAKE_WAVE_PER_KNOT * 10) / 10;
          notes.push('Wave height is an estimate from wind speed (no lake wave data available).');
        }

        // 3. Convert to risk-engine input
        const bridged = toWeatherMetrics(summary, waveHeightMeters);
        if (!bridged) {
          setApiError('The forecast has no wind data, so risk cannot be assessed.');
          return;
        }

        setLiveMetrics(bridged.metrics);
        setLiveNotes([...notes, ...bridged.assumptions]);
      } catch {
        if (!cancelled) setApiError('Something went wrong while loading live data. Try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [selectedSite, useDemoMode]);

  const metrics: WeatherMetrics | null = useMemo(() => {
    if (useDemoMode) {
      const scenario = DEMO_SCENARIOS.find((s) => s.id === demoScenarioId);
      return scenario ? scenario.metrics : null;
    }
    return liveMetrics;
  }, [useDemoMode, demoScenarioId, liveMetrics]);

  const assessment = useMemo(() => (metrics ? evaluateRisk(metrics) : null), [metrics]);
  const style = assessment ? RISK_STYLES[assessment.level] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
            <Anchor className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">BahariSafe</h1>
            <p className="text-xs text-slate-400">Marine Weather & Risk Assessment Engine</p>
          </div>
        </div>

        <button
          onClick={() => setUseDemoMode(!useDemoMode)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
            useDemoMode
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {useDemoMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          <span>{useDemoMode ? 'Offline Demo Mode' : 'Live API Mode'}</span>
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              1. Select Landing Site
            </h2>
            <select
              value={selectedSite.id}
              onChange={(e) => {
                const site = LANDING_SITES.find((s) => s.id === e.target.value);
                if (site) setSelectedSite(site);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition"
            >
              {LANDING_SITES.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.region}) {site.isOcean ? '🌊' : '🏞️'}
                </option>
              ))}
            </select>
          </div>

          {useDemoMode && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                2. Demo Scenarios
              </h2>
              <div className="space-y-2">
                {DEMO_SCENARIOS.map((scen) => (
                  <button
                    key={scen.id}
                    onClick={() => setDemoScenarioId(scen.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      demoScenarioId === scen.id
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{scen.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{scen.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                {useDemoMode ? 'Scenario Metrics' : `Live Data (next ${WINDOW_HOURS} h, worst case)`}
              </h2>
              {isLoading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
            </div>

            {apiError && <p className="text-xs text-rose-400">{apiError}</p>}

            {metrics ? (
              <div className="space-y-2">
                <div className="flex justify-between bg-slate-950 px-3 py-2 rounded-lg text-xs">
                  <span className="text-slate-400">Wind Speed</span>
                  <span className="font-mono text-cyan-400">{metrics.windSpeedKnots.toFixed(1)} knots</span>
                </div>
                <div className="flex justify-between bg-slate-950 px-3 py-2 rounded-lg text-xs">
                  <span className="text-slate-400">Wave Height</span>
                  <span className="font-mono text-cyan-400">{metrics.waveHeightMeters.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between bg-slate-950 px-3 py-2 rounded-lg text-xs">
                  <span className="text-slate-400">Visibility</span>
                  <span className="font-mono text-cyan-400">{metrics.visibilityKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between bg-slate-950 px-3 py-2 rounded-lg text-xs">
                  <span className="text-slate-400">Squall Warning</span>
                  <span className={`font-mono ${metrics.isSquallWarning ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {metrics.isSquallWarning ? 'ACTIVE' : 'None'}
                  </span>
                </div>
              </div>
            ) : (
              !isLoading &&
              !apiError && <p className="text-xs text-slate-500 italic">No data to show yet.</p>
            )}

            {!useDemoMode && liveNotes.length > 0 && (
              <ul className="space-y-1.5">
                {liveNotes.map((note, idx) => (
                  <li key={idx} className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {assessment && style ? (
            <>
              <div className={`rounded-2xl p-6 border shadow-2xl ${style.card}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <RiskIcon level={assessment.level} />
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                        Safety Status
                      </div>
                      <div className="text-3xl font-extrabold tracking-tight mt-0.5">{assessment.level}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Risk Score</div>
                    <div className="text-3xl font-extrabold tracking-tight mt-0.5">
                      {assessment.score}
                      <span className="text-base font-medium opacity-70">/100</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full rounded-full bg-slate-950/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${style.bar}`}
                    style={{ width: `${assessment.score}%` }}
                  />
                </div>

                <p className="text-lg font-medium mt-4">
                  {assessment.canGoFishing ? 'OK to go fishing' : 'Do NOT go fishing'}
                </p>
                <p className="text-sm opacity-90 mt-1">{style.label}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Warnings</span>
                </h3>
                {assessment.warnings.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No hazard warnings active.</p>
                ) : (
                  <ul className="space-y-2">
                    {assessment.warnings.map((warning, idx) => (
                      <li
                        key={idx}
                        className="text-sm bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-rose-300"
                      >
                        • {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-sm text-slate-400">
              {isLoading
                ? 'Loading live forecast…'
                : useDemoMode
                ? 'Pick a demo scenario to see an assessment.'
                : 'No assessment available. Check the message on the left, or switch to Offline Demo Mode.'}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}