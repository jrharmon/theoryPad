import type { KeyMode, NoteName } from '../music';
import { chroma, midi, noteNameFromMidi } from '../music';

/** E2, the open low string of a standard guitar. */
const LOWEST = 40;

/**
 * What the drone sounds: the root, low in the guitar's own range (E2 up to
 * D♯3), its fifth, and the root an octave up. No third, so it serves every
 * mode alike — the mode is in what you play over it.
 */
export function droneNotes(keyMode: KeyMode): NoteName[] {
  const root = LOWEST + ((chroma(keyMode.tonic) - (LOWEST % 12) + 12) % 12);
  return [root, root + 7, root + 12].map((m) => noteNameFromMidi(midi(m)));
}
