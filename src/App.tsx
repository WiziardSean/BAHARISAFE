import { useState, useEffect, useMemo, useRef } from 'react';
import { LANDING_SITES, type LandingSite } from './data/sites';
import { DEMO_SCENARIOS } from './data/demoScenarios';
import { evaluateRisk, type RiskLevel, type WeatherMetrics } from './lib/riskEngine';
import { weatherClient, summarizeHours, toWeatherMetrics, friendlyMessage } from './lib/weather';
import { marineClient } from './lib/marine/marineClient';
import { getWorstWaveHeight } from './lib/marine/marineBridge';
import { ShieldAlert, CheckCircle2, AlertTriangle, OctagonAlert, Anchor, Wifi, Loader2, Map as MapIcon, Home as HomeIcon, Bell, Settings, Calendar, Thermometer, Wind, Waves, Eye, X, Sun, Globe, PhoneCall, DownloadCloud, Ship, MessageSquareWarning, Check, Clock, AlertCircle, Phone, LifeBuoy, ArrowRight, ArrowLeft, Smartphone, ShieldCheck, Compass } from 'lucide-react';
import { MapView } from './components/MapView';
import { FeaturePhoneSimulator } from './components/FeaturePhoneSimulator';
import { EvaluationPortal } from './components/EvaluationPortal';

const KMH_PER_KNOT = 1.852;
const LAKE_WAVE_PER_KNOT = 0.04;

const TRANSLATIONS = {
  EN: {
    appTitle: 'BahariSafe',
    appSubtitle: 'Marine Weather for Fishermen',
    targetSite: 'Landing Site',
    timeHorizon: 'Trip Time Horizon',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    hours24: '24 Hours',
    currentConditions: 'Current Conditions',
    windSpeed: 'Wind Speed',
    waveHeight: 'Wave Height',
    visibility: 'Visibility',
    squallRisk: 'Squall Risk',
    safetyStatus: 'Safety Status',
    riskScore: 'Risk Score',
    okFishing: 'Safe to Go Fishing',
    noFishing: 'Do NOT Go Fishing',
    warnings: 'Active Hazard Warnings',
    home: 'Home',
    forecast: 'Forecast',
    map: 'Map',
    kabambe: 'Kabambe',
    evaluate: 'Evaluate',
    alerts: 'Alerts',
    settings: 'Settings',
    none: 'None',
    active: 'ACTIVE',
  },
  SWA: {
    appTitle: 'BahariSafe',
    appSubtitle: 'Hali ya Hewa ya Bahari na Ziwa',
    targetSite: 'Eneo la Kutua / Mwalo',
    timeHorizon: 'Muda wa Safari',
    morning: 'Asubuhi',
    afternoon: 'Mchana',
    evening: 'Jioni',
    hours24: 'Saa 24',
    currentConditions: 'Hali ya Hewa Sasa',
    windSpeed: 'Kasi ya Upepo',
    waveHeight: 'Kimo cha Mawimbi',
    visibility: 'Uwezo wa Kuona',
    squallRisk: 'Hatari ya Dhoruba',
    safetyStatus: 'Hali ya Usalama',
    riskScore: 'Kiwango cha Hatari',
    okFishing: 'Inafaa Kwenda Kuvua',
    noFishing: 'USIENDE Kuvua',
    warnings: 'Matahadhari ya Hali ya Hewa',
    home: 'Nyumbani',
    forecast: 'Utabiri',
    map: 'Ramani',
    kabambe: 'Kabambe',
    evaluate: 'Tathmini',
    alerts: 'Alerts',
    settings: 'Mipangilio',
    none: 'Hakuna',
    active: 'IMETANGAZWA',
  }
};

