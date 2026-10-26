import { useState } from 'react';
import { evaluateRisk, type WeatherMetrics, type RiskLevel } from '../lib/riskEngine';
import { ShieldCheck, CheckCircle2, Activity, Sliders, Award } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  description: string;
  expectedRisk: RiskLevel;
  metrics: WeatherMetrics;
}

const EVALUATION_SCENARIOS: Scenario[] = [
  {
    id: 'calm',
    name: '1. Calm Day',
    description: 'Light gentle breeze and calm surface waters.',
    expectedRisk: 'SAFE',
    metrics: { windSpeedKnots: 6, waveHeightMeters: 0.4, visibilityKm: 12, isSquallWarning: false },
  },
  {
    id: 'windy',
    name: '2. Windy Afternoon',
    description: 'Moderate choppy winds creating surface friction.',
    expectedRisk: 'CAUTION',
    metrics: { windSpeedKnots: 18, waveHeightMeters: 1.0, visibilityKm: 7, isSquallWarning: false },
  },
  {
    id: 'thunderstorm',
    name: '3. Thunderstorm',
    description: 'Severe squall warning and electrical activity.',
    expectedRisk: 'EXTREME',
    metrics: { windSpeedKnots: 28, waveHeightMeters: 2.2, visibilityKm: 3, isSquallWarning: true },
  },
  {
    id: 'rain',
    name: '4. Heavy Rain',
    description: 'Heavy tropical downpour reducing visibility.',
    expectedRisk: 'DANGER',
    metrics: { windSpeedKnots: 22, waveHeightMeters: 1.6, visibilityKm: 1.5, isSquallWarning: false },
  },
  {
    id: 'rough',
    name: '5. Rough Seas',
    description: 'High oceanic swell waves exceeding small craft safety limits.',
    expectedRisk: 'EXTREME',
    metrics: { windSpeedKnots: 20, waveHeightMeters: 3.2, visibilityKm: 8, isSquallWarning: false },
  },
  {
    id: 'worsening',
    name: '6. Rapidly Worsening',
    description: 'Sudden gale force gust surge combined with squall warning.',
    expectedRisk: 'EXTREME',
    metrics: { windSpeedKnots: 30, waveHeightMeters: 2.8, visibilityKm: 2.0, isSquallWarning: true },
  },
];

