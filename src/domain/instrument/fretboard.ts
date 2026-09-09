import type { KeyMode, Midi, NoteName, PitchClass } from '@/domain/music';
import {
  chroma,
  degreeOf,
  midi,
  midiOf,
  noteNameFromMidi,
  pitchClassOf,
  scaleNotes,
} from '@/domain/music';
import type {
  FretPosition,
  FretRange,
  Instrument,
  NeckPosition,
  ScaleNotePosition,
} from './types';

export function stringCount(instrument: Instrument): number {
  return instrument.tuning.length;
}

/** The lowest fret playable — the capo, if one is on. */
export function lowestFret(instrument: Instrument): number {
  return instrument.capo;
}

export function fullRange(instrument: Instrument): FretRange {
  return { low: lowestFret(instrument), high: instrument.fretCount };
}

export function isValidPosition(instrument: Instrument, pos: FretPosition): boolean {
  return (
    Number.isInteger(pos.string) &&
    Number.isInteger(pos.fret) &&
    pos.string >= 0 &&
    pos.string < stringCount(instrument) &&
    pos.fret >= lowestFret(instrument) &&
    pos.fret <= instrument.fretCount
  );
}

function openStringMidi(instrument: Instrument, stringIndex: number): Midi {
  const open = instrument.tuning[stringIndex];
  if (open === undefined) {
    throw new Error(
      `String ${stringIndex} is out of range for ${instrument.name} ` +
        `(${stringCount(instrument)} strings)`,
    );
  }
  return midiOf(open);
}

export function midiAt(instrument: Instrument, pos: FretPosition): Midi {
  if (!isValidPosition(instrument, pos)) {
    throw new Error(`Invalid position: string ${pos.string}, fret ${pos.fret}`);
  }
  return midi(openStringMidi(instrument, pos.string) + pos.fret);
}

/**
 * The note at a position, spelled with sharps. For anything shown against a
 * key, use `spellInKey` so Eb major shows Ab rather than G#.
 */
export function noteAt(instrument: Instrument, pos: FretPosition): NoteName {
  return noteNameFromMidi(midiAt(instrument, pos));
}

export function pitchClassAt(instrument: Instrument, pos: FretPosition): PitchClass {
  return pitchClassOf(noteAt(instrument, pos));
}

/**
 * Respell a pitch class using the key's own spelling, so a fretboard in Eb
 * major reads Ab rather than G#. Falls back to the sharp spelling for notes
 * outside the key.
 */
export function spellInKey(km: KeyMode, pc: PitchClass): PitchClass {
  const target = chroma(pc);
  for (const note of scaleNotes(km)) {
    if (chroma(note) === target) return note;
  }
  return pc;
}

function inRange(fret: number, range: FretRange): boolean {
  return fret >= range.low && fret <= range.high;
}

/** Every place a pitch class can be played, low string to high, low fret first. */
export function positionsOf(
  instrument: Instrument,
  pc: PitchClass,
  range: FretRange = fullRange(instrument),
): FretPosition[] {
  const target = chroma(pc);
  const found: FretPosition[] = [];

  for (let string = 0; string < stringCount(instrument); string += 1) {
    for (let fret = range.low; fret <= Math.min(range.high, instrument.fretCount); fret += 1) {
      if (!inRange(fret, range)) continue;
      if (chroma(pitchClassAt(instrument, { string, fret })) === target) {
        found.push({ string, fret });
      }
    }
  }
  return found;
}

/** Every note of a key laid out across the neck, spelled in that key. */
export function scaleOnNeck(
  instrument: Instrument,
  km: KeyMode,
  range: FretRange = fullRange(instrument),
): ScaleNotePosition[] {
  const notes = scaleNotes(km);
  const byChroma = new Map(notes.map((n) => [chroma(n), n]));
  const rootChroma = chroma(km.tonic);
  const out: ScaleNotePosition[] = [];

  for (let string = 0; string < stringCount(instrument); string += 1) {
    for (let fret = range.low; fret <= Math.min(range.high, instrument.fretCount); fret += 1) {
      const pos = { string, fret };
      const sounding = pitchClassAt(instrument, pos);
      const spelled = byChroma.get(chroma(sounding));
      if (!spelled) continue;

      const degree = degreeOf(km, spelled);
      if (!degree) continue;

      out.push({
        ...pos,
        pitchClass: spelled,
        note: noteAt(instrument, pos),
        degree,
        isRoot: chroma(spelled) === rootChroma,
      });
    }
  }
  return out;
}

/** The fret window a neck position covers. */
export function positionRange(position: NeckPosition): FretRange {
  return { low: position.fret, high: position.fret + position.span - 1 };
}

/**
 * Whether a position is playable within a hand span, treating open strings as
 * always available — the hand does not have to reach for them.
 */
export function isWithinPosition(pos: FretPosition, position: NeckPosition): boolean {
  if (pos.fret === 0) return true;
  const range = positionRange(position);
  return inRange(pos.fret, range);
}

/** Frets ascending from the nut that carry a position marker dot. */
export const MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

export function isDoubleMarkerFret(fret: number): boolean {
  return fret > 0 && fret % 12 === 0;
}

export function isMarkerFret(fret: number): boolean {
  return MARKER_FRETS.includes(fret);
}

/**
 * The lowest fret at which a pitch class is playable on a string, at or above
 * `minFret`. Null when the string cannot reach it within the fret count.
 */
export function fretForPitchOnString(
  instrument: Instrument,
  string: number,
  pc: PitchClass,
  minFret = lowestFret(instrument),
): number | null {
  const target = chroma(pc);
  for (let fret = minFret; fret <= instrument.fretCount; fret += 1) {
    if (chroma(pitchClassAt(instrument, { string, fret })) === target) return fret;
  }
  return null;
}
