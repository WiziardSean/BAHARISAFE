export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  metrics: {
    windSpeedKnots: number;
    waveHeightMeters: number;
    visibilityKm: number;
    isSquallWarning?: boolean;
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'calm-morning',
    title: '🟢 Calm Morning (Safe)',
    description: 'Ideal fishing conditions with gentle winds and calm waters.',
    metrics: {
      windSpeedKnots: 6,
      waveHeightMeters: 0.4,
      visibilityKm: 12,
      isSquallWarning: false,
    },
  },
  {
    id: 'moderate-winds',
    title: '🟡 Moderate Chop (Caution)',
    description: 'Moderate winds creating rough surface conditions. Proceed with caution.',
    metrics: {
      windSpeedKnots: 18,
      waveHeightMeters: 1.0,
      visibilityKm: 7,
      isSquallWarning: false,
    },
  },
  {
    id: 'gale-warning',
    title: '🔴 Gale Force Storm (High Risk)',
    description: 'Dangerous gale-force winds and large swells. Unsafe for small crafts.',
    metrics: {
      windSpeedKnots: 28,
      waveHeightMeters: 2.8,
      visibilityKm: 3,
      isSquallWarning: true,
    },
  },
];