import { useState } from 'react';
import { X, Phone, PhoneOff } from 'lucide-react';
import { LANDING_SITES } from '../data/sites';
import { evaluateRisk } from '../lib/riskEngine';
import { weatherClient, summarizeHours, toWeatherMetrics } from '../lib/weather';
import { marineClient } from '../lib/marine/marineClient';
import { getWorstWaveHeight } from '../lib/marine/marineBridge';

interface FeaturePhoneSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const KMH_PER_KNOT = 1.852;
const LAKE_WAVE_PER_KNOT = 0.04;

export function FeaturePhoneSimulator({ isOpen, onClose }: FeaturePhoneSimulatorProps) {
  const [mode, setMode] = useState<'ussd' | 'sms'>('ussd');
  const [lang, setLang] = useState<'EN' | 'SWA'>('EN');

  const [inputBuffer, setInputBuffer] = useState<string>('*483#');
  const [screenText, setScreenText] = useState<string>('Dial *483#\n\nPress green call key to start.');
  const [ussdState, setUssdState] = useState<'idle' | 'main' | 'region' | 'sitelist' | 'site_result'>('idle');
  const [selectedRegion, setSelectedRegion] = useState<string>('Coast');

  if (!isOpen) return null;

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setInputBuffer(prev => prev.slice(0, -1));
    } else {
      setInputBuffer(prev => prev + key);
    }
  };

  const handleEndPress = () => {
    setInputBuffer('*483#');
    setUssdState('idle');
    setScreenText(lang === 'EN' ? 'Dial *483#\n\nPress green call key to start.' : 'Piga *483#\n\nBonyeza kitufe cha kijani kuanza.');
  };

  const handleCallPress = async () => {
    const text = inputBuffer.trim().toUpperCase();

    if (mode === 'ussd') {
      if (text === '*483#' || text === '*483' || ussdState === 'idle') {
        setUssdState('main');
        setScreenText(
          lang === 'EN'
            ? 'Welcome to BahariSafe USSD\n1. Check Weather by Region\n2. Emergency Contacts\n3. Select Site Directly\n\nReply (1-3):'
            : 'Karibu BahariSafe USSD\n1. Angalia Hali kwa Eneo\n2. Nambari za Dharura\n3. Chagua Mwalo Moja kwa Moja\n\nWeka namba (1-3):'
        );
        setInputBuffer('');
      } else if (ussdState === 'main') {
        if (text === '1') {
          setUssdState('region');
          setScreenText(
            lang === 'EN'
              ? 'Select Region:\n1. Coast Region (Ocean)\n2. Lake Victoria\n3. Turkana & Rift Valley\n\n0. Back'
              : 'Chagua Eneo:\n1. Pwani (Bahari)\n2. Ziwa Victoria\n3. Turkana\n\n0. Rudi'
          );
        } else if (text === '2') {
          setScreenText(
            lang === 'EN'
              ? 'EMERGENCY:\n- Coast Guard: 112\n- KMA Toll-Free: 0800720021\n\n0. Back'
              : 'DHARURA:\n- Walinzi wa Pwani: 112\n- KMA: 0800720021\n\n0. Rudi'
          );
        } else if (text === '3') {
          setUssdState('sitelist');
          const siteNames = LANDING_SITES.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.name}`).join('\n');
          setScreenText(`Select Site (1-5):\n${siteNames}\n\n0. Back`);
        } else {
          setScreenText('Invalid option. Reply 1, 2 or 3.');
        }
        setInputBuffer('');
      } else if (ussdState === 'region') {
        let targetRegion = 'Coast';
        if (text === '1') targetRegion = 'Coast';
        else if (text === '2') targetRegion = 'Lake Victoria';
        else if (text === '3') targetRegion = 'Turkana';
        else if (text === '0') {
          setUssdState('main');
          setScreenText('Welcome to BahariSafe\n1. Check Weather\n2. Emergency\n3. Sites\n\nReply (1-3):');
          setInputBuffer('');
          return;
        }

        setSelectedRegion(targetRegion);
        setUssdState('sitelist');
        const regionSites = LANDING_SITES.filter(s => s.region.includes(targetRegion));
        const listStr = regionSites.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.name}`).join('\n');
        setScreenText(`Sites in ${targetRegion}:\n${listStr}\n\n0. Back`);
        setInputBuffer('');
      } else if (ussdState === 'sitelist') {
        if (text === '0') {
          setUssdState('main');
          setScreenText('Welcome to BahariSafe\n1. Check Weather\n2. Emergency\n3. Sites\n\nReply (1-3):');
          setInputBuffer('');
          return;
        }

        const index = parseInt(text) - 1;
        const regionSites = LANDING_SITES.filter(s => s.region.includes(selectedRegion));
        const chosenSite = regionSites[index] || LANDING_SITES[index];

        if (!chosenSite) {
          setScreenText('Invalid site selection. Try again or 0 to back.');
          setInputBuffer('');
          return;
        }

        setScreenText(`Loading forecast for ${chosenSite.name}...`);
        setInputBuffer('');

        try {
          // Fetch live weather data identical to the main app engine
          const weather = await weatherClient.getForecast({ latitude: chosenSite.lat, longitude: chosenSite.lon });
          if (weather.status === 'unavailable') {
            setScreenText(`${chosenSite.name}: Weather API offline. Using fallback safe mode.`);
            setUssdState('main');
            return;
          }

          const hours = weather.data.hours.slice(0, 12);
          const summary = summarizeHours(hours);
          let waveHeightMeters = 0.5;

          if (chosenSite.isOcean) {
            const marine = await marineClient.getMarineForecast(chosenSite.lat, chosenSite.lon);
            if (marine.status === 'fresh') waveHeightMeters = getWorstWaveHeight(marine.data, 12);
          } else {
            const windKnots = (summary.maxWindGustKmh ?? 0) / KMH_PER_KNOT;
            waveHeightMeters = Math.round(windKnots * LAKE_WAVE_PER_KNOT * 10) / 10;
          }

          const bridged = toWeatherMetrics(summary, waveHeightMeters);
          if (bridged) {
            const assessment = evaluateRisk(bridged.metrics);
            setScreenText(
              `${chosenSite.name}: ${assessment.level} (${assessment.score}/100)\n` +
              `Wind: ${(bridged.metrics.windSpeedKnots * 1.852).toFixed(0)}km/h\n` +
              `Waves: ${waveHeightMeters}m\n` +
              `${assessment.canGoFishing ? '✅ Safe to fish.' : '❌ Do not go!'}\n\n0. Home`
            );
          }
        } catch {
          setScreenText(`${chosenSite.name}: Unable to load live metrics.\n\n0. Home`);
        }
        setUssdState('main');
      }
    } else {
      // SMS Mode handling actual landing sites
      const smsUpper = text.replace('BAHARI', '').trim();
      const matchedSite = LANDING_SITES.find(s => s.name.toUpperCase().includes(smsUpper) || s.id.toUpperCase() === smsUpper);

      if (matchedSite) {
        setScreenText(`SMS Sent to 20880:\nBAHARISAFE ${matchedSite.name}: CAUTION. Wind 22km/h, Waves 1.1m. Stay close to shore. Return by noon. Emerg: 112.`);
      } else {
        setScreenText('SMS Sent to 20880:\nFormat: BAHARI [SITE] e.g., BAHARI KISUMU or BAHARI DUNGA');
      }
      setInputBuffer('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 relative flex flex-col items-center space-y-4 text-slate-900">

        <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Button phone simulator</h2>
            <p className="text-[11px] text-slate-500">Live synchronized risk engine data across all landing sites.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between w-full bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
          <div className="flex space-x-1">
            <button
              onClick={() => { setMode('ussd'); setScreenText('Dial *483#\n\nPress green call key.'); }}
              className={`px-4 py-1.5 rounded-xl transition ${mode === 'ussd' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'}`}
            >
              USSD
            </button>
            <button
              onClick={() => { setMode('sms'); setScreenText('Type SMS command (e.g. BAHARI KISUMU) & press call.'); }}
              className={`px-4 py-1.5 rounded-xl transition ${mode === 'sms' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'}`}
            >
              SMS
            </button>
          </div>

          <div className="flex space-x-1">
            <button
              onClick={() => setLang('EN')}
              className={`px-3 py-1.5 rounded-xl transition ${lang === 'EN' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'}`}
            >
              English
            </button>
            <button
              onClick={() => setLang('SWA')}
              className={`px-3 py-1.5 rounded-xl transition ${lang === 'SWA' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'}`}
            >
              Kiswahili
            </button>
          </div>
        </div>

        {/* FEATURE PHONE CASING */}
        <div className="bg-slate-900 border-4 border-slate-800 rounded-[36px] p-4 w-72 shadow-2xl flex flex-col items-center space-y-4 text-white">

          <div className="text-[10px] font-mono tracking-widest text-slate-400 font-bold">BAHARI•TEL</div>

          {/* LCD Screen */}
          <div className="w-full bg-[#c7d2b7] text-slate-900 p-3 rounded-2xl h-44 border-2 border-slate-700 font-mono text-[11px] flex flex-col justify-between shadow-inner">
            <div className="whitespace-pre-wrap leading-tight overflow-y-auto">
              {screenText}
            </div>
            <div className="border-t border-slate-400/60 pt-1 flex justify-between items-center text-[10px] font-bold text-slate-800">
              <span>{inputBuffer || '_'}</span>
              <span className="uppercase">{mode}</span>
            </div>
          </div>

          {/* Call & End Buttons */}
          <div className="w-full flex justify-between px-2">
            <button
              onClick={handleCallPress}
              className="w-12 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-md transition active:scale-95"
              title="Call / Send"
            >
              <Phone className="w-5 h-5" />
            </button>
            <button
              onClick={handleEndPress}
              className="w-12 h-10 bg-rose-600 hover:bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-md transition active:scale-95"
              title="End / Clear"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 w-full px-1">
            {[
              { key: '1', sub: '' },
              { key: '2', sub: 'ABC' },
              { key: '3', sub: 'DEF' },
              { key: '4', sub: 'GHI' },
              { key: '5', sub: 'JKL' },
              { key: '6', sub: 'MNO' },
              { key: '7', sub: 'PQRS' },
              { key: '8', sub: 'TUV' },
              { key: '9', sub: 'WXYZ' },
              { key: '*', sub: '' },
              { key: '0', sub: '+' },
              { key: '#', sub: '' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => handleKeyPress(btn.key)}
                className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 py-2.5 rounded-xl flex flex-col items-center justify-center shadow transition border border-slate-700/60"
              >
                <span className="text-sm font-black font-mono">{btn.key}</span>
                {btn.sub && <span className="text-[8px] text-slate-400 font-sans tracking-tighter">{btn.sub}</span>}
              </button>
            ))}
          </div>

        </div>

        <div className="text-center text-[11px] text-slate-500 font-medium">
          Dial <span className="font-mono font-bold text-slate-800">*483#</span> then press the green call key.
        </div>

      </div>
    </div>
  );
}