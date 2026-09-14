/**
 * Tapping along to set a track's bar 1 and bpm.
 *
 * Taps are in video seconds, so the answer is the recording's own tempo
 * whatever speed it was playing at. A straight line through the taps beats
 * averaging the gaps: one early tap moves the fit a little, not the tempo a lot,
 * and the line's start is a better bar 1 than the first tap alone.
 */

export const MIN_TAPS = 4;

export interface TapResult {
  bpm: number;
  /** Where the first tap's beat falls, by the fit. */
  bar1Sec: number;
}

/**
 * The tempo and bar 1 a run of taps describes, or null when there are too few,
 * or they are too uneven to mean a steady beat (a gap more than 40% off the
 * middle one — a missed or doubled tap).
 */
export function tapTempo(taps: readonly number[]): TapResult | null {
  if (taps.length < MIN_TAPS) return null;
  const gaps = taps.slice(1).map((t, i) => t - (taps[i] ?? t));
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (median <= 0 || gaps.some((gap) => Math.abs(gap - median) > median * 0.4)) return null;

  // Least squares: tap i sits at bar1 + i × beat.
  const n = taps.length;
  const meanI = (n - 1) / 2;
  const meanT = taps.reduce((sum, t) => sum + t, 0) / n;
  let num = 0;
  let den = 0;
  taps.forEach((t, i) => {
    num += (i - meanI) * (t - meanT);
    den += (i - meanI) ** 2;
  });
  const beat = num / den;
  return {
    bpm: Math.round((600 / beat)) / 10,
    bar1Sec: Math.round((meanT - beat * meanI) * 100) / 100,
  };
}
