import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from '../rng';

describe('mulberry32', () => {
  it('gives the same sequence for the same seed', () => {
    const a = Array.from({ length: 20 }, () => mulberry32(1234).next());
    // Every fresh instance restarts, so all twenty are the first value.
    expect(new Set(a).size).toBe(1);

    const first = mulberry32(1234);
    const second = mulberry32(1234);
    const runA = Array.from({ length: 50 }, () => first.next());
    const runB = Array.from({ length: 50 }, () => second.next());
    expect(runA).toEqual(runB);
  });

  it('gives different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, () => mulberry32(1).next());
    const b = Array.from({ length: 20 }, () => mulberry32(2).next());
    expect(a).not.toEqual(b);
  });

  it('stays in [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads roughly evenly', () => {
    const rng = mulberry32(7);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i += 1) buckets[Math.floor(rng.next() * 10)]! += 1;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(1500);
      expect(count).toBeLessThan(2500);
    }
  });

  it('picks integers inside the bound', () => {
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

  it('respects weights', () => {
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
  });

  it('never returns a zero-weight item when others are available', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i += 1) {
      expect(
        rng.weighted([
          { value: 'never', weight: 0 },
          { value: 'always', weight: 1 },
        ]),
      ).toBe('always');
    }
  });

  it('falls back to an even pick when every weight is zero', () => {
    const rng = mulberry32(5);
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

  it('shuffles without losing or duplicating anything', () => {
    const rng = mulberry32(42);
    const items = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = rng.shuffle(items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    // The input is untouched.
    expect(items[0]).toBe(0);
  });
});

describe('hashSeed', () => {
  it('is stable for the same parts', () => {
    expect(hashSeed('session-1', 'ex-1', 0)).toBe(hashSeed('session-1', 'ex-1', 0));
  });

  it('differs when any part differs', () => {
    const base = hashSeed('session-1', 'ex-1', 0);
    expect(hashSeed('session-2', 'ex-1', 0)).not.toBe(base);
    expect(hashSeed('session-1', 'ex-2', 0)).not.toBe(base);
    expect(hashSeed('session-1', 'ex-1', 1)).not.toBe(base);
  });

  it('does not collide when parts are re-split', () => {
    // Without a separator, ("ab","c") and ("a","bc") would hash the same.
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
  });

  it('is a usable 32-bit seed', () => {
    for (const parts of [['a'], ['session', 1], ['x', 'y', 'z']]) {
      const seed = hashSeed(...(parts as string[]));
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });

  it('spreads consecutive rep indices to unrelated seeds', () => {
    const seeds = Array.from({ length: 100 }, (_, i) => hashSeed('s', 'e', i));
    expect(new Set(seeds).size).toBe(100);
  });
});
