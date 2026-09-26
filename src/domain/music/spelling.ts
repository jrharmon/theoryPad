import type { Chroma, KeyMode, ModeName, PitchClass } from './types';
import { MODE_NAMES } from './types';
import { accidentalCount, chroma, hasDoubleAccidental, pitchClass, transposeBy } from './pitch';
import { SCALES, scaleIntervals } from './scales';

/**
 * Choosing how to spell a tonic.
 *
 * tonal spells scales correctly — each letter used exactly once — but for
 * remote tonic/mode pairs that correctness produces double accidentals:
 *
 *   Db phrygian  ->  Db Ebb Fb Gb Ab Bbb Cb
 *
 * Musically that pitch set is written C# phrygian (C# D E F# G# A B). Same
 * notes, no double accidentals, readable. Since the app rolls a *pitch* and a
 * mode, not a spelling, picking the spelling is our job.
 *
 * Rules, in order:
 *   1. Reject any spelling whose scale contains a double accidental.
 *   2. Fewest accidentals across the scale.
 *   3. Earliest in SPELLING_PREFERENCE — convention, for exact ties.
 *
 * Scales other than Major borrow a related mode's spelling (`spelledAs`):
 * "E♭ minor pentatonic" to match E♭ Aeolian, C♯ melodic minor to match C♯
 * Aeolian. Where that spelling would break rule 1 the scale spells itself —
 * harmonic and melodic minor on G♯ need an F𝄪, so they are A♭.
 *
 * Rule 3 is not derivable and is deliberately a table. Ties are real: F# major
 * and Gb major both need six accidentals, as do Eb and D# aeolian. Which one
 * gets written is a matter of what players actually read, and for guitar that
 * is F#, Eb, Bb, Ab, Db — so the table encodes those, not a blanket
 * "prefer flats" (which would produce Gb major).
 */

/**
 * Candidate tonic spellings, grouped by pitch and ordered within each pitch by
 * what a guitarist would expect to read.
 */
const SPELLING_PREFERENCE = [
  'C',
  'B#',
  'Db',
  'C#',
  'D',
  'Eb',
  'D#',
  'E',
  'Fb',
  'F',
  'E#',
  'F#',
  'Gb',
  'G',
  'Ab',
  'G#',
  'A',
  'Bb',
  'A#',
  'B',
  'Cb',
].map((s) => pitchClass(s));

/**
 * What a tonic is spelled for: a mode of the Major scale by name, or any
 * scale and mode.
 */
export type Spelling = ModeName | Pick<KeyMode, 'scale' | 'mode'>;

function accidentalTotal(tonic: PitchClass, intervals: readonly string[]): number | null {
  let total = 0;
  for (const interval of intervals) {
    const pc = transposeBy(tonic, interval);
    if (hasDoubleAccidental(pc)) return null;
    total += accidentalCount(pc);
  }
  return total;
}

function bestTonic(target: Chroma, intervals: readonly string[]): PitchClass | null {
  let best: { tonic: PitchClass; total: number } | null = null;
  // SPELLING_PREFERENCE is in preference order, so an equal total never wins.
  for (const candidate of SPELLING_PREFERENCE) {
    if (chroma(candidate) !== target) continue;
    const total = accidentalTotal(candidate, intervals);
    if (total === null) continue;
    if (best === null || total < best.total) best = { tonic: candidate, total };
  }
  return best?.tonic ?? null;
}

export function preferredTonic(target: Chroma, spelling: Spelling): PitchClass {
  const sm =
    typeof spelling === 'string' ? { scale: 'major' as const, mode: spelling } : spelling;
  const own = scaleIntervals(sm);
  const borrowed = SCALES[sm.scale].spelledAs;

  // Borrow the related Major mode's spelling while this scale reads cleanly in
  // it; otherwise spell the scale on its own terms.
  const conventional =
    borrowed === null
      ? null
      : bestTonic(target, scaleIntervals({ scale: 'major', mode: borrowed }));
  // A pentatonic scale always takes its parent's tonic: blues reads E♭ like E♭
  // minor pentatonic, even though its ♭5 is then written enharmonically.
  const keepsParent = sm.scale !== 'major' && SCALES[sm.scale].parent !== null;
  const tonic =
    conventional !== null && (keepsParent || accidentalTotal(conventional, own) !== null)
      ? conventional
      : bestTonic(target, own);

  if (tonic === null) {
    throw new Error(`No clean spelling for chroma ${target} in ${sm.scale} ${sm.mode}`);
  }
  return tonic;
}

/**
 * Respell a key so it reads conventionally, leaving the pitches untouched.
 * Call this wherever a tonic arrives from outside (a rolled variation, stored
 * data, a URL) before showing or deriving anything from it.
 */
export function canonicalKeyMode(km: KeyMode): KeyMode {
  return { tonic: preferredTonic(chroma(km.tonic), km), scale: km.scale, mode: km.mode };
}

/**
 * The twelve tonics to offer for a mode or scale, in chromatic order — the
 * candidate set the `key` variation axis rolls from.
 */
export function tonicsForMode(spelling: Spelling): PitchClass[] {
  return Array.from({ length: 12 }, (_, i) => preferredTonic(i as Chroma, spelling));
}

/** Every mode name, in the order they appear as rotations of the major scale. */
export function allModes(): readonly ModeName[] {
  return MODE_NAMES;
}
