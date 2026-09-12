import type { KeyMode, SeventhQuality, TriadQuality } from '@/domain/music';
import { chordOnDegree, diatonicChords, keySignature, scaleDegrees, scaleNotes, semitonesBetween } from '@/domain/music';
import type { Rng } from '@/domain/variation';
import { noteDistractors, spellingDistractors, withCorrect } from './distractors';
import type { SinglePickQuestion, TableFillQuestion, TheoryQuestion } from './types';

export type DiatonicQuestionType = 'name-notes' | 'name-chords' | 'spell-chord' | 'chord-function';
export type ChordDepth = 'triads' | 'sevenths' | 'both';

export function keyModeName(km: KeyMode): string {
  return `${km.tonic} ${km.mode.charAt(0).toUpperCase()}${km.mode.slice(1)}`;
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

/** What each degree is called. The 7th depends on whether it leads up to the tonic. */
export function degreeName(km: KeyMode, degree: number): string {
  const names = ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant'];
  if (degree <= 6) return names[degree - 1]!;
  const seventh = scaleNotes(km)[6]!;
  return semitonesBetween(seventh, km.tonic) === 1 ? 'leading tone' : 'subtonic';
}

const TRIAD_LABEL: Record<TriadQuality, string> = { maj: 'maj', min: 'min', dim: 'dim', aug: 'aug' };
const SEVENTH_LABEL: Record<SeventhQuality, string> = {
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  min7b5: 'm7b5',
  dim7: 'dim7',
  minMaj7: 'mMaj7',
};
/** What the table offers: every quality a mode produces, and one that none does. */
const TRIAD_OPTIONS: TriadQuality[] = ['maj', 'min', 'dim', 'aug'];
const SEVENTH_OPTIONS: SeventhQuality[] = ['maj7', 'min7', 'dom7', 'min7b5', 'dim7'];

function parentMajorNote(km: KeyMode): string {
  const sig = keySignature(km);
  return km.mode === 'ionian'
    ? `${km.tonic} major`
    : `${sig.relativeMajor} major, starting on its ${ORDINAL[scaleDegreesFromMajor(km)]} note`;
}

function scaleDegreesFromMajor(km: KeyMode): number {
  const order = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
  return order.indexOf(km.mode);
}

/** "Name the notes of D Dorian." The tonic is in the question; the other six are asked for. */
export function nameNotes(km: KeyMode, rng: Rng, id: string): TableFillQuestion {
  const notes = scaleNotes(km);
  const degrees = scaleDegrees(km);
  return {
    kind: 'table-fill',
    id,
    subject: keyModeName(km),
    prompt: `Name the notes of ${keyModeName(km)}.`,
    note: `${km.tonic} is the tonic.`,
    columns: [
      { id: 'degree', label: 'Degree' },
      { id: 'note', label: 'Note' },
    ],
    answerColumnId: 'note',
    rows: notes.slice(1).map((note, i) => {
      const { items, index } = withCorrect(note, noteDistractors(note, rng), rng);
      return {
        id: `${id}-${i + 2}`,
        given: { degree: degrees[i + 1]!.label },
        options: items.map((p) => ({ id: p, label: p })),
        correctOptionId: items[index]!,
      };
    }),
    feedback: {
      rule: `${keyModeName(km)} is ${parentMajorNote(km)}: ${notes.join(' ')}.`,
      visual: { kind: 'note-row', keyMode: km, highlight: [1, 2, 3, 4, 5, 6, 7] },
    },
  };
}

/** "Pick the quality of each chord. The root is given." */
export function nameChords(km: KeyMode, depth: 'triads' | 'sevenths', id: string): TableFillQuestion {
  const chords = diatonicChords(km);
  const options =
    depth === 'triads'
      ? TRIAD_OPTIONS.map((q) => ({ id: q, label: TRIAD_LABEL[q] }))
      : SEVENTH_OPTIONS.map((q) => ({ id: q, label: SEVENTH_LABEL[q] }));
  const symbols = chords.map((c) => (depth === 'triads' ? c.triadSymbol : c.seventhSymbol));
  return {
    kind: 'table-fill',
    id,
    subject: keyModeName(km),
    prompt: `Pick the quality of each ${depth === 'triads' ? 'triad' : '7th chord'} in ${keyModeName(km)}.`,
    note: 'The root is given.',
    columns: [
      { id: 'degree', label: 'Degree' },
      { id: 'root', label: 'Root' },
      { id: 'quality', label: 'Quality' },
    ],
    answerColumnId: 'quality',
    rows: chords.map((chord, i) => ({
      id: `${id}-${i + 1}`,
      given: { degree: chord.degree.label, root: chord.root },
      options,
      correctOptionId: depth === 'triads' ? chord.triad : chord.seventh,
    })),
    feedback: { rule: `In ${keyModeName(km)}: ${symbols.join(', ')}.` },
  };
}

function chordFor(km: KeyMode, degree: number, sevenths: boolean) {
  const chord = chordOnDegree(km, degree);
  return {
    chord,
    symbol: sevenths ? chord.seventhSymbol : chord.triadSymbol,
    notes: sevenths ? chord.notes.seventh : chord.notes.triad,
  };
}

/** "Spell Gmaj7." — pick the right notes from spellings with one note wrong. */
export function spellChord(
  km: KeyMode,
  rng: Rng,
  sevenths: boolean,
  id: string,
  degree = rng.int(7) + 1,
): SinglePickQuestion {
  const { symbol, notes } = chordFor(km, degree, sevenths);
  const wrong = spellingDistractors(notes, rng);
  const { items, index } = withCorrect(notes, wrong, rng);
  const options = items.map((spelled, i) => ({ id: `${id}-${i}`, label: spelled.join(' ') }));

  const whatItIs: Record<string, string> = {};
  items.forEach((spelled, i) => {
    if (i === index) return;
    const k = spelled.findIndex((n, j) => n !== notes[j]);
    whatItIs[options[i]!.id] = `That has ${spelled[k]} where ${symbol} has ${notes[k]}.`;
  });

  return {
    kind: 'single-pick',
    id,
    subject: keyModeName(km),
    prompt: `Spell ${symbol}.`,
    options,
    correctOptionId: options[index]!.id,
    feedback: {
      rule: `${symbol} is ${notes.join(' ')}: the ${ORDINAL[degree - 1]} degree of ${keyModeName(km)} with every other note of the key stacked on it.`,
      whatItIs,
      visual: { kind: 'note-row', keyMode: km, highlight: [0, 2, 4, 6].slice(0, notes.length).map((k) => ((degree - 1 + k) % 7) + 1) },
    },
  };
}

/** "Which chord is the subdominant in D Dorian?" */
export function chordFunction(
  km: KeyMode,
  rng: Rng,
  sevenths: boolean,
  id: string,
  degree = rng.int(7) + 1,
): SinglePickQuestion {
  const others = rng.shuffle([1, 2, 3, 4, 5, 6, 7].filter((d) => d !== degree)).slice(0, 3);
  const { items, index } = withCorrect(degree, others, rng);
  const options = items.map((d) => ({ id: `${id}-${d}`, label: chordFor(km, d, sevenths).symbol }));
  const name = degreeName(km, degree);

  const whatItIs: Record<string, string> = {};
  items.forEach((d, i) => {
    if (i !== index) whatItIs[options[i]!.id] = `That’s the ${degreeName(km, d)}, on the ${ORDINAL[d - 1]} degree.`;
  });

  return {
    kind: 'single-pick',
    id,
    subject: keyModeName(km),
    prompt: `Which chord is the ${name} in ${keyModeName(km)}?`,
    options,
    correctOptionId: options[index]!.id,
    feedback: {
      rule: `The ${name} is built on the ${ORDINAL[degree - 1]} degree: ${chordFor(km, degree, sevenths).symbol}.`,
      whatItIs,
      visual: { kind: 'note-row', keyMode: km, highlight: [degree] },
    },
  };
}

/**
 * A set of questions about one key. Types take turns; the table questions,
 * which cover the whole key at once, come up at most once each per set.
 */
export function diatonicQuestions(options: {
  keyMode: KeyMode;
  rng: Rng;
  types: readonly DiatonicQuestionType[];
  depth: ChordDepth;
  count: number;
}): TheoryQuestion[] {
  const { keyMode: km, rng, depth, count } = options;
  const types = options.types.length > 0 ? options.types : (['name-notes'] as const);
  const singles = types.filter((t) => t === 'spell-chord' || t === 'chord-function');
  const usedTables = new Set<DiatonicQuestionType>();
  const sevenths = (i: number) => (depth === 'both' ? i % 2 === 1 : depth === 'sevenths');
  const out: TheoryQuestion[] = [];
  const start = rng.int(types.length);
  // Each kind of single question works through the degrees in a shuffled
  // order, so a set does not ask about the same chord twice.
  const degreeQueues = new Map<DiatonicQuestionType, number[]>();
  const nextDegree = (type: DiatonicQuestionType) => {
    let queue = degreeQueues.get(type);
    if (!queue || queue.length === 0) {
      queue = rng.shuffle([1, 2, 3, 4, 5, 6, 7]);
      degreeQueues.set(type, queue);
    }
    return queue.shift()!;
  };

  for (let i = 0; out.length < count && i < count * 3; i += 1) {
    let type = types[(start + i) % types.length]!;
    if ((type === 'name-notes' || type === 'name-chords') && usedTables.has(type)) {
      if (singles.length === 0) {
        if (usedTables.size === types.length) break;
        continue;
      }
      type = singles[i % singles.length]!;
    }
    const id = `q${out.length + 1}`;
    if (type === 'name-notes') {
      usedTables.add(type);
      out.push(nameNotes(km, rng, id));
    } else if (type === 'name-chords') {
      usedTables.add(type);
      out.push(nameChords(km, sevenths(i) ? 'sevenths' : 'triads', id));
    } else if (type === 'spell-chord') {
      out.push(spellChord(km, rng, sevenths(i), id, nextDegree(type)));
    } else {
      out.push(chordFunction(km, rng, sevenths(i), id, nextDegree(type)));
    }
  }
  return out;
}
