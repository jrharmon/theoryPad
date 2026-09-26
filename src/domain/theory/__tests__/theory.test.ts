import { describe, expect, it } from 'vitest';
import type { KeyMode, ModeName } from '@/domain/music';
import {
  SCALE_IDS,
  chroma,
  keySignature,
  circlePosition,
  pitchClass,
  scaleNotes,
} from '@/domain/music';
import { mulberry32 } from '@/domain/variation';
import {
  CIRCLE_POSITIONS,
  circleQuestions,
  chordFamily,
  diatonicQuestions,
  enharmonics,
  keyOnCircle,
  majorAt,
  minorAt,
  nameChords,
  nameNotes,
  noteDistractors,
  positionOfMajor,
  signatureLabel,
  spellingDistractors,
  multiIsCorrect,
  tableIsCorrect,
  wrapPosition,
  type CircleQuestionType,
  type SinglePickQuestion,
} from '..';

const km = (tonic: string, mode: ModeName): KeyMode => ({
  tonic: pitchClass(tonic),
  scale: 'major',
  mode,
});
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
      expect(wrong.some((p) => Math.abs(chroma(p) - chroma(pitchClass('Bb'))) % 11 === 1)).toBe(
        true,
      );
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
      'maj',
      'min',
      'min',
      'maj',
      'maj',
      'min',
      'dim',
    ]);
    expect(nameChords(D_DORIAN, 'sevenths', 'q').rows.map((r) => r.correctOptionId)).toEqual([
      'min7',
      'min7',
      'maj7',
      'dom7',
      'min7',
      'min7b5',
      'maj7',
    ]);
  });

  it('asks for a whole chord family, offering every chord in the key', () => {
    const q = chordFamily(D_DORIAN, mulberry32(3), false, 'q', 'subdominant');
    expect(q.prompt).toBe('Which chords are the subdominant family in D Dorian?');
    expect(q.note).toBe('Two of them.');
    // Every chord of the key is offered, each one exactly once.
    expect(q.options).toHaveLength(7);
    const notes = scaleNotes(D_DORIAN);
    for (const option of q.options) {
      expect(notes).toContain(pitchClass(option.label.replace(/(m|dim|aug)$/, '')));
    }
    // The 2nd and the 4th together: the whole reason this is a multi-pick.
    const answers = q.correctOptionIds.map((id) => q.options.find((o) => o.id === id)!.label);
    expect(answers.sort()).toEqual(['Em', 'G']);
    // Every chord that is not in the family says which family it is in.
    expect(Object.keys(q.feedback.whatItIs ?? {})).toHaveLength(5);
    expect(q.feedback.rule).toBe(
      'The subdominant family in D Dorian is the 2nd and 4th: Em and G.',
    );
  });

  it('marks a family answer right only when the picks match exactly', () => {
    const q = chordFamily(C_MAJOR, mulberry32(1), false, 'q', 'dominant');
    const right = q.correctOptionIds;
    expect(multiIsCorrect(q, right)).toBe(true);
    expect(multiIsCorrect(q, [...right].reverse())).toBe(true);
    expect(multiIsCorrect(q, right.slice(1))).toBe(false);
    const extra = q.options.find((o) => !right.includes(o.id))!.id;
    expect(multiIsCorrect(q, [...right, extra])).toBe(false);
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

  it('names a pentatonic’s own notes, and asks about its parent’s chords', () => {
    const pentatonic: KeyMode = {
      tonic: pitchClass('A'),
      scale: 'minor-pentatonic',
      mode: 'minor-pentatonic',
    };
    const notes = nameNotes(pentatonic, mulberry32(1), 'q');
    expect(notes.prompt).toBe('Name the notes of A minor pentatonic.');
    expect(notes.rows.map((r) => r.correctOptionId)).toEqual(pcs('C', 'D', 'E', 'G'));
    for (const row of notes.rows) expect(row.options).toHaveLength(4);
    expect(notes.feedback.rule).toBe(
      'A minor pentatonic is A Aeolian without its 2nd and 6th: A C D E G.',
    );
    const blues = nameNotes(
      { ...pentatonic, scale: 'blues', mode: 'blues' },
      mulberry32(1),
      'q',
    );
    expect(blues.rows.map((r) => r.correctOptionId)).toEqual(pcs('C', 'D', 'Eb', 'E', 'G'));

    const family = chordFamily(pentatonic, mulberry32(3), false, 'q', 'subdominant');
    expect(family.prompt).toBe('Which chords are the subdominant family in A Aeolian?');
    expect(family.options).toHaveLength(7);
  });

  it('asks harmonic minor about its own chords, offering its own qualities', () => {
    const harmonic: KeyMode = {
      tonic: pitchClass('A'),
      scale: 'harmonic-minor',
      mode: 'harmonic-minor',
    };
    const sevenths = nameChords(harmonic, 'sevenths', 'q');
    expect(sevenths.prompt).toBe('Pick the quality of each 7th chord in A harmonic minor.');
    expect(sevenths.rows.map((r) => r.correctOptionId)).toEqual([
      'minMaj7',
      'min7b5',
      'maj7sharp5',
      'min7',
      'dom7',
      'maj7',
      'dim7',
    ]);
    expect(sevenths.rows[0]!.options.map((o) => o.label)).toEqual([
      'maj7',
      'm7',
      '7',
      'm7b5',
      'dim7',
      'mMaj7',
      'maj7#5',
    ]);
    // A Major key never offers them.
    expect(nameChords(C_MAJOR, 'sevenths', 'q').rows[0]!.options).toHaveLength(5);
    expect(nameNotes(harmonic, mulberry32(1), 'q').feedback.rule).toBe(
      'A harmonic minor is A natural minor with its 7th raised: A B C D E F G#.',
    );
  });

  it.each(SCALE_IDS)('makes a whole set on %s, every answer among its options', (scale) => {
    const mode = scale === 'major' ? 'dorian' : scale;
    const set = diatonicQuestions({
      keyMode: { tonic: pitchClass('D'), scale, mode },
      rng: mulberry32(9),
      types: ['name-notes', 'name-chords', 'spell-chord', 'chord-function'],
      depth: 'both',
      count: 12,
    });
    expect(set.length).toBeGreaterThan(8);
    for (const q of set) {
      const ids = (q.kind === 'table-fill' ? q.rows.flatMap((r) => r.options) : q.options).map(
        (o) => o.id,
      );
      const right =
        q.kind === 'table-fill'
          ? q.rows.map((r) => r.correctOptionId)
          : q.kind === 'multi-pick'
            ? q.correctOptionIds
            : [q.correctOptionId];
      for (const id of right) expect(ids).toContain(id);
    }
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

  const answer = (q: SinglePickQuestion) =>
    q.options.find((o) => o.id === q.correctOptionId)!.label;

  it('always has one right answer among distinct options, all placed on the circle', () => {
    const types: CircleQuestionType[] = [
      'signature-to-key',
      'key-to-signature',
      'relative-minor',
      'relative-major',
      'neighbour-key',
      'mode-signature',
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
    }
  });

  it('sets its trap now and then, not on most questions', () => {
    // The mirror count — 3 sharps for 3 flats — is the trap here.
    const set = circleQuestions({
      rng: mulberry32(21),
      types: ['key-to-signature'],
      count: 200,
      includeModes: false,
    });
    const trapped = set.filter((q) => {
      const p = positionOfMajor(pitchClass(/does (\S+) major/.exec(q.prompt)![1]!));
      return p !== 0 && q.options.some((o) => o.label === signatureLabel(-p));
    }).length;
    expect(trapped / set.length).toBeGreaterThan(0.1);
    expect(trapped / set.length).toBeLessThan(0.5);
  });

  it('leans toward the keys it is told to, without leaving the others out', () => {
    const subjects = (keyWeights: Record<string, number>) =>
      circleQuestions({
        rng: mulberry32(5),
        types: ['key-to-signature'],
        count: 300,
        includeModes: false,
        keyWeights,
      }).map((q) => q.subject);
    const even = subjects({}).filter((s) => s === 'key:Eb').length;
    const leaning = subjects({ Eb: 4, G: 0.25 });
    expect(leaning.filter((s) => s === 'key:Eb').length).toBeGreaterThan(even * 2);
    expect(leaning.filter((s) => s === 'key:G').length).toBeLessThan(even);
    expect(new Set(leaning).size).toBeGreaterThan(10);
  });

  it('gets relative minors right, and offers the parallel minor as a trap', () => {
    for (const q of questions('relative-minor', 11)) {
      const major = pitchClass(/of (\S+) major/.exec(q.prompt)![1]!);
      expect(answer(q)).toBe(`${minorAt(positionOfMajor(major))} minor`);
    }
    const set = circleQuestions({
      rng: mulberry32(0),
      types: ['relative-minor'],
      count: 200,
      includeModes: false,
    });
    const trapped = set.filter((q) => {
      const major = /of (\S+) major/.exec(q.prompt)![1]!;
      return q.options.some((o) => o.label === `${major} minor`);
    }).length;
    expect(trapped).toBeGreaterThan(0);
    expect(trapped / set.length).toBeLessThan(0.5);
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
    const set = circleQuestions({
      rng: mulberry32(1),
      types: ['mode-signature', 'key-to-signature'],
      count: 10,
      includeModes: false,
    });
    expect(set.every((q) => !q.subject.startsWith('mode:'))).toBe(true);
  });
});

describe('a key on the circle', () => {
  const roots = (k: KeyMode) =>
    Object.fromEntries(keyOnCircle(k).cells.map((c) => [c.role, `${c.root}@${c.position}`]));

  it('lights up the parent major’s wedge, and the mode’s home chord in it', () => {
    const circle = keyOnCircle(D_DORIAN);
    expect(circle.position).toBe(0);
    expect(roots(D_DORIAN)).toEqual({
      IV: 'F@-1',
      I: 'C@0',
      V: 'G@1',
      ii: 'D@-1',
      vi: 'A@0',
      iii: 'E@1',
      'vii°': 'B@0',
    });
    expect(circle.tonic).toMatchObject({ role: 'ii', ring: 'minor', root: 'D' });
  });

  it('puts every mode’s tonic on the ring its chord belongs to', () => {
    const expected: Record<ModeName, [string, string]> = {
      ionian: ['I', 'major'],
      dorian: ['ii', 'minor'],
      phrygian: ['iii', 'minor'],
      lydian: ['IV', 'major'],
      mixolydian: ['V', 'major'],
      aeolian: ['vi', 'minor'],
      locrian: ['vii°', 'diminished'],
    };
    for (const [mode, [role, ring]] of Object.entries(expected) as [
      ModeName,
      [string, string],
    ][]) {
      const tonic = keyOnCircle(km('A', mode)).tonic;
      expect([tonic.role, tonic.ring, tonic.root]).toEqual([role, ring, 'A']);
    }
  });

  it('spells the wedge from the key, and wraps it round the six-accidental seam', () => {
    const ebMinor = km('Eb', 'aeolian');
    const circle = keyOnCircle(ebMinor);
    expect(circle.signature.flats).toBe(6);
    expect(circle.position).toBe(6);
    // Cb, not B; and IV and V sit either side of the seam.
    expect(roots(ebMinor)).toMatchObject({ IV: 'Cb@5', I: 'Gb@6', V: 'Db@-5', vi: 'Eb@6' });
  });
});

describe('traps are occasional', () => {
  it('mostly asks for the key’s notes among its other notes, with a spelling trap now and then', () => {
    let rows = 0;
    let plain = 0;
    for (let seed = 0; seed < 20; seed += 1) {
      const q = nameNotes(D_DORIAN, mulberry32(seed), 'q');
      const inKey = new Set<string>(scaleNotes(D_DORIAN));
      for (const row of q.rows) {
        rows += 1;
        if (row.options.every((o) => inKey.has(o.id))) plain += 1;
      }
    }
    expect(plain / rows).toBeGreaterThan(0.5);
    expect(plain).toBeLessThan(rows);
  });
});

describe('a set does not repeat itself', () => {
  it('asks about different chords within one diatonic set', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const set = diatonicQuestions({
        keyMode: D_DORIAN,
        rng: mulberry32(seed),
        types: ['spell-chord', 'chord-function'],
        depth: 'triads',
        count: 12,
      });
      // Seven chords to spell, and a set of twelve asks for six of them.
      const spell = set.filter((q) => q.kind === 'single-pick').map((q) => q.prompt);
      expect(new Set(spell).size).toBe(spell.length);
      // Only three families exist, so they cycle: all three before any repeat.
      const families = set.filter((q) => q.kind === 'multi-pick').map((q) => q.prompt);
      expect(new Set(families.slice(0, 3)).size).toBe(3);
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
