import { describe, expect, it } from 'vitest';
import type { KeyMode, ModeName } from '@/domain/music';
import { chroma, keySignature, circlePosition, pitchClass, scaleNotes } from '@/domain/music';
import { mulberry32 } from '@/domain/variation';
import {
  CIRCLE_POSITIONS,
  circleQuestions,
  chordFunction,
  degreeName,
  diatonicQuestions,
  enharmonics,
  majorAt,
  minorAt,
  nameChords,
  nameNotes,
  noteDistractors,
  positionOfMajor,
  signatureLabel,
  spellingDistractors,
  tableIsCorrect,
  wrapPosition,
  type CircleQuestionType,
  type SinglePickQuestion,
} from '..';

const km = (tonic: string, mode: ModeName): KeyMode => ({ tonic: pitchClass(tonic), mode });
const D_DORIAN = km('D', 'dorian');
const C_MAJOR = km('C', 'ionian');
const pcs = (...names: string[]) => names.map(pitchClass);

describe('distractors', () => {
  it('knows a note’s other spellings', () => {
    expect(enharmonics(pitchClass('Bb'))).toEqual(pcs('A#'));
    expect(enharmonics(pitchClass('E')).sort()).toEqual(pcs('Fb'));
  });

  it('offers a spelling trap, a same-letter trap and a pitch trap for a note', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const wrong = noteDistractors(pitchClass('Bb'), mulberry32(seed));
      expect(wrong).toHaveLength(3);
      expect(wrong).not.toContain('Bb');
      expect(new Set(wrong).size).toBe(3);
      expect(wrong).toContain('A#');
      expect(wrong.some((p) => p[0] === 'B')).toBe(true);
      expect(wrong.some((p) => Math.abs(chroma(p) - chroma(pitchClass('Bb'))) % 11 === 1)).toBe(true);
      for (const p of wrong) expect(p).toMatch(/^[A-G][#b]?$/);
    }
  });

  it('spells a chord wrong by exactly one note, never the root', () => {
    const correct = pcs('G', 'B', 'D', 'F#');
    for (let seed = 0; seed < 10; seed += 1) {
      for (const spelled of spellingDistractors(correct, mulberry32(seed))) {
        const differences = spelled.filter((n, i) => n !== correct[i]);
        expect(differences).toHaveLength(1);
        expect(spelled[0]).toBe('G');
        // Same letters, so it still looks like a stack of thirds.
        expect(spelled.map((n) => n[0])).toEqual(correct.map((n) => n[0]));
      }
    }
  });
});

describe('diatonic questions', () => {
  it('asks for the six notes after the tonic, each with its right answer among the options', () => {
    const q = nameNotes(D_DORIAN, mulberry32(1), 'q1');
    expect(q.rows).toHaveLength(6);
    expect(q.rows.map((r) => r.correctOptionId)).toEqual(pcs('E', 'F', 'G', 'A', 'B', 'C'));
    for (const row of q.rows) {
      expect(row.options).toHaveLength(4);
      expect(row.options.map((o) => o.id)).toContain(row.correctOptionId);
    }
  });

  it('is right only when every cell is', () => {
    const q = nameNotes(D_DORIAN, mulberry32(1), 'q1');
    const right = q.rows.map((r) => r.correctOptionId);
    expect(tableIsCorrect(q, right)).toBe(true);
    expect(tableIsCorrect(q, [...right.slice(0, 5), 'X'])).toBe(false);
    expect(tableIsCorrect(q, [...right.slice(0, 5), null])).toBe(false);
  });

  it('knows the quality of every chord in a key', () => {
    expect(nameChords(C_MAJOR, 'triads', 'q').rows.map((r) => r.correctOptionId)).toEqual([
      'maj', 'min', 'min', 'maj', 'maj', 'min', 'dim',
    ]);
    expect(nameChords(D_DORIAN, 'sevenths', 'q').rows.map((r) => r.correctOptionId)).toEqual([
      'min7', 'min7', 'maj7', 'dom7', 'min7', 'min7b5', 'maj7',
    ]);
  });

  it('names the degrees, telling a leading tone from a subtonic', () => {
    expect(degreeName(C_MAJOR, 4)).toBe('subdominant');
    expect(degreeName(C_MAJOR, 7)).toBe('leading tone');
    expect(degreeName(D_DORIAN, 7)).toBe('subtonic');
  });

  it('asks which chord has a function, and that chord is among the options', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const q = chordFunction(D_DORIAN, mulberry32(seed), false, 'q');
      expect(q.options).toHaveLength(4);
      const answer = q.options.find((o) => o.id === q.correctOptionId)!;
      const notes = scaleNotes(D_DORIAN);
      expect(notes).toContain(pitchClass(answer.label.replace(/(m|dim|aug)$/, '')));
      expect(Object.keys(q.feedback.whatItIs ?? {})).toHaveLength(3);
    }
  });

  it('makes a set of the asked-for size, each table at most once, the same for the same seed', () => {
    const make = (seed: number) =>
      diatonicQuestions({
        keyMode: D_DORIAN,
        rng: mulberry32(seed),
        types: ['name-notes', 'name-chords', 'spell-chord', 'chord-function'],
        depth: 'both',
        count: 8,
      });
    const set = make(5);
    expect(set).toHaveLength(8);
    expect(set.filter((q) => q.kind === 'table-fill')).toHaveLength(2);
    expect(JSON.stringify(make(5))).toBe(JSON.stringify(set));
  });

  it('stops short rather than repeating a table when only tables are asked for', () => {
    const set = diatonicQuestions({
      keyMode: D_DORIAN,
      rng: mulberry32(1),
      types: ['name-notes'],
      depth: 'triads',
      count: 8,
    });
    expect(set).toHaveLength(1);
  });
});