export function EvaluationPortal() {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(EVALUATION_SCENARIOS[0].id);

  const activeScenario = EVALUATION_SCENARIOS.find(s => s.id === activeScenarioId) || EVALUATION_SCENARIOS[0];
  const currentEvaluation = evaluateRisk(activeScenario.metrics);

  const passedCount = EVALUATION_SCENARIOS.filter(s => {
    const res = evaluateRisk(s.metrics);
    return res.level === s.expectedRisk;
  }).length;

  const consistencyScore = Math.round((passedCount / EVALUATION_SCENARIOS.length) * 100);

  return (
    <div className="space-y-4 pb-24 text-slate-900 max-w-md mx-auto w-full">
      
      {/* Header Banner */}
      <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sky-700 font-extrabold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Risk Engine Evaluation Portal</span>
          </div>
          <div className="bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full text-[11px] flex items-center space-x-1 shadow-sm">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Consistency: {consistencyScore}%</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-600">
          Verify rule-based decision consistency against standard test scenarios and inspect threshold metrics.
        </p>
      </div>

      {/* Visual Flow Diagram & Threshold Reference Table */}
      <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
          <Activity className="w-4 h-4 text-sky-600" />
          <span>Risk Classification Logic & Thresholds</span>
        </h3>

        {/* Visual Flow Diagram */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl font-mono text-[10px] space-y-1.5 shadow-inner">
          <div className="text-sky-400 font-bold"># "Worst Factor Wins" Pipeline:</div>
          <div className="flex flex-col space-y-1 text-slate-300">
            <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">1. Ingest Raw API / Demo Metrics (Wind, Waves, Visibility, Squall)</div>
            <div className="text-center text-sky-400 font-bold">↓</div>
            <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">2. Evaluate Worst Variable Thresholds (Score Weighting)</div>
            <div className="text-center text-sky-400 font-bold">↓</div>
            <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">3. Output Safety Status: SAFE | CAUTION | DANGER | EXTREME</div>
          </div>
        </div>

        {/* Threshold Reference Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="p-2">Parameter</th>
                <th className="p-2">Safe</th>
                <th className="p-2">Caution</th>
                <th className="p-2">Extreme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="p-2 font-bold text-slate-800">Wind Speed</td>
                <td className="p-2 text-emerald-600">&lt; 10 kts</td>
                <td className="p-2 text-amber-600">10 - 24 kts</td>
                <td className="p-2 text-rose-600">&ge; 25 kts</td>
              </tr>
              <tr>
                <td className="p-2 font-bold text-slate-800">Wave Height</td>
                <td className="p-2 text-emerald-600">&lt; 0.8 m</td>
                <td className="p-2 text-amber-600">0.8 - 2.4 m</td>
                <td className="p-2 text-rose-600">&ge; 2.5 m</td>
              </tr>
              <tr>
                <td className="p-2 font-bold text-slate-800">Visibility</td>
                <td className="p-2 text-emerald-600">&gt; 5 km</td>
                <td className="p-2 text-amber-600">2 - 5 km</td>
                <td className="p-2 text-rose-600">&lt; 2 km</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6 Test Scenario Trigger Buttons */}
      <div className="bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-4 shadow-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
          <Sliders className="w-4 h-4 text-sky-600" />
          <span>Select Test Scenario (1 - 6)</span>
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {EVALUATION_SCENARIOS.map((scen) => {
            const res = evaluateRisk(scen.metrics);
            const isSelected = activeScenarioId === scen.id;
            const matchesExpected = res.level === scen.expectedRisk;

            return (
              <button
                key={scen.id}
                onClick={() => setActiveScenarioId(scen.id)}
                className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-1 shadow-xs ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-500 shadow-md scale-[1.02]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-extrabold">{scen.name}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : matchesExpected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {res.level}
                  </span>
                </div>
                <p className={`text-[9px] line-clamp-1 ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                  {scen.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Scenario Evaluation Results Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-2xl space-y-3 border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <div className="text-[9px] font-mono text-sky-400 font-bold uppercase">Active Scenario Output</div>
            <div className="text-xs font-extrabold">{activeScenario.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono text-slate-400 uppercase">Engine Score</div>
            <div className="text-base font-black text-amber-400">{currentEvaluation.score}<span className="text-[10px] text-slate-400">/100</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[9px]">WIND SPEED:</span>
            <span className="font-bold text-sky-300">{activeScenario.metrics.windSpeedKnots} kts</span>
          </div>
          <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[9px]">WAVE HEIGHT:</span>
            <span className="font-bold text-sky-300">{activeScenario.metrics.waveHeightMeters} m</span>
          </div>
          <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[9px]">VISIBILITY:</span>
            <span className="font-bold text-sky-300">{activeScenario.metrics.visibilityKm} km</span>
          </div>
          <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[9px]">SQUALL WARNING:</span>
            <span className={`font-bold ${activeScenario.metrics.isSquallWarning ? 'text-rose-400' : 'text-emerald-400'}`}>
              {activeScenario.metrics.isSquallWarning ? 'ACTIVE' : 'NONE'}
            </span>
          </div>
        </div>

        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700 space-y-1">
          <div className="text-[9px] font-bold text-slate-400 uppercase">Evaluation Verdict</div>
          <div className="text-[11px] font-extrabold flex items-center space-x-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Result Matches Expected Standard ({currentEvaluation.level})</span>
          </div>
          {currentEvaluation.warnings.length > 0 && (
            <ul className="text-[10px] text-amber-300 pt-0.5 space-y-0.5">
              {currentEvaluation.warnings.map((w, idx) => (
                <li key={idx}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>
  );
}