// Mulberry32 deterministic PRNG — pure, seed-based.
// State stored as (rng_seed, rng_counter) in GameState for replay determinism.

export function mulberry32(seed: number): number {
  let s = (seed | 0) + 0x6D2B79F5;
  s = Math.imul(s ^ (s >>> 15), 1 | s);
  s = s + Math.imul(s ^ (s >>> 7), 61 | s) ^ s;
  return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
}

// Returns [float in [0,1), newCounter]
export function drawRng(seed: number, counter: number): [number, number] {
  return [mulberry32(seed ^ (counter * 0x9e3779b9)), counter + 1];
}

// Fisher-Yates shuffle; returns [shuffled, newCounter]
export function shuffleArray<T>(arr: readonly T[], seed: number, counter: number): [T[], number] {
  const out = [...arr];
  let c = counter;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, nc] = drawRng(seed, c);
    c = nc;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return [out, c];
}
