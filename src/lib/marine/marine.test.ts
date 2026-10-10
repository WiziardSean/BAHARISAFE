import { describe, it, expect } from 'vitest';
import { isOceanLocation } from './marineClient';
import { getWorstWaveHeight } from './marineBridge';

describe('Issue #3: Marine API & Wave Processing', () => {
  it('correctly identifies ocean locations vs inland lakes', () => {
    // Mombasa (Ocean)
    expect(isOceanLocation(-4.0435, 39.6682)).toBe(true);
    // Kisumu / Lake Victoria (Inland)
    expect(isOceanLocation(-0.1022, 34.7617)).toBe(false);
  });

  it('extracts the maximum wave height correctly from hourly arrays', () => {
    const mockResponse = {
      latitude: -4.04,
      longitude: 39.67,
      hourly: {
        time: ['00:00', '01:00', '02:00'],
        wave_height: [0.8, 1.6, 1.2],
      },
    };

    const maxWave = getWorstWaveHeight(mockResponse, 3);
    expect(maxWave).toBe(1.6);
  });
});