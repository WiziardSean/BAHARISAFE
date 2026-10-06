import { describe, it, expect } from 'vitest';
import { evaluateRisk } from './riskEngine';

describe('Risk Assessment Engine', () => {
  it('returns SAFE for calm sea conditions', () => {
    const result = evaluateRisk({
      windSpeedKnots: 5,
      waveHeightMeters: 0.5,
      visibilityKm: 10,
    });
    expect(result.level).toBe('SAFE');
    expect(result.canGoFishing).toBe(true);
    expect(result.warnings.length).toBe(0);
  });

  it('returns CAUTION for moderate winds', () => {
    const result = evaluateRisk({
      windSpeedKnots: 16,
      waveHeightMeters: 0.6,
      visibilityKm: 8,
    });
    expect(result.level).toBe('CAUTION');
    expect(result.canGoFishing).toBe(true);
  });

  it('returns EXTREME and blocks fishing during high winds and large waves', () => {
    const result = evaluateRisk({
      windSpeedKnots: 28,
      waveHeightMeters: 3.0,
      visibilityKm: 1.5,
    });
    expect(result.level).toBe('EXTREME');
    expect(result.canGoFishing).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});