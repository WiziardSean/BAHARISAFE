import { useState } from 'react';
import { evaluateRisk, type WeatherMetrics } from './lib/riskEngine';
import { AlertTriangle, CheckCircle, Flame, ShieldAlert } from 'lucide-react';

export default function App() {
  const [metrics, setMetrics] = useState<WeatherMetrics>({
    windSpeedKnots: 12,
    waveHeightMeters: 1.2,
    visibilityKm: 8,
    isSquallWarning: false,
  });

  const assessment = evaluateRisk(metrics);

  const getBadgeColor = () => {
    switch (assessment.level) {
      case 'SAFE': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'CAUTION': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DANGER': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'EXTREME': return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-cyan-400">BahariSafe</h1>
          <p className="text-slate-400 mt-1">Marine Weather & Risk Assessment Engine</p>
        </div>

        {/* Risk Assessment Card */}
        <div className={`p-6 rounded-2xl border ${getBadgeColor()} space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {assessment.level === 'SAFE' && <CheckCircle className="w-8 h-8 text-emerald-400" />}
              {assessment.level === 'CAUTION' && <AlertTriangle className="w-8 h-8 text-amber-400" />}
              {assessment.level === 'DANGER' && <Flame className="w-8 h-8 text-orange-400" />}
              {assessment.level === 'EXTREME' && <ShieldAlert className="w-8 h-8 text-red-400" />}
              <div>
                <h2 className="text-2xl font-bold">{assessment.level}</h2>
                <p className="text-sm opacity-90">
                  {assessment.canGoFishing ? 'Safe to navigate with standard precautions' : 'Unsafe conditions — stay on shore'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold">{assessment.score}</span>
              <span className="text-xs block opacity-75">/ 100 Risk Index</span>
            </div>
          </div>

          {/* Warnings */}
          {assessment.warnings.length > 0 && (
            <div className="pt-3 border-t border-slate-700/50 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Active Advisories:</span>
              <ul className="list-disc list-inside text-sm space-y-1">
                {assessment.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Input Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-slate-200">Adjust Weather Parameters</h3>

          {/* Wind Speed */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <label>Wind Speed</label>
              <span className="font-mono text-cyan-400">{metrics.windSpeedKnots} knots</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={metrics.windSpeedKnots}
              onChange={(e) => setMetrics({ ...metrics, windSpeedKnots: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Wave Height */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <label>Wave Height</label>
              <span className="font-mono text-cyan-400">{metrics.waveHeightMeters} meters</span>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={metrics.waveHeightMeters}
              onChange={(e) => setMetrics({ ...metrics, waveHeightMeters: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Visibility */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <label>Visibility</label>
              <span className="font-mono text-cyan-400">{metrics.visibilityKm} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15"
              step="0.5"
              value={metrics.visibilityKm}
              onChange={(e) => setMetrics({ ...metrics, visibilityKm: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Squall Checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="squall"
              checked={metrics.isSquallWarning || false}
              onChange={(e) => setMetrics({ ...metrics, isSquallWarning: e.target.checked })}
              className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
            />
            <label htmlFor="squall" className="text-sm text-slate-300 cursor-pointer">
              Squall / Active Storm Warning
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}