describe('the circle', () => {
  it('lays out the twelve major keys and their relative minors', () => {
    expect(CIRCLE_POSITIONS.map(majorAt)).toEqual(
      pcs('Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#'),
    );
    expect(minorAt(0)).toBe('A');
    expect(minorAt(-3)).toBe('C');
    expect(wrapPosition(7)).toBe(-5);
    expect(wrapPosition(-6)).toBe(6);
    expect(signatureLabel(-3)).toBe('3 flats');
    expect(signatureLabel(1)).toBe('1 sharp');
  });

  const questions = (type: CircleQuestionType, seed: number) =>
    circleQuestions({ rng: mulberry32(seed), types: [type], count: 12, includeModes: true });

  const answer = (q: SinglePickQuestion) => q.options.find((o) => o.id === q.correctOptionId)!.label;

  it('always has one right answer among distinct options, all placed on the circle', () => {
    const types: CircleQuestionType[] = [
      'signature-to-key', 'key-to-signature', 'relative-minor', 'relative-major', 'neighbour-key', 'mode-signature',
    ];
    for (const type of types) {
      for (const q of questions(type, 3)) {
        expect(q.options.length, `${type}: ${q.prompt}`).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
        const visual = q.feedback.visual;
        expect(visual?.kind).toBe('circle-of-fifths');
        if (visual?.kind === 'circle-of-fifths') {
          for (const o of q.options) expect(visual.positions[o.id]).toBeDefined();
        }
      }
    }
  });

  it('gets key signatures right', () => {
    for (const q of questions('key-to-signature', 7)) {
      const key = pitchClass(/does (\S+) major/.exec(q.prompt)![1]!);
      expect(answer(q)).toBe(signatureLabel(positionOfMajor(key)));
      // The mirror count is offered as a trap.
      const p = positionOfMajor(key);
      if (p !== 0 && Math.abs(p) <= 7) expect(q.options.map((o) => o.label)).toContain(signatureLabel(-p));
    }
  });

  it('gets relative minors right, and offers the parallel minor as a trap', () => {
    for (const q of questions('relative-minor', 11)) {
      const major = pitchClass(/of (\S+) major/.exec(q.prompt)![1]!);
      expect(answer(q)).toBe(`${minorAt(positionOfMajor(major))} minor`);
    }
    const f = circleQuestions({ rng: mulberry32(0), types: ['relative-minor'], count: 60, includeModes: false })
      .find((q) => q.prompt.includes('of F major'))!;
    expect(f.options.map((o) => o.label)).toContain('F minor');
  });

  it('gets mode signatures right, and offers the same tonic’s major as a trap', () => {
    for (const q of questions('mode-signature', 13)) {
      const [, tonic, mode] = /does (\S+) (\w+) have/.exec(q.prompt)!;
      const key = km(tonic!, mode!.toLowerCase() as ModeName);
      expect(answer(q)).toBe(signatureLabel(circlePosition(key)));
      expect(q.feedback.rule).toContain(keySignature(key).relativeMajor);
    }
  });

  it('leaves out mode questions when asked to', () => {
    const set = circleQuestions({ rng: mulberry32(1), types: ['mode-signature', 'key-to-signature'], count: 10, includeModes: false });
    expect(set.every((q) => !q.subject.startsWith('mode:'))).toBe(true);
  });
});

describe('a set does not repeat itself', () => {
  it('asks about different chords within one diatonic set', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const prompts = diatonicQuestions({
        keyMode: D_DORIAN,
        rng: mulberry32(seed),
        types: ['spell-chord', 'chord-function'],
        depth: 'triads',
        count: 12,
      }).map((q) => q.prompt);
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });

  it('asks different circle questions within one set', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const prompts = circleQuestions({
        rng: mulberry32(seed),
        types: ['key-to-signature', 'signature-to-key'],
        count: 10,
        includeModes: false,
      }).map((q) => q.prompt);
      expect(new Set(prompts).size).toBe(prompts.length);
    }
  });
});
