import { describe, expect, it } from 'vitest';
import type { KeyMode, ModeName } from '../../../music';
import { chordOnDegree, MODE_CHARACTER, MODE_NAMES, pitchClass } from '../../../music';
import { FOUR_FOUR, ticksPerBar } from '../../../phrase';
import type { NoteEvent, Progression } from '..';
import {
  bassRoot,
  chordTimeline,
  compById,
  COMPS,
  compTab,
  parseProgression,
  renderPass,
  voiceChord,
} from '..';

const BAR = ticksPerBar(FOUR_FOUR);
const C_IONIAN: KeyMode = { tonic: pitchClass('C'), scale: 'major', mode: 'ionian' };

const tab = (body: string) =>
  compTab({ id: 'test', name: 'Test', detail: '', signature: '4/4', tab: body });

function parsed(text: string): Progression {
  const result = parseProgression(text);
  if (!result.ok) throw new Error(result.error);
  return result.progression;
}

/** Piano events as chords: [tick, duration, velocity, notes]. */
function chordsOf(events: NoteEvent[]) {
  const byTick = new Map<number, NoteEvent[]>();
  for (const e of events) byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), e]);
  return [...byTick.values()].map((es) => [
    es[0]!.tick,
    es[0]!.durationTicks,
    es[0]!.velocity,
    es.map((e) => e.midi),
  ]);
}

const notesOf = (events: NoteEvent[]) => events.map((e) => [e.tick, e.durationTicks, e.midi]);

describe('comp tab', () => {
  it('reads strikes, ringing across bar lines, and bass chord tones', () => {
    const pattern = tab(`
      PN |X===x===|==xg|
      BS |1-3-5=7=|o=--|
    `);
    expect(pattern.bars).toBe(2);
    expect(pattern.lengthTicks).toBe(2 * BAR);
    expect(pattern.piano).toEqual([
      { tick: 0, durationTicks: 960, velocity: 1 },
      { tick: 960, durationTicks: 1920, velocity: 0.8 },
      { tick: 2880, durationTicks: 480, velocity: 0.8 },
      { tick: 3360, durationTicks: 480, velocity: 0.35 },
    ]);
    expect(pattern.bass.map((h) => [h.tick, h.durationTicks, h.tone])).toEqual([
      [0, 240, 1],
      [480, 240, 3],
      [960, 480, 5],
      [1440, 480, 7],
      [1920, 960, 'octave'],
    ]);
  });

  it('names the pattern and line when the tab is wrong', () => {
    expect(() => tab('DR |x-------|')).toThrow(/unknown line "DR"/);
    expect(() => tab('PN |x-1-----|')).toThrow(/"1" in bar 1 — use g x X = -/);
    expect(() => tab('BS |1-x-----|')).toThrow(/"x" in bar 1 — use 1 3 5 7 o = -/);
    expect(() => tab('PN |=-------|')).toThrow(/nothing before it/);
    expect(() => tab('PN |x-------|\nPN |x-------|')).toThrow(/a second PN line/);
    expect(() => tab('PN |x-------|\nBS |1-------|1-------|')).toThrow(/2 bars/);
    expect(() => tab('PN |x-------|\nBS |1------|')).toThrow(/bar 1 has 7 cells/);
    expect(() => tab('PN x-------')).toThrow(/Comp tab "test", line "PN x-------"/);
  });

  it('parses every shipped pattern', () => {
    // Importing COMPS ran each through compTab; a typo would have thrown already.
    expect(COMPS.map((c) => c.id)).toEqual(['pulse', 'strum', 'swing']);
    for (const comp of COMPS) {
      expect(comp.timeSignature, comp.id).toEqual(FOUR_FOUR);
      expect(comp.piano.length, comp.id).toBeGreaterThan(0);
      expect(comp.bass.length, comp.id).toBeGreaterThan(0);
    }
    expect(compById('gone')).toBe(COMPS[0]);
  });
});

describe('voicing', () => {
  it('starts near middle C and moves each chord the least distance', () => {
    const tones = (degree: number) => chordOnDegree(C_IONIAN, degree).notes.seventh;
    const cmaj7 = voiceChord(tones(1), null);
    const dm7 = voiceChord(tones(2), cmaj7);
    const g7 = voiceChord(tones(5), dm7);
    expect([cmaj7, dm7, g7]).toEqual([
      [55, 59, 60, 64], // G3 B3 C4 E4
      [57, 60, 62, 65], // A3 C4 D4 F4
      [55, 59, 62, 65], // G3 B3 D4 F4
    ]);
  });

  it('puts the bass root between E1 and D♯2', () => {
    expect(['E', 'D#', 'C', 'F'].map((pc) => bassRoot(pitchClass(pc)))).toEqual([
      28, 39, 36, 29,
    ]);
  });
});

