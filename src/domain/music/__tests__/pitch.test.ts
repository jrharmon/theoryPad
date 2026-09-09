import { describe, expect, it } from 'vitest';
import {
  accidentalCount,
  chroma,
  hasDoubleAccidental,
  isNoteName,
  isPitchClass,
  midiOf,
  noteName,
  noteNameFromMidi,
  octaveOf,
  pitchClass,
  pitchClassOf,
  sameChroma,
  semitonesBetween,
  transposeBy,
  transposeNoteBy,
  withOctave,
} from '../pitch';
import { midi } from '../pitch';

describe('parsing', () => {
  it.each(['C', 'F#', 'Bb', 'G##', 'Abb'])('accepts %s as a pitch class', (v) => {
    expect(isPitchClass(v)).toBe(true);
    expect(pitchClass(v)).toBe(v);
  });

  it.each(['H', 'c', '', 'C4', 'F###', 'Cb#'])('rejects %s as a pitch class', (v) => {
    expect(isPitchClass(v)).toBe(false);
    expect(() => pitchClass(v)).toThrow();
  });

  it.each(['C4', 'F#3', 'Bb-1', 'A0'])('accepts %s as a note name', (v) => {
    expect(isNoteName(v)).toBe(true);
  });

  it.each(['C', 'F#', 'H4', ''])('rejects %s as a note name', (v) => {
    expect(isNoteName(v)).toBe(false);
    expect(() => noteName(v)).toThrow();
  });

  it('rejects MIDI numbers outside 0-127', () => {
    expect(() => midi(-1)).toThrow();
    expect(() => midi(128)).toThrow();
    expect(() => midi(60.5)).toThrow();
    expect(midi(60)).toBe(60);
  });
});

describe('pitch arithmetic', () => {
  it('reads chroma, ignoring spelling', () => {
    expect(chroma(pitchClass('C'))).toBe(0);
    expect(chroma(pitchClass('B#'))).toBe(0);
    expect(chroma(pitchClass('F#'))).toBe(6);
    expect(chroma(pitchClass('Gb'))).toBe(6);
    expect(sameChroma(pitchClass('F#'), pitchClass('Gb'))).toBe(true);
    expect(sameChroma(pitchClass('F#'), pitchClass('G'))).toBe(false);
  });

  it('splits a note into pitch class and octave', () => {
    expect(pitchClassOf(noteName('F#3'))).toBe('F#');
    expect(octaveOf(noteName('F#3'))).toBe(3);
    expect(withOctave(pitchClass('Bb'), 2)).toBe('Bb2');
  });

  it('converts to and from MIDI', () => {
    expect(midiOf(noteName('C4'))).toBe(60);
    expect(midiOf(noteName('E2'))).toBe(40);
    expect(midiOf(noteName('A4'))).toBe(69);
    expect(noteNameFromMidi(midi(60))).toBe('C4');
  });

  it('measures semitones upward, wrapping at the octave', () => {
    expect(semitonesBetween(pitchClass('C'), pitchClass('E'))).toBe(4);
    expect(semitonesBetween(pitchClass('E'), pitchClass('C'))).toBe(8);
    expect(semitonesBetween(pitchClass('C'), pitchClass('C'))).toBe(0);
  });

  it('transposes with spelling intact', () => {
    // Semitone arithmetic would give D#; the interval keeps the letter right.
    expect(transposeBy(pitchClass('C'), '3m')).toBe('Eb');
    expect(transposeBy(pitchClass('C'), '2A')).toBe('D#');
    expect(transposeBy(pitchClass('Bb'), '5P')).toBe('F');
    expect(transposeNoteBy(noteName('E2'), '5P')).toBe('B2');
    expect(transposeNoteBy(noteName('B3'), '2m')).toBe('C4');
  });

  it('counts accidentals', () => {
    expect(accidentalCount(pitchClass('C'))).toBe(0);
    expect(accidentalCount(pitchClass('F#'))).toBe(1);
    expect(accidentalCount(pitchClass('Bbb'))).toBe(2);
    expect(hasDoubleAccidental(pitchClass('Bbb'))).toBe(true);
    expect(hasDoubleAccidental(pitchClass('Bb'))).toBe(false);
  });
});