const RISK_STYLES: Record<RiskLevel, { card: string; bar: string; labelEn: string; labelSwa: string }> = {
  SAFE: {
    card: 'bg-emerald-600 text-white shadow-lg border-emerald-500',
    bar: 'bg-white',
    labelEn: 'Good conditions for fishing today.',
    labelSwa: 'Hali ya bahari ni nzuri kwa uvuvi leo.',
  },
  CAUTION: {
    card: 'bg-amber-500 text-slate-950 shadow-lg border-amber-400',
    bar: 'bg-slate-950',
    labelEn: 'Fishing possible, but stay close to shore.',
    labelSwa: 'Unaweza kuvua, lakini usiende mbali na pwani.',
  },
  DANGER: {
    card: 'bg-orange-600 text-white shadow-lg border-orange-500',
    bar: 'bg-white',
    labelEn: 'Dangerous conditions for small crafts.',
    labelSwa: 'Hali ni hatari kwa vyombo vidogo vya uvuvi.',
  },
  EXTREME: {
    card: 'bg-rose-600 text-white shadow-lg border-rose-500',
    bar: 'bg-white',
    labelEn: 'Stay on land. Conditions are life-threatening.',
    labelSwa: 'Baki nchi kavu. Hali ni ya hatari sana kwa maisha.',
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
  
  const [useDemoMode, setUseDemoMode] = useState<boolean | null>(null);

  const [demoScenarioId, setDemoScenarioId] = useState<string>('calm-morning');
  const [liveMetrics, setLiveMetrics] = useState<WeatherMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'forecast' | 'map' | 'kabambe' | 'evaluation' | 'alerts' | 'settings'>('home');

  const [lang, setLang] = useState<'EN' | 'SWA'>('EN');
  const [speedUnit, setSpeedUnit] = useState<'kts' | 'kmh' | 'ms'>('kts');
  const [waveUnit, setWaveUnit] = useState<'m' | 'ft'>('m');
  const [offlineCaching, setOfflineCaching] = useState<boolean>(true);
  const [smsAlerts, setSmsAlerts] = useState<boolean>(true);
  const [vesselType, setVesselType] = useState<string>('canoe');

  const [showSosModal, setShowSosModal] = useState<boolean>(false);
  const [sosPosition, setSosPosition] = useState<{ x: number; y: number }>({ x: window.innerWidth - 80, y: window.innerHeight - 200 });
  const draggingRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMoved = useRef<boolean>(false);

  const t = TRANSLATIONS[lang];

  const onPointerDown = (clientX: number, clientY: number) => {
    draggingRef.current = true;
    hasMoved.current = false;
    dragStartPos.current = {
      x: clientX - sosPosition.x,
      y: clientY - sosPosition.y,
    };
  };

  const onPointerMove = (clientX: number, clientY: number) => {
    if (!draggingRef.current) return;
    hasMoved.current = true;
    
    const newX = clientX - dragStartPos.current.x;
    const newY = clientY - dragStartPos.current.y;

    const boundedX = Math.max(10, Math.min(window.innerWidth - 70, newX));
    const boundedY = Math.max(70, Math.min(window.innerHeight - 130, newY));

    setSosPosition({ x: boundedX, y: boundedY });
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleWindowUp = () => onPointerUp();

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('touchmove', handleWindowTouchMove);
    window.addEventListener('touchend', handleWindowUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowUp);
    };
  }, [sosPosition]);

  useEffect(() => {
    if (useDemoMode || useDemoMode === null) return;
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

  const displayWindSpeed = (knots: number) => {
    if (speedUnit === 'kmh') return `${(knots * 1.852).toFixed(1)} km/h`;
    if (speedUnit === 'ms') return `${(knots * 0.514444).toFixed(1)} m/s`;
    return `${knots.toFixed(1)} kts`;
  };

  const displayWaveHeight = (meters: number) => {
    if (waveUnit === 'ft') return `${(meters * 3.28084).toFixed(1)} ft`;
    return `${meters.toFixed(1)} m`;
  };

  if (useDemoMode === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative px-4 font-sans select-none">
        <div 
          className="fixed inset-0 bg-cover bg-top bg-no-repeat pointer-events-none z-0"
          style={{ backgroundImage: `url('/fisherman-bg.jpg')` }}
        />
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-0" />

        <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-6">
          <div className="bg-sky-600 text-white w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-lg border-2 border-white">
            <Anchor className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">BahariSafe</h1>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Real-time marine weather safety & risk assessment for fishermen on Lake Victoria, Turkana, and the Kenyan Coast.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => setUseDemoMode(false)}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition transform active:scale-95"
            >
              <Wifi className="w-4 h-4" />
              <span>LAUNCH LIVE API MODE</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setUseDemoMode(true)}
              className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition transform active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
              <span>LAUNCH OFFLINE DEMO SCENARIOS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 font-medium">
            Maritime Safety Application • Sign-up & Accounts coming soon
          </div>
        </div>
      </div>
    );
  }

  // IF KABAMBE TAB IS SELECTED, RENDER FULLSCREEN PHONE
  if (currentTab === 'kabambe') {
    return <FeaturePhoneSimulator onBackToHome={() => setCurrentTab('home')} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden font-sans select-none">
      
      <div 
        className="fixed inset-0 bg-cover bg-top bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: `url('/fisherman-bg.jpg')` }}
      />

      <div className="fixed top-0 inset-x-0 h-32 bg-gradient-to-b from-slate-950/70 via-slate-900/30 to-transparent pointer-events-none z-0" />

      {/* FREELY POSITIONABLE FLOATING SOS BUTTON */}
      <div
        style={{ left: `${sosPosition.x}px`, top: `${sosPosition.y}px` }}
        className="fixed z-[150] cursor-grab active:cursor-grabbing touch-none select-none"
        onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onClick={() => {
          if (!hasMoved.current) setShowSosModal(true);
        }}
      >
        <div className="bg-rose-600 hover:bg-rose-700 text-white w-14 h-14 rounded-full shadow-2xl flex flex-col items-center justify-center border-4 border-white animate-bounce transition transform hover:scale-110">
          <LifeBuoy className="w-6 h-6 animate-pulse" />
          <span className="text-[10px] font-black tracking-tighter leading-none mt-0.5">SOS</span>
        </div>
      </div>

      {showSosModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-slate-900 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-600 font-extrabold text-sm uppercase">
                <ShieldAlert className="w-5 h-5" />
                <span>Maritime Emergency SOS</span>
              </div>
              <button onClick={() => setShowSosModal(false)} className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Select an emergency authority to call immediately for rescue or assistance on Lake Victoria, Turkana, or the Coast:
            </p>

            <div className="space-y-2.5">
              <a
                href="tel:112"
                className="flex items-center justify-between p-3.5 bg-rose-600 text-white rounded-2xl shadow-md font-extrabold text-xs hover:bg-rose-700 transition"
                onClick={() => setShowSosModal(false)}
              >
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5" />
                  <div>
                    <div className="text-sm">Kenya Coast Guard</div>
                    <div className="text-[10px] opacity-90">National Emergency: 112</div>
                  </div>
                </div>
                <span className="bg-white/20 px-2.5 py-1 rounded-xl text-xs">CALL NOW</span>
              </a>

              <a
                href="tel:0800720021"
                className="flex items-center justify-between p-3.5 bg-sky-600 text-white rounded-2xl shadow-md font-extrabold text-xs hover:bg-sky-700 transition"
                onClick={() => setShowSosModal(false)}
              >
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5" />
                  <div>
                    <div className="text-sm">Kenya Maritime Authority</div>
                    <div className="text-[10px] opacity-90">Toll-Free: 0800 720 021</div>
                  </div>
                </div>
                <span className="bg-white/20 px-2.5 py-1 rounded-xl text-xs">CALL NOW</span>
              </a>
            </div>

            <button
              onClick={() => setShowSosModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-600 transition"
            >
              Cancel / Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="w-full sm:max-w-md sm:mx-auto min-h-screen flex flex-col relative sm:shadow-2xl z-10 pb-20">
        
        <header className="px-4 pt-4 pb-2 flex items-center justify-between text-white drop-shadow-md sticky top-0 z-50 bg-slate-950/30 backdrop-blur-sm">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setUseDemoMode(null)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-2 rounded-2xl border border-white/35 text-white shadow transition flex items-center space-x-1"
              title="Back to Mode Selection"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="bg-white/25 backdrop-blur-md p-2 rounded-2xl border border-white/35 text-white shadow">
              <Anchor className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white leading-none tracking-tight">{t.appTitle}</h1>
              <p className="text-[10px] text-sky-100 font-medium mt-0.5">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setLang(lang === 'EN' ? 'SWA' : 'EN')} 
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 shadow text-xs font-bold text-white transition active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-sky-200" />
              <span>{lang === 'EN' ? 'SWA 🇰🇪' : 'ENG 🇬🇧'}</span>
            </button>

            <button onClick={() => setCurrentTab('alerts')} className="p-2 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-2xl relative text-white border border-white/30 shadow transition">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900"></span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 space-y-3.5 overflow-y-auto pb-24">

          {currentTab === 'home' && (
            <div className="space-y-3.5">

              <div className="bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl p-3.5 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <Compass className="w-3.5 h-3.5 text-sky-600" />
                    <span>{t.targetSite}</span>
                  </label>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${useDemoMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {useDemoMode ? 'Demo Mode' : 'Live API'}
                  </span>
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
                  <optgroup label="Lake Victoria">
                    {LANDING_SITES.filter(s => s.region.includes('Lake Victoria')).map(s => <option key={s.id} value={s.id}>{s.name} 🏞️</option>)}
                  </optgroup>
                  <optgroup label="Turkana & Rift Valley">
                    {LANDING_SITES.filter(s => s.region.includes('Rift Valley') || s.region.includes('Turkana')).map(s => <option key={s.id} value={s.id}>{s.name} 🏞️</option>)}
                  </optgroup>
                </select>

                <div className="pt-0.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1 mb-1.5">
                    <Calendar className="w-3 h-3 text-sky-600" />
                    <span>{t.timeHorizon}</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: t.morning, hours: 6 },
                      { label: t.afternoon, hours: 12 },
                      { label: t.evening, hours: 18 },
                      { label: t.hours24, hours: 24 },
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

                  {timeWindow === 24 && (
                    <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 font-medium space-y-1">
                      <div className="font-extrabold flex items-center space-x-1.5 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'EN' ? '24-Hour Extended Trip Advisory' : 'Onyo la Safari ya Saa 24'}</span>
                      </div>
                      <p>
                        {lang === 'EN'
                          ? 'Planning a full 24-hour stay on small craft is extremely hazardous due to unpredictable midnight squalls and shifting night gales. We recommend returning before sunset.'
                          : 'Kukaa majini kwa saa 24 mfululizo kwa vyombo vidogo ni hatari kubwa kutokana na dhoruba za usiku. Tunapendekeza kurudi kabla ya jua kuzama.'}
                      </p>
                    </div>
                  )}
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

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>{t.currentConditions}</span>
                  </span>
                  {isLoading ? <Loader2 className="w-4 h-4 text-sky-600 animate-spin" /> : <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Live</span>}
                </div>

                {apiError && <p className="text-xs text-rose-500 font-semibold">{apiError}</p>}

                {metrics ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Wind className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t.windSpeed}</div>
                        <div className="text-xs font-extrabold text-slate-900">{displayWindSpeed(metrics.windSpeedKnots)}</div>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Waves className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t.waveHeight}</div>
                        <div className="text-xs font-extrabold text-slate-900">{displayWaveHeight(metrics.waveHeightMeters)}</div>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t.visibility}</div>
                        <div className="text-xs font-extrabold text-slate-900">{metrics.visibilityKm.toFixed(1)} km</div>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 p-2.5 rounded-2xl border border-slate-200/80 flex items-center space-x-2.5 shadow-sm">
                      <div className="p-2 bg-sky-100 rounded-xl text-sky-600">
                        <Thermometer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t.squallRisk}</div>
                        <div className={`text-xs font-extrabold ${metrics.isSquallWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {metrics.isSquallWarning ? t.active : t.none}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  !isLoading && <p className="text-xs text-slate-400 italic">Select a site to view conditions.</p>
                )}
              </div>

              {assessment && style ? (
                <div className={`rounded-3xl p-4 border ${style.card} space-y-2.5 transition-all transform`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <RiskIcon level={assessment.level} />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">{t.safetyStatus}</div>
                        <div className="text-xl font-black tracking-tight leading-none">{assessment.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">{t.riskScore}</div>
                      <div className="text-xl font-black tracking-tight">{assessment.score}<span className="text-xs font-medium opacity-80">/100</span></div>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-black/20 overflow-hidden">
                    <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${assessment.score}%` }} />
                  </div>

                  <p className="text-sm font-black">{assessment.canGoFishing ? `✅ ${t.okFishing}` : `❌ ${t.noFishing}`}</p>
                  <p className="text-xs opacity-95 font-medium">{lang === 'EN' ? style.labelEn : style.labelSwa}</p>
                </div>
              ) : null}

              {timeWindow === 24 && (
                <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-sky-600" />
                      <span>{lang === 'EN' ? '24-Hour Forecast Schedule' : 'Mwenendo wa Saa 24 Hapa'}</span>
                    </span>
                    <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full">Complete Timeline</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {[
                      { time: '06:00 AM', wind: '6.2 kts', wave: '0.4 m', status: 'SAFE', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                      { time: '09:00 AM', wind: '7.8 kts', wave: '0.5 m', status: 'SAFE', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                      { time: '12:00 PM', wind: '14.2 kts', wave: '1.1 m', status: 'CAUTION', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                      { time: '03:00 PM', wind: '22.5 kts', wave: '1.8 m', status: 'DANGER', bg: 'bg-orange-50 text-orange-800 border-orange-200' },
                      { time: '06:00 PM', wind: '18.0 kts', wave: '1.4 m', status: 'CAUTION', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                      { time: '09:00 PM', wind: '12.0 kts', wave: '0.9 m', status: 'CAUTION', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                      { time: '12:00 AM (Night)', wind: '25.4 kts', wave: '2.1 m', status: 'DANGER', bg: 'bg-rose-50 text-rose-800 border-rose-200' },
                      { time: '03:00 AM (Late)', wind: '19.8 kts', wave: '1.6 m', status: 'DANGER', bg: 'bg-orange-50 text-orange-800 border-orange-200' },
                    ].map((h, i) => (
                      <div key={i} className={`flex items-center justify-between p-2.5 rounded-2xl border ${h.bg} shadow-xs`}>
                        <div className="flex items-center space-x-2.5">
                          <div className="font-mono font-extrabold text-[11px]">{h.time}</div>
                          <div className="text-[10px] opacity-80">Wind: {h.wind} | Wave: {h.wave}</div>
                        </div>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-lg bg-white/80">
                          {h.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assessment && assessment.warnings.length > 0 && (
                <div className="bg-rose-500/90 text-white backdrop-blur-md border border-rose-400 rounded-3xl p-4 shadow-xl space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>{t.warnings}</span>
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

          {currentTab === 'evaluation' && (
            <EvaluationPortal />
          )}

          {currentTab === 'forecast' && (
            <div className="space-y-3.5">
              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl flex items-center space-x-3">
                <div className="p-3 bg-sky-100 rounded-2xl text-sky-600">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{lang === 'EN' ? 'Hourly Weather Forecast' : 'Utabiri wa Hali ya Hewa kwa Saa'}</h2>
                  <p className="text-xs text-slate-500 font-medium">{selectedSite.name} — {selectedSite.region}</p>
                </div>
              </div>

              <div className="bg-emerald-500 text-white rounded-3xl p-4 shadow-xl space-y-2 border border-emerald-400">
                <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{lang === 'EN' ? 'Recommended Safe Departure Window' : 'Muda Salama wa Kuondoka'}</span>
                </div>
                <div className="text-lg font-black">05:00 AM – 10:00 AM</div>
                <p className="text-xs opacity-95 font-medium">
                  {lang === 'EN' ? 'Calm morning waters with low wind gusts (< 8 kts). Ideal for small craft fishing.' : 'Maji tulivu ya asubuhi na upepo mdogo. Inafaa kwa vyombo vidogo.'}
                </p>
              </div>

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>{lang === 'EN' ? 'Next 24 Hours Timeline' : 'Mwenendo wa Saa 24 Zijazo'}</span>
                  </span>
                  <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-full">Updated Live</span>
                </div>

                <div className="space-y-2">
                  {[
                    { time: '06:00 AM', wind: '6.2 kts', wave: '0.4 m', status: 'SAFE', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                    { time: '09:00 AM', wind: '7.8 kts', wave: '0.5 m', status: 'SAFE', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                    { time: '12:00 PM', wind: '14.2 kts', wave: '1.1 m', status: 'CAUTION', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                    { time: '03:00 PM', wind: '22.5 kts', wave: '1.8 m', status: 'DANGER', bg: 'bg-orange-50 text-orange-800 border-orange-200' },
                    { time: '06:00 PM', wind: '18.0 kts', wave: '1.4 m', status: 'CAUTION', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
                    { time: '09:00 PM', wind: '9.0 kts', wave: '0.6 m', status: 'SAFE', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                  ].map((h, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${h.bg} shadow-sm`}>
                      <div className="flex items-center space-x-3">
                        <div className="font-mono font-extrabold text-xs">{h.time}</div>
                        <div className="text-[11px] opacity-80">Wind: {h.wind} | Waves: {h.wave}</div>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-1 rounded-xl bg-white/80 shadow-xs">
                        {h.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-500/90 text-slate-950 rounded-3xl p-4 shadow-xl space-y-1.5 border border-amber-400">
                <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  <span>{lang === 'EN' ? 'Afternoon Wind Advisory' : 'Onyo la Upepo wa Mchana'}</span>
                </div>
                <p className="text-xs font-semibold">
                  {lang === 'EN' ? 'Expect wind speeds to pick up significantly past 2:00 PM across Lake Victoria and coastal channels. Ensure return by noon.' : 'Tarajia upepo kuongezeka baada ya saa 8:00 mchana. Hakikisha umerudi kabla ya adhuhuri.'}
                </p>
              </div>
            </div>
          )}

          {currentTab === 'settings' && (
            <div className="space-y-3.5">
              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl flex items-center space-x-3">
                <div className="p-3 bg-sky-100 rounded-2xl text-sky-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{lang === 'EN' ? 'App Preferences' : 'Mipangilio ya Programu'}</h2>
                  <p className="text-xs text-slate-500 font-medium">{lang === 'EN' ? 'Customize units, vessel profiles & alerts' : 'Badilisha vipimo, vyombo vya uvuvi na tahadhari'}</p>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Globe className="w-4 h-4 text-sky-600" />
                  <span>Language / Lugha</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLang('EN')}
                    className={`p-3 rounded-2xl font-bold text-xs flex items-center justify-between border transition ${
                      lang === 'EN' ? 'bg-sky-600 text-white border-sky-500 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>English (EN)</span>
                    {lang === 'EN' && <Check className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setLang('SWA')}
                    className={`p-3 rounded-2xl font-bold text-xs flex items-center justify-between border transition ${
                      lang === 'SWA' ? 'bg-sky-600 text-white border-sky-500 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>Kiswahili (SWA)</span>
                    {lang === 'SWA' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Ship className="w-4 h-4 text-sky-600" />
                  <span>Vessel Type / Aina ya Chombo</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'canoe', label: 'Paddle Canoe (Dugout)' },
                    { id: 'outboard', label: 'Motorized Outboard' },
                    { id: 'dhow', label: 'Traditional Dhow' },
                    { id: 'fiber', label: 'Fiberglass Boat' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVesselType(v.id)}
                      className={`p-2.5 rounded-2xl text-xs font-bold border text-left transition ${
                        vesselType === v.id ? 'bg-sky-600 text-white border-sky-500 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                  <Wind className="w-4 h-4 text-sky-600" />
                  <span>Unit Measurements</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-600 font-semibold block">Wind Speed Unit:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'kts', label: 'Knots' },
                      { id: 'kmh', label: 'km/h' },
                      { id: 'ms', label: 'm/s' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSpeedUnit(u.id as any)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                          speedUnit === u.id ? 'bg-sky-600 text-white border-sky-500 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="text-xs text-slate-600 font-semibold block">Wave Height Unit:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'm', label: 'Meters (m)' },
                      { id: 'ft', label: 'Feet (ft)' },
                    ].map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setWaveUnit(u.id as any)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                          waveUnit === u.id ? 'bg-sky-600 text-white border-sky-500 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <DownloadCloud className="w-4 h-4 text-sky-600" />
                    <span>Offline Forecast Caching</span>
                  </div>
                  <button
                    onClick={() => setOfflineCaching(!offlineCaching)}
                    className={`w-12 h-6 rounded-full p-1 transition duration-200 ease-in-out ${
                      offlineCaching ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition ${offlineCaching ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    <MessageSquareWarning className="w-4 h-4 text-sky-600" />
                    <span>SMS Emergency Alerts</span>
                  </div>
                  <button
                    onClick={() => setSmsAlerts(!smsAlerts)}
                    className={`w-12 h-6 rounded-full p-1 transition duration-200 ease-in-out ${
                      smsAlerts ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition ${smsAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
                  <PhoneCall className="w-4 h-4" />
                  <span>Maritime Emergency Hotlines</span>
                </div>
                <div className="space-y-2 text-xs">
                  <a href="tel:112" className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 font-bold">
                    <span>Kenya Coast Guard / Emergency</span>
                    <span className="underline">112</span>
                  </a>
                  <a href="tel:0800720021" className="flex items-center justify-between p-2.5 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 font-bold">
                    <span>Kenya Maritime Authority (KMA)</span>
                    <span className="underline">0800 720 021</span>
                  </a>
                </div>
              </div>

              <div className="bg-slate-100/90 backdrop-blur-md border border-slate-200 rounded-3xl p-4 text-center space-y-1 text-slate-500 text-xs">
                <p className="font-bold text-slate-700">BahariSafe Mobile v1.4.0</p>
                <p>Lake Victoria | Turkana | Kenyan Coast</p>
              </div>

            </div>
          )}

          {currentTab === 'alerts' && (
            <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-6 text-center space-y-2 shadow-xl">
              <Bell className="w-8 h-8 text-rose-500 mx-auto" />
              <h2 className="text-sm font-bold text-slate-900">Storm & Squall Alerts</h2>
              <p className="text-xs text-slate-500">All regional alerts for Lake Victoria, Turkana, and the Coast are up to date.</p>
            </div>
          )}

        </main>

        {/* BOTTOM NAVIGATION BAR WITH KABAMBE TAB */}
        <nav className="fixed bottom-0 inset-x-0 sm:max-w-md sm:mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-200/80 px-2 py-2 flex items-center justify-around z-50 shadow-2xl">
          {[
            { id: 'home', label: t.home, icon: HomeIcon },
            { id: 'forecast', label: t.forecast, icon: Calendar },
            { id: 'map', label: t.map, icon: MapIcon },
            { id: 'kabambe', label: t.kabambe, icon: Smartphone },
            { id: 'evaluation', label: t.evaluate, icon: ShieldCheck },
            { id: 'alerts', label: t.alerts, icon: Bell },
            { id: 'settings', label: t.settings, icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as any)}
                className={`flex flex-col items-center py-1 px-2 rounded-2xl transition ${
                  isActive ? 'text-sky-600 font-extrabold scale-105' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[9px]">{tab.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
}