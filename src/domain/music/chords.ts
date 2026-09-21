import type {
  ChordFunction,
  DiatonicChord,
  KeyMode,
  PitchClass,
  SeventhQuality,
  TriadQuality,
} from './types';
import { pitchClass, semitonesBetween } from './pitch';
import { scaleDegrees, scaleNotes } from './scale';

/**
 * Chord qualities are derived from the actual semitone intervals of the
 * stacked scale notes, not from tonal's chord-symbol strings. That keeps the
 * symbol formatting ours (tonal writes "FMaj7"; we write "Fmaj7") and means a
 * change in its naming can't silently alter our data.
 */

const TRIAD_BY_INTERVALS: Record<string, TriadQuality> = {
  '4,7': 'maj',
  '3,7': 'min',
  '3,6': 'dim',
  '4,8': 'aug',
};

const SEVENTH_BY_INTERVALS: Record<string, SeventhQuality> = {
  '4,7,11': 'maj7',
  '3,7,10': 'min7',
  '4,7,10': 'dom7',
  '3,6,10': 'min7b5',
  '3,6,9': 'dim7',
  '3,7,11': 'minMaj7',
};

const TRIAD_SUFFIX: Record<TriadQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
};

const SEVENTH_SUFFIX: Record<SeventhQuality, string> = {
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  min7b5: 'm7b5',
  dim7: 'dim7',
  minMaj7: 'mMaj7',
};

const NINTH_SUFFIX: Record<SeventhQuality, string> = {
  maj7: 'maj9',
  min7: 'm9',
  dom7: '9',
  min7b5: 'm9b5',
  dim7: 'dim9',
  minMaj7: 'mMaj9',
};

function intervalKey(root: PitchClass, others: PitchClass[]): string {
  return others.map((n) => semitonesBetween(root, n)).join(',');
}

/** Stack thirds from index `i` of the scale, wrapping around. */
function stack(notes: PitchClass[], i: number, count: number): PitchClass[] {
  return Array.from({ length: count }, (_, k) => notes[(i + k * 2) % notes.length]!);
}

/**
 * The chord family, relative to the mode's own tonic. Three families cover
 * all seven degrees — the 2nd sits with the 4th, which is why a teacher calls
 * both of them subdominant chords.
 */
function functionOf(degreeNumber: number): ChordFunction {
  if (degreeNumber === 2 || degreeNumber === 4) return 'subdominant';
  if (degreeNumber === 5 || degreeNumber === 7) return 'dominant';
  return 'tonic';
}

export function diatonicChords(km: KeyMode): DiatonicChord[] {
  const notes = scaleNotes(km);
  const degrees = scaleDegrees(km);

  return notes.map((root, i) => {
    const triadNotes = stack(notes, i, 3);
    const seventhNotes = stack(notes, i, 4);

    const triad = TRIAD_BY_INTERVALS[intervalKey(root, triadNotes.slice(1))];
    const seventh = SEVENTH_BY_INTERVALS[intervalKey(root, seventhNotes.slice(1))];
    if (!triad || !seventh) {
      throw new Error(`Unrecognised chord on ${root} in ${km.tonic} ${km.mode}`);
    }

    // The diatonic ninth is the next scale note up. A minor 9th above the root
    // is unusable as an extension, so we report no ninth rather than invent one.
    const ninthNote = notes[(i + 1) % notes.length]!;
    const ninthIsMajor = semitonesBetween(root, ninthNote) === 2;

    return {
      degree: degrees[i]!,
      root,
      triad,
      seventh,
      triadSymbol: `${root}${TRIAD_SUFFIX[triad]}`,
      seventhSymbol: `${root}${SEVENTH_SUFFIX[seventh]}`,
      ninthSymbol: ninthIsMajor ? `${root}${NINTH_SUFFIX[seventh]}` : null,
      notes: { triad: triadNotes, seventh: seventhNotes },
      function: functionOf(degrees[i]!.number),
    };
  });
}

/** The chord built on one degree of the key. */
export function chordOnDegree(km: KeyMode, degreeNumber: number): DiatonicChord {
  const chord = diatonicChords(km)[degreeNumber - 1];
  if (!chord) throw new Error(`No degree ${degreeNumber}`);
  return chord;
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * The chord as a roman numeral relative to the mode's own tonic: "i", "♭III",
 * "vi°". Case follows the triad — lower for minor and diminished.
 */
export function romanNumeral(chord: DiatonicChord): string {
  const { number, alteration } = chord.degree;
  const accidental = alteration === -1 ? '♭' : alteration === 1 ? '♯' : '';
  const base = NUMERALS[number - 1]!;
  const numeral = chord.triad === 'min' || chord.triad === 'dim' ? base.toLowerCase() : base;
  const suffix = chord.triad === 'dim' ? '°' : chord.triad === 'aug' ? '+' : '';
  return `${accidental}${numeral}${suffix}`;
}

const TRIAD_INTERVALS: Record<TriadQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};

const SEVENTH_INTERVALS: Record<SeventhQuality, number[]> = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  min7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
};

/** Semitone offsets from the root for a quality. */
export function chordIntervals(quality: TriadQuality | SeventhQuality): number[] {
  const t = TRIAD_INTERVALS[quality as TriadQuality];
  if (t) return t;
  const s = SEVENTH_INTERVALS[quality as SeventhQuality];
  if (s) return s;
  throw new Error(`Unknown chord quality: ${quality}`);
}

/**
 * The notes of a chord in isolation, spelled from the root by stacking thirds.
 * For anything inside a key, prefer `diatonicChords` — it spells against the
 * scale, which is what makes the letters line up.
 */
export function chordTones(
  root: PitchClass,
  quality: TriadQuality | SeventhQuality,
): PitchClass[] {
  const letters = 'CDEFGAB';
  const rootLetter = root[0]!;
  const rootLetterIndex = letters.indexOf(rootLetter);

  return chordIntervals(quality).map((semitones, k) => {
    // Stacked thirds move two letter names at a time; spell to that letter.
    const letter = letters[(rootLetterIndex + k * 2) % 7]!;
    const naturalSemis = semitonesBetween(pitchClass(rootLetter), pitchClass(letter));
    const rootAccidental = root.length - 1 === 0 ? 0 : root.includes('#') ? 1 : -1;
    const rootAccidentalCount = (root.length - 1) * rootAccidental;
    let alter = semitones - naturalSemis + rootAccidentalCount;
    while (alter > 6) alter -= 12;
    while (alter < -6) alter += 12;
    const accidental = alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter);
    return pitchClass(`${letter}${accidental}`);
  });
}
