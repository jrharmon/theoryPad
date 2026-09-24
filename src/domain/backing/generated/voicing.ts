import type { Midi, PitchClass } from '../../music';
import { chroma, midi } from '../../music';

/** The piano's range: C3 to C5. */
const PIANO_LOW = 48;
const PIANO_HIGH = 72;
/** With nothing to lead from, the voicing sits nearest middle C. */
const PIANO_HOME = 60;
/** E1, the bass's open low string. */
const BASS_LOW = 28;

/**
 * A piano voicing in close position between C3 and C5, the nearest to the
 * previous chord: the least total movement, voice by voice, plus how far the
 * chord's middle sits from middle C. That pull keeps a looping progression
 * from creeping to one end of the range; the first chord sits nearest middle C.
 */
export function voiceChord(
  chordTones: readonly PitchClass[],
  previous: readonly Midi[] | null,
): Midi[] {
  let best: number[] = [];
  let bestScore = [Infinity, Infinity, Infinity];
  const chromas = chordTones.map((pc) => chroma(pc));

  chromas.forEach((_, r) => {
    const order = [...chromas.slice(r), ...chromas.slice(0, r)];
    for (let bottom = PIANO_LOW; bottom <= PIANO_HIGH; bottom += 1) {
      if (bottom % 12 !== order[0]) continue;
      const voicing = [bottom];
      for (const c of order.slice(1)) {
        const below = voicing.at(-1)!;
        voicing.push(below + ((((c - below) % 12) + 12) % 12 || 12));
      }
      if (voicing.at(-1)! > PIANO_HIGH) continue;
      const mean = voicing.reduce((a, b) => a + b, 0) / voicing.length;
      const fromHome = Math.abs(mean - PIANO_HOME);
      const score = [movement(voicing, previous) + fromHome, fromHome, mean];
      if (lessThan(score, bestScore)) {
        best = voicing;
        bestScore = score;
      }
    }
  });
  return best.map((m) => midi(m));
}

/** The bass's root: E1 up to D♯2, as the drone chooses its own. */
export function bassRoot(root: PitchClass): number {
  return BASS_LOW + ((chroma(root) - (BASS_LOW % 12) + 12) % 12);
}

function movement(voicing: readonly number[], previous: readonly Midi[] | null): number {
  if (!previous || previous.length === 0) return 0;
  if (previous.length === voicing.length) {
    return voicing.reduce((sum, m, i) => sum + Math.abs(m - previous[i]!), 0);
  }
  return voicing.reduce((sum, m) => sum + Math.min(...previous.map((p) => Math.abs(m - p))), 0);
}

function lessThan(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  }
  return false;
}
