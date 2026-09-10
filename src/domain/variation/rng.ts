/**
 * Seeded randomness.
 *
 * Every roll in the app comes from one of these, never Math.random(). That
 * buys three things: variations are reproducible from a stored seed, tests are
 * deterministic, and a rep can be replayed exactly as it was played.
 * ESLint bans Math.random() inside src/domain.
 */

export interface Weighted<T> {
  value: T;
  weight: number;
}

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly Weighted<T>[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/**
 * mulberry32 — small, fast, and good enough for choosing musical parameters.
 * Not cryptographic, and does not need to be.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,

    int(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`int() needs a positive integer bound, got ${maxExclusive}`);
      }
      return Math.floor(next() * maxExclusive);
    },

    pick(items) {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      return items[rng.int(items.length)]!;
    },

    weighted(items) {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
      if (total <= 0) return rng.pick(items.map((i) => i.value));

      let target = next() * total;
      for (const item of items) {
        target -= Math.max(0, item.weight);
        if (target < 0) return item.value;
      }
      return items[items.length - 1]!.value;
    },

    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = rng.int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };

  return rng;
}

/**
 * A stable 32-bit seed from any parts. Used to derive a rep's seed from
 * (sessionId, exerciseId, repIndex), so the same rep always rolls the same
 * variation without storing anything extra.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    // Separator, so ("ab","c") and ("a","bc") differ.
    hash ^= 0x1f;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
