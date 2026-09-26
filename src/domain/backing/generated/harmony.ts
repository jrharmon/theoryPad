import type { DegreeNumber, DiatonicChord, KeyMode } from '../../music';
import { chordTones, diatonicChords, harmonyOf, romanNumeral } from '../../music';

/** Blues' dominant degrees: the I7, IV7 and V7 of a 12-bar (decision 22). */
const BLUES_DOMINANTS: readonly number[] = [1, 4, 5];

/** The chord made a dominant 7th on its own root: A7 where Aeolian has Am7. */
function asDominant(chord: DiatonicChord): DiatonicChord {
  const { root } = chord;
  return {
    ...chord,
    triad: 'maj',
    seventh: 'dom7',
    triadSymbol: root,
    seventhSymbol: `${root}7`,
    ninthSymbol: `${root}9`,
    notes: { triad: chordTones(root, 'maj'), seventh: chordTones(root, 'dom7') },
  };
}

/** A minor-major 7th or a maj7♯5 played as its triad: Am, not AmMaj7 (decision 24). */
function asTriad(chord: DiatonicChord): DiatonicChord {
  return {
    ...chord,
    seventhSymbol: chord.triadSymbol,
    ninthSymbol: null,
    notes: { ...chord.notes, seventh: chord.notes.triad },
  };
}

/**
 * The seven chords the generated backing plays on a key's degrees: the
 * scale's harmony (its own chords, or its parent mode's for a pentatonic),
 * with blues' 1, 4 and 5 made dominant 7ths — A7, D7, E7 in A — and the
 * minor-major 7th and maj7♯5 of harmonic and melodic minor played as triads.
 *
 * Only the backing plays these. Theory and the reference's chord table name
 * the scale's harmony as it is.
 */
export function backingChords(keyMode: KeyMode): DiatonicChord[] {
  return diatonicChords(harmonyOf(keyMode)).map((chord) => {
    if (keyMode.scale === 'blues' && BLUES_DOMINANTS.includes(chord.degree.number)) {
      return asDominant(chord);
    }
    if (chord.seventh === 'minMaj7' || chord.seventh === 'maj7sharp5') return asTriad(chord);
    return chord;
  });
}

/** The chord the backing plays on one degree of the key. */
export function backingChord(keyMode: KeyMode, degree: DegreeNumber): DiatonicChord {
  return backingChords(keyMode)[degree - 1]!;
}

/**
 * A go-to progression's chord as the reference names it: the triad — "IV",
 * "D" — except where the backing makes it a dominant 7th that the scale's
 * harmony doesn't have, which is the point of it: "IV7", "D7" in a blues.
 */
export function progressionChordName(
  keyMode: KeyMode,
  degree: DegreeNumber,
): { numeral: string; symbol: string } {
  const chord = backingChord(keyMode, degree);
  const madeDominant =
    chord.seventh === 'dom7' &&
    diatonicChords(harmonyOf(keyMode))[degree - 1]!.seventh !== 'dom7';
  return madeDominant
    ? { numeral: `${romanNumeral(chord)}7`, symbol: chord.seventhSymbol }
    : { numeral: romanNumeral(chord), symbol: chord.triadSymbol };
}
