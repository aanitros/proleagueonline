import { matchEngine } from '../apps/api/src/matchEngine.js';

describe('Deterministic Match Engine', () => {
  const fixtureId = 'fixture-1';
  const universeSeed = '0x1F4A9B8C7D6E5F00';
  const fixtureSeed = '0x3E2D1C0B9A8F7E6D';

  it('should produce identical outputs for the same seed', () => {
    const result1 = matchEngine.simulateMatch(fixtureId, universeSeed, fixtureSeed);
    const result2 = matchEngine.simulateMatch(fixtureId, universeSeed, fixtureSeed);

    expect(result1).toEqual(result2);
  });

  it('should produce different outputs for different seeds', () => {
    const result1 = matchEngine.simulateMatch(fixtureId, universeSeed, fixtureSeed);
    const result2 = matchEngine.simulateMatch(fixtureId, universeSeed, '0x4F5E6D7C8B9A0F1E');

    expect(result1).not.toEqual(result2);
  });
});