describe('renderPass', () => {
  it('plays the pattern over each chord, voice-led', () => {
    const timeline = chordTimeline(parsed('2 5'), C_IONIAN, 'sevenths', {
      totalTicks: 2 * BAR,
      timeSignature: FOUR_FOUR,
    });
    const pattern = tab(`
      PN |X==-x==-X==-x==-|
      BS |1===5===1===5===|
    `);
    const { piano, bass } = renderPass(timeline, pattern, C_IONIAN, 'sevenths');
    const dm7 = [57, 60, 62, 65];
    const g7 = [55, 59, 62, 65];
    expect(chordsOf(piano)).toEqual([
      [0, 360, 1, dm7],
      [480, 360, 0.8, dm7],
      [960, 360, 1, dm7],
      [1440, 360, 0.8, dm7],
      [BAR, 360, 1, g7],
      [BAR + 480, 360, 0.8, g7],
      [BAR + 960, 360, 1, g7],
      [BAR + 1440, 360, 0.8, g7],
    ]);
    // D2 and A2, then G1 and D2.
    expect(notesOf(bass)).toEqual([
      [0, 480, 38],
      [480, 480, 45],
      [960, 480, 38],
      [1440, 480, 45],
      [BAR, 480, 31],
      [BAR + 480, 480, 38],
      [BAR + 960, 480, 31],
      [BAR + 1440, 480, 38],
    ]);
  });

  it('moves a ringing note to the new chord, cuts it at the end, and restarts every copy', () => {
    const pattern = tab(`
      PN |X=======|========|
      BS |1-3-5-7-|o=======|
    `);
    // A bar and a half, played twice: C for a bar, then F for half of one.
    const copy = BAR + BAR / 2;
    const timeline = chordTimeline(parsed('1 4'), C_IONIAN, 'triads', {
      totalTicks: copy,
      timeSignature: FOUR_FOUR,
      repeat: 2,
    });
    const { piano, bass } = renderPass(timeline, pattern, C_IONIAN, 'triads', copy);

    const c = [55, 60, 64];
    const f = [57, 60, 65];
    expect(chordsOf(piano)).toEqual([
      [0, BAR, 1, c],
      [BAR, BAR / 2, 1, f],
      [copy, BAR, 1, c],
      [copy + BAR, BAR / 2, 1, f],
    ]);
    // C3 E3 G3, then the 7 as C4 (triads), then the octave moves to F.
    const once = [
      [0, 240, 36],
      [480, 240, 40],
      [960, 240, 43],
      [1440, 240, 48],
      [BAR, BAR / 2, 41],
    ];
    expect(notesOf(bass)).toEqual([...once, ...once.map(([t, d, m]) => [t! + copy, d, m])]);
  });

  it('keeps every go-to progression in range, in every mode and key', () => {
    const tonics = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'];
    for (const mode of MODE_NAMES as readonly ModeName[]) {
      for (const tonic of tonics) {
        const keyMode: KeyMode = { tonic: pitchClass(tonic), scale: 'major', mode };
        for (const { degrees } of MODE_CHARACTER[mode].progressions!) {
          const progression = degrees.map((degree) => ({ degree, bars: 1 }));
          for (const chords of ['sevenths', 'triads'] as const) {
            const timeline = chordTimeline(progression, keyMode, chords, {
              totalTicks: 8 * BAR,
              timeSignature: FOUR_FOUR,
            });
            for (const comp of COMPS) {
              const { piano, bass } = renderPass(timeline, comp, keyMode, chords);
              const where = `${tonic} ${mode} ${degrees.join(' ')} ${chords} ${comp.id}`;
              for (const [, , , notes] of chordsOf(piano)) {
                const ns = notes as number[];
                expect(Math.min(...ns), where).toBeGreaterThanOrEqual(48);
                expect(Math.max(...ns), where).toBeLessThanOrEqual(72);
                expect(Math.max(...ns) - Math.min(...ns), where).toBeLessThan(12);
              }
              for (const e of bass) {
                expect(e.midi, where).toBeGreaterThanOrEqual(28);
                expect(e.midi, where).toBeLessThanOrEqual(51);
              }
            }
          }
        }
      }
    }
  });
});
