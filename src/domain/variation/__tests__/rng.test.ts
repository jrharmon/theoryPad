import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from '../rng';

/**
 * A vendored mulberry32. Its statistics are not ours to test — what we depend
 * on is that the same seed replays exactly, and that the helpers built on it
 * behave at their edges.
 */
describe('mulberry32', () => {
  it('replays a seed exactly, and a different seed differently', () => {
    const first = mulberry32(1234);
    const second = mulberry32(1234);
    const runA = Array.from({ length: 50 }, () => first.next());
    const runB = Array.from({ length: 50 }, () => second.next());
    expect(runA).toEqual(runB);
    expect(Array.from({ length: 20 }, () => mulberry32(1).next())).not.toEqual(
      Array.from({ length: 20 }, () => mulberry32(2).next()),
    );
    // Every fresh instance restarts from the seed.
    expect(new Set(Array.from({ length: 20 }, () => mulberry32(1234).next())).size).toBe(1);
  });

  it('picks integers inside the bound, and refuses a bound that is not one', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.int(5);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
    expect(() => rng.int(0)).toThrow();
    expect(() => rng.int(-1)).toThrow();
    expect(() => rng.int(1.5)).toThrow();
  });

  it('picks from a list, and refuses an empty one', () => {
    const rng = mulberry32(11);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i += 1) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow();
  });

  it('leans on the weights, never picks a zero against a non-zero, and evens out at all-zero', () => {
    const rng = mulberry32(5);
    const counts = { heavy: 0, light: 0 };
    for (let i = 0; i < 4000; i += 1) {
      const value = rng.weighted([
        { value: 'heavy', weight: 9 },
        { value: 'light', weight: 1 },
      ]);
      counts[value as 'heavy' | 'light'] += 1;
    }
    expect(counts.heavy / counts.light).toBeGreaterThan(6);

    for (let i = 0; i < 200; i += 1) {
      expect(
        rng.weighted([
          { value: 'never', weight: 0 },
          { value: 'always', weight: 1 },
        ]),
      ).toBe('always');
    }

    // Nothing weighted is not the same as nothing possible.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(
        rng.weighted([
          { value: 'a', weight: 0 },
          { value: 'b', weight: 0 },
        ]),
      );
    }
    expect(seen.size).toBe(2);
  });

  it('shuffles without losing or duplicating anything, leaving the input alone', () => {
    const rng = mulberry32(42);
    const items = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = rng.shuffle(items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    expect(items[0]).toBe(0);
  });
});

describe('hashSeed', () => {
  it('is stable per part, and differs when any part does', () => {
    const base = hashSeed('session-1', 'ex-1', 0);
    expect(hashSeed('session-1', 'ex-1', 0)).toBe(base);
    expect(hashSeed('session-2', 'ex-1', 0)).not.toBe(base);
    expect(hashSeed('session-1', 'ex-2', 0)).not.toBe(base);
    expect(hashSeed('session-1', 'ex-1', 1)).not.toBe(base);
    // Without a separator, ("ab","c") and ("a","bc") would hash the same.
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
  });

  it('gives a usable 32-bit seed, unrelated for consecutive rep indices', () => {
    for (const parts of [['a'], ['session', 1], ['x', 'y', 'z']]) {
      const seed = hashSeed(...(parts as string[]));
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
    const seeds = Array.from({ length: 100 }, (_, i) => hashSeed('s', 'e', i));
    expect(new Set(seeds).size).toBe(100);
  });
});
