import { Note } from 'tonal';
import type { Chroma, Midi, NoteName, PitchClass } from './types';

const PITCH_CLASS_RE = /^[A-G](#{1,2}|b{1,2})?$/;
const NOTE_NAME_RE = /^[A-G](#{1,2}|b{1,2})?-?\d+$/;

export function isPitchClass(value: string): value is PitchClass {
  return PITCH_CLASS_RE.test(value);
}

export function isNoteName(value: string): value is NoteName {
  return NOTE_NAME_RE.test(value) && !Note.get(value).empty;
}

/** Parse a pitch class, throwing on anything unparseable. The only way in. */
export function pitchClass(value: string): PitchClass {
  if (!isPitchClass(value)) throw new Error(`Not a pitch class: ${JSON.stringify(value)}`);
  return value;
}

/** Parse a note name with octave, throwing on anything unparseable. */
export function noteName(value: string): NoteName {
  if (!isNoteName(value)) throw new Error(`Not a note name: ${JSON.stringify(value)}`);
  return value;
}

export function midi(value: number): Midi {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new Error(`MIDI number out of range: ${value}`);
  }
  return value as Midi;
}

export function chroma(pc: PitchClass | NoteName): Chroma {
  const c = Note.chroma(pc);
  if (c === undefined) throw new Error(`No chroma for ${pc}`);
  return c as Chroma;
}

/** The pitch class of a note, discarding its octave. */
export function pitchClassOf(note: NoteName): PitchClass {
  return pitchClass(Note.pitchClass(note));
}

export function octaveOf(note: NoteName): number {
  const oct = Note.get(note).oct;
  if (oct === undefined) throw new Error(`No octave in ${note}`);
  return oct;
}

export function midiOf(note: NoteName): Midi {
  const m = Note.midi(note);
  if (m === null) throw new Error(`No MIDI value for ${note}`);
  return midi(m);
}

/**
 * Spelling-aware transposition by an interval name ("3M", "5P", "2m").
 * Prefer this over semitone arithmetic wherever the result is displayed —
 * semitones lose the letter name and produce D# where the key wants Eb.
 */
export function transposeBy(pc: PitchClass, interval: string): PitchClass {
  const out = Note.transpose(pc, interval);
  if (!out) throw new Error(`Cannot transpose ${pc} by ${interval}`);
  return pitchClass(out);
}

export function transposeNoteBy(note: NoteName, interval: string): NoteName {
  const out = Note.transpose(note, interval);
  if (!out) throw new Error(`Cannot transpose ${note} by ${interval}`);
  return noteName(out);
}

/** Semitones from `from` up to `to`, always in 0-11. */
export function semitonesBetween(from: PitchClass, to: PitchClass): number {
  return (((chroma(to) - chroma(from)) % 12) + 12) % 12;
}

export function sameChroma(a: PitchClass, b: PitchClass): boolean {
  return chroma(a) === chroma(b);
}

/** How many accidentals a pitch class carries: "C" 0, "F#" 1, "Bbb" 2. */
export function accidentalCount(pc: PitchClass): number {
  return pc.length - 1;
}

export function hasDoubleAccidental(pc: PitchClass): boolean {
  return pc.length > 2;
}

/** Note name from a pitch class and octave: ("F#", 3) -> "F#3". */
export function withOctave(pc: PitchClass, octave: number): NoteName {
  return noteName(`${pc}${octave}`);
}

/**
 * Note name for a MIDI number, spelled with sharps. Only for contexts with no
 * key to spell against (a raw fretboard readout); anything key-aware should
 * spell from the scale instead.
 */
export function noteNameFromMidi(value: Midi): NoteName {
  return noteName(Note.fromMidi(value));
}
