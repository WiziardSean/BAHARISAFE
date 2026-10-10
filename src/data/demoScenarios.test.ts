import { describe, it, expect } from 'vitest';
import { DEMO_SCENARIOS } from './demoScenarios';
import { evaluateRisk } from '../lib/riskEngine';

describe('Issue #4: Offline Demo Scenarios', () => {
  it('correctly evaluates the calm morning scenario as SAFE', () => {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === 'calm-morning')!;
    const result = evaluateRisk(scenario.metrics);
    expect(result.level).toBe('SAFE');
    expect(result.canGoFishing).toBe(true);
  });

  it('correctly evaluates the gale warning scenario as DANGER/EXTREME', () => {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === 'gale-warning')!;
    const result = evaluateRisk(scenario.metrics);
    expect(result.canGoFishing).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});