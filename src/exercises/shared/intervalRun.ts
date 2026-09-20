import type { Direction, IntervalPairing, IntervalPattern } from '@/domain/variation';

/**
 * The figures of an interval pattern through a shape, ascending: 3rds are
 * 1-3, 2-4, 3-5…; alternating turns every other one round, 1-3, 4-2, 3-5.
 *
 * `positions` is the shape in ascending order. Figures stop where the top
 * note would leave the shape rather than wrapping — a wrapped 6th lands on
 * a note the hand is not holding, which is a different exercise.
 */
export function intervalFigures<T>(
  positions: readonly T[],
  pattern: IntervalPattern,
  pairing: IntervalPairing,
): T[][] {
  const reach = Math.max(...pattern.figure);
  const figures: T[][] = [];
  for (let i = 0; i + reach < positions.length; i += 1) {
    const figure = pattern.figure.map((offset) => positions[i + offset]!);
    figures.push(pairing === 'alternating' && i % 2 === 1 ? figure.reverse() : figure);
  }
  return figures;
}

/**
 * A scale through a shape as an interval sequence, in the given direction.
 *
 * Descending builds its figures from the top of the shape — 8-6, 7-5, 6-4,
 * or alternating 8-6, 5-7, 6-4 — so a descent always opens on a descending
 * figure. Like `applyDirection`, a turn plays the figure it turns on twice:
 * the ascent ends 6-8 and the descent answers it 8-6.
 */
export function intervalRun<T>(options: {
  positions: readonly T[];
  pattern: IntervalPattern;
  pairing: IntervalPairing;
  direction: Direction;
}): T[] {
  const { positions, pattern, pairing, direction } = options;
  const up = intervalFigures(positions, pattern, pairing);
  const down = intervalFigures([...positions].reverse(), pattern, pairing);

  switch (direction) {
    case 'ascending':
      return up.flat();
    case 'descending':
      return down.flat();
    case 'up-down':
      return [...up, ...down].flat();
    case 'down-up':
      return [...down, ...up].flat();
  }
}
