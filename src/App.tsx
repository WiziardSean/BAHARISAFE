import { useState, useEffect, useMemo } from 'react';
import { LANDING_SITES, type LandingSite } from './data/sites';
import { DEMO_SCENARIOS } from './data/demoScenarios';
import { evaluateRisk, type RiskLevel, type WeatherMetrics } from './lib/riskEngine';
import { weatherClient, summarizeHours, toWeatherMetrics, friendlyMessage } from './lib/weather';
import { marineClient } from './lib/marine/marineClient';
import { getWorstWaveHeight } from './lib/marine/marineBridge';
import { ShieldAlert, CheckCircle2, AlertTriangle, OctagonAlert, Anchor, Wifi, WifiOff, Loader2, Map as MapIcon, Home as HomeIcon, Bell, Settings, Calendar, Compass, Thermometer, Wind, Waves, Eye, Menu, X, Sun } from 'lucide-react';
import { MapView } from './components/MapView';

const KMH_PER_KNOT = 1.852;
const LAKE_WAVE_PER_KNOT = 0.04;

const RISK_STYLES: Record<RiskLevel, { card: string; bar: string; label: string; text: string }> = {
  SAFE: {
    card: 'bg-emerald-600 text-white shadow-lg border-emerald-500',
    bar: 'bg-white',
    label: 'Good conditions for fishing today.',
    text: 'text-white',
  },
  CAUTION: {
    card: 'bg-amber-500 text-slate-950 shadow-lg border-amber-400',
    bar: 'bg-slate-950',
    label: 'Fishing possible, but stay close to shore.',
    text: 'text-slate-950',
  },
  DANGER: {
    card: 'bg-orange-600 text-white shadow-lg border-orange-500',
    bar: 'bg-white',
    label: 'Dangerous conditions for small crafts.',
    text: 'text-white',
  },
  EXTREME: {
    card: 'bg-rose-600 text-white shadow-lg border-rose-500',
    bar: 'bg-white',
    label: 'Stay on land. Conditions are life-threatening.',
    text: 'text-white',
  },
};

function RiskIcon({ level }: { level: RiskLevel }) {
  if (level === 'SAFE') return <CheckCircle2 className="w-7 h-7 text-white shrink-0" />;
  if (level === 'CAUTION') return <AlertTriangle className="w-7 h-7 text-slate-950 shrink-0" />;
  if (level === 'DANGER') return <ShieldAlert className="w-7 h-7 text-white shrink-0" />;
  return <OctagonAlert className="w-7 h-7 text-white shrink-0" />;
}

