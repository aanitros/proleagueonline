export function pcg32(seed) {
  let state = seed >>> 0;
  let inc = (seed >>> 0) | 1;

  return {
    next: () => {
      const oldstate = state;
      state = oldstate * 6364136223846793005n + (inc | 0);
      const xorshifted = ((oldstate >>> 18n) ^ oldstate) >>> 0;
      const rot = (oldstate >>> 27n) >>> 0;
      return (xorshifted >>> rot) / 4294967296;
    }
  };
}
