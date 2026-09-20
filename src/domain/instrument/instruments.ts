import { noteName } from '@/domain/music';
import type { Instrument } from './types';

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
 * against. DADGAD is not in the exercise matrix yet, and the bass is there to
 * catch string-count assumptions rather than to practice these exercises on.
 */
export const OFFERED_INSTRUMENTS = [
  STANDARD_GUITAR,
  DROP_D_GUITAR,
  SEVEN_STRING_GUITAR,
] as const;