export default function App() {
  const [selectedSite, setSelectedSite] = useState<LandingSite>(LANDING_SITES[0]);
  const [timeWindow, setTimeWindow] = useState<number>(12);
  const [useDemoMode, setUseDemoMode] = useState<boolean>(true);
  const [demoScenarioId, setDemoScenarioId] = useState<string>('calm-morning');
  const [liveMetrics, setLiveMetrics] = useState<WeatherMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'forecast' | 'map' | 'alerts' | 'settings'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (useDemoMode) return;
    let cancelled = false;

    async function loadLiveData() {
      setIsLoading(true);
      setApiError(null);
      setLiveMetrics(null);
      try {
        const weather = await weatherClient.getForecast({
          latitude: selectedSite.lat,
          longitude: selectedSite.lon,
        });

        if (cancelled) return;
        if (weather.status === 'unavailable') {
          setApiError(friendlyMessage(weather.reason));
          return;
        }

        const hours = weather.data.hours.slice(0, timeWindow);
        const summary = summarizeHours(hours);

        let waveHeightMeters: number;
        if (selectedSite.isOcean) {
          const marine = await marineClient.getMarineForecast(selectedSite.lat, selectedSite.lon);
          if (cancelled) return;
          if (marine.status === 'unavailable') {
            waveHeightMeters = 0.5;
          } else {
            waveHeightMeters = getWorstWaveHeight(marine.data, timeWindow);
          }
        } else {
          const windKnots = (summary.maxWindGustKmh ?? 0) / KMH_PER_KNOT;
          waveHeightMeters = Math.round(windKnots * LAKE_WAVE_PER_KNOT * 10) / 10;
        }

        const bridged = toWeatherMetrics(summary, waveHeightMeters);
        if (!bridged) {
          setApiError('No wind data available for risk assessment.');
          return;
        }

        setLiveMetrics(bridged.metrics);
      } catch {
        if (!cancelled) setApiError('Failed to load live forecast data.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [selectedSite, timeWindow, useDemoMode]);

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
    <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-x-hidden font-sans">
      
      {/* VIBRANT FULL-SCREEN SCENIC BACKGROUND (Just like FishCast concept image) */}
      <div 
        className="fixed inset-0 bg-cover bg-top bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: `url('/fisherman-bg.jpg')` }}
      />

      {/* TOP GRADIENT OVERLAY FOR STATUS BAR READABILITY */}
      <div className="fixed top-0 inset-x-0 h-32 bg-gradient-to-b from-slate-950/70 via-slate-900/30 to-transparent pointer-events-none z-0" />

      {/* MOBILE APP CONTAINER */}
      <div className="w-full sm:max-w-md sm:mx-auto min-h-screen flex flex-col relative sm:shadow-2xl z-10 pb-20">
        
        {/* MOBILE TOP HEADER (TRANSPARENT / GLASS WITH SHADOW) */}
        <header className="px-4 pt-4 pb-2 flex items-center justify-between text-white drop-shadow-md sticky top-0 z-50 bg-slate-950/30 backdrop-blur-sm">
          <div className="flex items-center space-x-2.5">
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-2xl border border-white/30 text-white shadow">
              <Anchor className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white leading-none tracking-tight">BahariSafe</h1>
              <p className="text-[10px] text-sky-100 font-medium mt-0.5">Marine Weather for Fishermen</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setCurrentTab('alerts')} className="p-2 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-2xl relative text-white border border-white/30 shadow transition">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900"></span>
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-2xl text-white border border-white/30 shadow transition">
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* SLIDEOUT MENU OVERLAY */}
        {isMobileMenuOpen && (
          <div className="mx-4 mt-2 bg-white/95 backdrop-blur-xl border border-white/40 rounded-3xl p-4 z-50 shadow-2xl space-y-3 text-slate-900">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">App Mode</div>
            <button
              onClick={() => { setUseDemoMode(!useDemoMode); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-semibold transition ${
                useDemoMode ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <span className="flex items-center space-x-2">
                {useDemoMode ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                <span>{useDemoMode ? 'Offline Demo Mode' : 'Live API Mode'}</span>
              </span>
              <span className="text-[10px] underline">Toggle</span>
            </button>
          </div>
        )}

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 p-4 space-y-3.5 overflow-y-auto pb-24">

          {/* SECTION: LANDING SITE SELECTOR (FLOATING WHITE GLASS PILL) */}
          <div className="bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl p-3.5 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-600" />
                <span>Landing Site</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full font-bold">Live Calc</span>
            </div>

            <select
              value={selectedSite.id}
              onChange={(e) => {
                const site = LANDING_SITES.find((s) => s.id === e.target.value);
                if (site) setSelectedSite(site);
              }}
              className="w-full bg-slate-100/90 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 transition shadow-inner"
            >
              <optgroup label="🌊 Coast Region (Ocean)">
                {LANDING_SITES.filter(s => s.region.includes('Coast')).map(s => <option key={s.id} value={s.id}>{s.name} 🌊</option>)}
              </optgroup>
              <optgroup label="🏞️ Lake Victoria Region">
                {LANDING_SITES.filter(s => s.region.includes('Lake Victoria')).map(s => <option key={s.id} value={s.id}>{s.name} 🏞️</option>)}
              </optgroup>
              <optgroup label="🏞️ Turkana & Rift Valley">
                {LANDING_SITES.filter(s => s.region.includes('Rift Valley') || s.region.includes('Turkana')).map(s => <option key={s.id} value={s.id}>{s.name} 🏞️</option>)}
              </optgroup>
            </select>

            {/* Time Window Picker */}
            <div className="pt-0.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1 mb-1.5">
                <Calendar className="w-3 h-3 text-sky-600" />
                <span>Trip Time Horizon</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Morning', hours: 6 },
                  { label: 'Afternoon', hours: 12 },
                  { label: 'Evening', hours: 18 },
                  { label: '24 Hours', hours: 24 },
                ].map((w) => (
                  <button
                    key={w.hours}
                    onClick={() => setTimeWindow(w.hours)}
                    className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition shadow-sm border ${
                      timeWindow === w.hours
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md scale-[1.02]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {useDemoMode && (
              <div className="pt-2 border-t border-slate-200/80">
                <label className="text-[10px] text-slate-500 font-medium block mb-1">Demo Scenarios:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEMO_SCENARIOS.map((scen) => (
                    <button
                      key={scen.id}
                      onClick={() => setDemoScenarioId(scen.id)}
                      className={`p-1.5 rounded-xl border text-left transition ${
                        demoScenarioId === scen.id ? 'bg-sky-50 border-sky-400 text-sky-800 font-bold' : 'bg-white border-slate-200 text-slate-500 text-[9px]'
                      }`}
                    >
                      <div className="truncate">{scen.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VIEW: HOME / ASSESSMENT */}
          {currentTab === 'home' && (
            <div className="space-y-3.5">
              
              {/* CURRENT CONDITIONS CARD (WHITE FLOATING GLASS GRID - JUST LIKE FISHCAST) */}
              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Current Conditions</span>
                  </span>
                  {isLoading ? <Loader2 className="w-4 h-4 text-sky-600 animate-spin" /> : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Good</span>}
                </div>

                {apiError && <p className="text-xs text-rose-500 font-semibold">{apiError}</p>}

                {metrics ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Wind className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Wind</div>
                        <div className="text-sm font-extrabold text-slate-900">{metrics.windSpeedKnots.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">kts</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Waves className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Waves</div>
                        <div className="text-sm font-extrabold text-slate-900">{metrics.waveHeightMeters.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">m</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Visibility</div>
                        <div className="text-sm font-extrabold text-slate-900">{metrics.visibilityKm.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">km</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Thermometer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Squall</div>
                        <div className={`text-xs font-extrabold ${metrics.isSquallWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {metrics.isSquallWarning ? 'ACTIVE' : 'None'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  !isLoading && <p className="text-xs text-slate-400 italic">Select a site to view conditions.</p>
                )}
              </div>

              {/* SAFETY STATUS CARD (GREEN / AMBER / RED PROMINENT BANNER LIKE FISHCAST) */}
              {assessment && style ? (
                <div className={`rounded-3xl p-4 border ${style.card} space-y-2.5 transition-all transform`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <RiskIcon level={assessment.level} />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Safety Status</div>
                        <div className="text-xl font-black tracking-tight leading-none">{assessment.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">Risk Score</div>
                      <div className="text-xl font-black tracking-tight">{assessment.score}<span className="text-xs font-medium opacity-80">/100</span></div>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-black/20 overflow-hidden">
                    <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${assessment.score}%` }} />
                  </div>

                  <p className="text-sm font-black">{assessment.canGoFishing ? 'Safe to Go Fishing' : 'Do NOT Go Fishing'}</p>
                  <p className="text-xs opacity-95 font-medium">{style.label}</p>
                </div>
              ) : null}

              {/* WARNINGS CARD */}
              {assessment && assessment.warnings.length > 0 && (
                <div className="bg-rose-500/90 text-white backdrop-blur-md border border-rose-400 rounded-3xl p-4 shadow-xl space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>Active Hazard Warnings</span>
                  </h3>
                  <ul className="space-y-1.5">
                    {assessment.warnings.map((w, idx) => (
                      <li key={idx} className="text-xs bg-black/20 p-2 rounded-2xl font-medium">
                        • {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}

          {/* VIEW: MAP */}
          {currentTab === 'map' && (
            <div className="space-y-3">
              <div className="bg-white/90 backdrop-blur-md border border-white/80 p-3 rounded-3xl flex items-center justify-between shadow-lg">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">Fishing Grounds Map</h2>
                  <p className="text-[10px] text-slate-500">Green = Monitored Landing Sites</p>
                </div>
                <span className="text-[10px] px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                  Active
                </span>
              </div>
              <div className="h-[60vh] w-full rounded-3xl overflow-hidden border border-white/80 shadow-2xl">
                <MapView sites={LANDING_SITES} />
              </div>
            </div>
          )}

          {currentTab === 'forecast' && (
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-6 text-center space-y-2 shadow-xl">
              <Calendar className="w-8 h-8 text-sky-600 mx-auto" />
              <h2 className="text-sm font-bold text-slate-900">Detailed Hourly Forecast</h2>
              <p className="text-xs text-slate-500">View wind gusts, wave swells, and precipitation timelines for your chosen window.</p>
            </div>
          )}

          {currentTab === 'alerts' && (
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-6 text-center space-y-2 shadow-xl">
              <Bell className="w-8 h-8 text-rose-500 mx-auto" />
              <h2 className="text-sm font-bold text-slate-900">Storm & Squall Alerts</h2>
              <p className="text-xs text-slate-500">All regional alerts for Lake Victoria, Turkana, and the Coast are up to date.</p>
            </div>
          )}

          {currentTab === 'settings' && (
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-6 text-center space-y-2 shadow-xl">
              <Settings className="w-8 h-8 text-sky-600 mx-auto" />
              <h2 className="text-sm font-bold text-slate-900">App Preferences</h2>
              <p className="text-xs text-slate-500">Language (English / Swahili), units (Knots / Meters), and offline caching settings.</p>
            </div>
          )}

        </main>

        {/* NATIVE BOTTOM NAVIGATION BAR (WHITE GLASS FLOATING BAR) */}
        <nav className="fixed bottom-0 inset-x-0 sm:max-w-md sm:mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-200/80 px-4 py-2 flex items-center justify-around z-50 shadow-2xl">
          {[
            { id: 'home', label: 'Home', icon: HomeIcon },
            { id: 'forecast', label: 'Forecast', icon: Calendar },
            { id: 'map', label: 'Map', icon: MapIcon },
            { id: 'alerts', label: 'Alerts', icon: Bell },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex flex-col items-center py-1 px-3 rounded-2xl transition ${
                  isActive ? 'text-sky-600 font-extrabold scale-105' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
}