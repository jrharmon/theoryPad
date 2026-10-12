import { noteName } from '@/domain/music';
import type { NoteName } from '@/domain/music';
import type { Instrument, Tuning } from './types';

function make(id: string, name: string, tuning: string[], fretCount = 22): Instrument {
  return {
    id,
    name,
    tuning: tuning.map((t) => noteName(t)),
    fretCount,
    handedness: 'right',
    capo: 0,
  };
}

/** What the app ships with selected. */
export const STANDARD_GUITAR = make('guitar-standard', 'Guitar — standard', [
  'E2',
  'A2',
  'D3',
  'G3',
  'B3',
  'E4',
]);

export const DROP_D_GUITAR = make('guitar-drop-d', 'Guitar — drop D', [
  'D2',
  'A2',
  'D3',
  'G3',
  'B3',
  'E4',
]);

export const SEVEN_STRING_GUITAR = make(
  'guitar-7-string',
  'Guitar — 7 string',
  ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  24,
);

export const DROP_C_GUITAR = make('guitar-drop-c', 'Guitar — drop C', [
  'C2',
  'G2',
  'C3',
  'F3',
  'A3',
  'D4',
]);

export const SEVEN_STRING_DROP_A_GUITAR = make(
  'guitar-7-string-drop-a',
  'Guitar — 7 string, drop A',
  ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  24,
);

export const DADGAD_GUITAR = make('guitar-dadgad', 'Guitar — DADGAD', [
  'D2',
  'A2',
  'D3',
  'G3',
  'A3',
  'D4',
]);

export const BASS_4_STRING = make(
  'bass-standard',
  'Bass — 4 string',
  ['E1', 'A1', 'D2', 'G2'],
  20,
);

/**
 * Every instrument the domain is tested against. They are in the test matrix
 * from day one so a hard-coded string count fails a test rather than
 * surviving until someone picks up a seven-string.
 */
export const TEST_INSTRUMENTS = [
  STANDARD_GUITAR,
  DROP_D_GUITAR,
  SEVEN_STRING_GUITAR,
  BASS_4_STRING,
] as const;

export const DEFAULT_INSTRUMENT = STANDARD_GUITAR;

/**
 * What the settings page offers: the guitar tunings every exercise is tested
 * against, and the drop tunings written exercises arrive in. DADGAD is not in
 * the exercise matrix yet, and the bass is there to catch string-count
 * assumptions rather than to practice these exercises on.
 */
export const OFFERED_INSTRUMENTS = [
  STANDARD_GUITAR,
  DROP_D_GUITAR,
  DROP_C_GUITAR,
  SEVEN_STRING_GUITAR,
  SEVEN_STRING_DROP_A_GUITAR,
] as const;

/** A tuning as one string, lowest first: the key the fret heat is kept under. */
export function tuningKey(strings: readonly NoteName[]): string {
  return strings.join(' ');
}

/**
 * A tuning by name: a preset's ("Drop C", without "Guitar — "), or else its
 * notes, lowest first, without octaves ("C G C F A D").
 */
export function tuningName(strings: readonly NoteName[]): string {
  const key = tuningKey(strings);
  const preset = OFFERED_INSTRUMENTS.find((i) => tuningKey(i.tuning) === key);
  if (preset) {
    const name = preset.name.replace(/^Guitar — /, '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return strings.map((n) => n.replace(/-?\d+$/, '')).join(' ');
}

/**
 * The instrument an exercise plays on: its own tuning and capo when it has
 * them, otherwise the player's; always the player's fret count and handedness.
 */
export function tunedInstrument(player: Instrument, tuning?: Tuning): Instrument {
  if (!tuning) return player;
  if (tuningKey(tuning.strings) === tuningKey(player.tuning) && tuning.capo === player.capo) {
    return player;
  }
  return {
    ...player,
    id: `tuning:${tuningKey(tuning.strings)}:${tuning.capo}`,
    name: tuningName(tuning.strings),
    tuning: [...tuning.strings],
    capo: tuning.capo,
  };
}
