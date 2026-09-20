import { Scale } from 'tonal';
import type { Chroma, KeyMode, ModeName, PitchClass } from './types';
import { MODE_NAMES } from './types';
import { accidentalCount, chroma, hasDoubleAccidental, pitchClass } from './pitch';

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

function scaleAccidentalTotal(tonic: PitchClass, mode: ModeName): number | null {
  const notes = Scale.get(`${tonic} ${mode}`).notes;
  if (notes.length !== 7) return null;
  let total = 0;
  for (const raw of notes) {
    const pc = pitchClass(raw);
    if (hasDoubleAccidental(pc)) return null;
    total += accidentalCount(pc);
  }
  return total;
}

export function preferredTonic(target: Chroma, mode: ModeName): PitchClass {
  let best: { tonic: PitchClass; total: number } | null = null;

  // SPELLING_PREFERENCE is in preference order, so an equal total never wins.
  for (const candidate of SPELLING_PREFERENCE) {
    if (chroma(candidate) !== target) continue;
    const total = scaleAccidentalTotal(candidate, mode);
    if (total === null) continue;
    if (best === null || total < best.total) best = { tonic: candidate, total };
  }

  if (best === null) {
    throw new Error(`No clean spelling for chroma ${target} in ${mode}`);
  }
  return best.tonic;
}

/**
 * Respell a key so it reads conventionally, leaving the pitches untouched.
 * Call this wherever a tonic arrives from outside (a rolled variation, stored
 * data, a URL) before showing or deriving anything from it.
 */
export function canonicalKeyMode(km: KeyMode): KeyMode {
  return { tonic: preferredTonic(chroma(km.tonic), km.mode), mode: km.mode };
}

/**
 * The twelve tonics to offer for a mode, in chromatic order — the candidate
 * set the `key` variation axis rolls from.
 */
export function tonicsForMode(mode: ModeName): PitchClass[] {
  return Array.from({ length: 12 }, (_, i) => preferredTonic(i as Chroma, mode));
}

/** Every mode name, in the order they appear as rotations of the major scale. */
export function allModes(): readonly ModeName[] {
  return MODE_NAMES;
}
