import type {
  ChordFunction,
  KeyMode,
  ScaleId,
  SeventhQuality,
  TriadQuality,
} from '@/domain/music';
import {
  chordOnDegree,
  diatonicChords,
  harmonyOf,
  keyModeName,
  keySignature,
  scaleDegrees,
  scaleNotes,
} from '@/domain/music';
import type { Rng } from '@/domain/variation';
import {
  noteDistractors,
  plainDistractors,
  spellingDistractors,
  wantsTrick,
  withCorrect,
} from './distractors';
import type {
  MultiPickQuestion,
  SinglePickQuestion,
  TableFillQuestion,
  TheoryQuestion,
} from './types';

export type DiatonicQuestionType =
  'name-notes' | 'name-chords' | 'spell-chord' | 'chord-function';
export type ChordDepth = 'triads' | 'sevenths' | 'both';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

const TRIAD_LABEL: Record<TriadQuality, string> = {
  maj: 'maj',
  min: 'min',
  dim: 'dim',
  aug: 'aug',
};
const SEVENTH_LABEL: Record<SeventhQuality, string> = {
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  min7b5: 'm7b5',
  dim7: 'dim7',
  minMaj7: 'mMaj7',
  maj7sharp5: 'maj7#5',
};
/** What the table offers: every quality a mode produces, and one that none does. */
const TRIAD_OPTIONS: TriadQuality[] = ['maj', 'min', 'dim', 'aug'];
const SEVENTH_OPTIONS: SeventhQuality[] = ['maj7', 'min7', 'dom7', 'min7b5', 'dim7'];
/** Harmonic and melodic minor add these; a Major key never offers them. */
const MINOR_SEVENTH_OPTIONS: SeventhQuality[] = [...SEVENTH_OPTIONS, 'minMaj7', 'maj7sharp5'];

/** How each scale other than Major is made, from a scale the player knows. */
const SCALE_ORIGIN: Record<Exclude<ScaleId, 'major'>, (tonic: string) => string> = {
  'minor-pentatonic': (t) => `${t} Aeolian without its 2nd and 6th`,
  'major-pentatonic': (t) => `${t} major without its 4th and 7th`,
  blues: (t) => `${t} minor pentatonic with a ♭5 added`,
  'harmonic-minor': (t) => `${t} natural minor with its 7th raised`,
  'phrygian-dominant': (t) => `${t} Phrygian with its 3rd raised`,
  'melodic-minor': (t) => `${t} natural minor with its 6th and 7th raised`,
};

function parentMajorNote(km: KeyMode): string {
  if (km.scale !== 'major') return SCALE_ORIGIN[km.scale](km.tonic);
  const sig = keySignature(km);
  return km.mode === 'ionian'
    ? `${km.tonic} major`
    : `${sig.relativeMajor} major, starting on its ${ORDINAL[scaleDegreesFromMajor(km)]} note`;
}

function scaleDegreesFromMajor(km: KeyMode): number {
  const order = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
  return order.indexOf(km.mode);
}

/**
 * "Name the notes of D Dorian." The tonic is in the question; the others are
 * asked for — the scale's own, so a pentatonic asks for four.
 */
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
      // Mostly the key's other notes — you have to know which is which — and
      // now and then a spelling trap.
      const wrong = wantsTrick(rng)
        ? noteDistractors(note, rng)
        : plainDistractors(
            note,
            notes.filter((n) => n !== note && n !== km.tonic),
            rng,
          );
      const { items, index } = withCorrect(note, wrong, rng);
      return {
        id: `${id}-${i + 2}`,
        given: { degree: degrees[i + 1]!.label },
        options: items.map((p) => ({ id: p, label: p })),
        correctOptionId: items[index]!,
      };
    }),
    feedback: {
      rule: `${keyModeName(km)} is ${parentMajorNote(km)}: ${notes.join(' ')}.`,
      visual: { kind: 'note-row', keyMode: km, highlight: notes.map((_, i) => i + 1) },
    },
  };
}

/** "Pick the quality of each chord. The root is given." */
export function nameChords(
  km: KeyMode,
  depth: 'triads' | 'sevenths',
  id: string,
): TableFillQuestion {
  // A pentatonic has no chords of its own: the questions are about its parent
  // mode's, named plainly — the brief says once whose they are (decision 20).
  const harmony = harmonyOf(km);
  const name = keyModeName(harmony);
  const chords = diatonicChords(harmony);
  const sevenths = harmony.scale === 'major' ? SEVENTH_OPTIONS : MINOR_SEVENTH_OPTIONS;
  const options =
    depth === 'triads'
      ? TRIAD_OPTIONS.map((q) => ({ id: q, label: TRIAD_LABEL[q] }))
      : sevenths.map((q) => ({ id: q, label: SEVENTH_LABEL[q] }));
  const symbols = chords.map((c) => (depth === 'triads' ? c.triadSymbol : c.seventhSymbol));
  return {
    kind: 'table-fill',
    id,
    subject: keyModeName(km),
    prompt: `Pick the quality of each ${depth === 'triads' ? 'triad' : '7th chord'} in ${name}.`,
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
    feedback: { rule: `In ${name}: ${symbols.join(', ')}.` },
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
  // A chord question is always about seven chords: a pentatonic asks its parent's.
  const harmony = harmonyOf(km);
  const { symbol, notes } = chordFor(harmony, degree, sevenths);
  // Mostly the key's other chords; now and then one note wrong in this one.
  const trick = wantsTrick(rng);
  const others = [1, 2, 3, 4, 5, 6, 7]
    .filter((d) => d !== degree)
    .map((d) => chordFor(harmony, d, sevenths));
  const wrong = trick
    ? spellingDistractors(notes, rng)
    : plainDistractors(
        notes,
        others.map((o) => o.notes),
        rng,
      );
  const { items, index } = withCorrect(notes, wrong, rng);
  const options = items.map((spelled, i) => ({ id: `${id}-${i}`, label: spelled.join(' ') }));

  const whatItIs: Record<string, string> = {};
  items.forEach((spelled, i) => {
    if (i === index) return;
    const other = others.find((o) => o.notes.join(' ') === spelled.join(' '));
    if (other) {
      whatItIs[options[i]!.id] = `That’s ${other.symbol}.`;
      return;
    }
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
      rule: `${symbol} is ${notes.join(' ')}: the ${ORDINAL[degree - 1]} degree of ${keyModeName(harmony)}, with every other note of the key stacked on it.`,
      whatItIs,
      visual: {
        kind: 'note-row',
        keyMode: harmony,
        highlight: [0, 2, 4, 6].slice(0, notes.length).map((k) => ((degree - 1 + k) % 7) + 1),
      },
    },
  };
}

/** The chord families, in the order a question offers them. */
const FAMILIES = ['tonic', 'subdominant', 'dominant'] as const;

const COUNT_WORD = ['no', 'one', 'two', 'three', 'four'];

/** "2nd and 4th", "1st, 3rd and 6th" — not "1st and 3rd and 6th". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * "Which chords are the subdominant family in D Dorian?" — tick every one.
 *
 * A family is two or three chords, not one, which is the whole point: the
 * 2nd and the 4th are both subdominant. Asking for a single chord is what
 * made the old degree-name version of this question misleading.
 */
export function chordFamily(
  km: KeyMode,
  rng: Rng,
  sevenths: boolean,
  id: string,
  family: ChordFunction = FAMILIES[rng.int(FAMILIES.length)]!,
): MultiPickQuestion {
  // The families come off the chords themselves, so this question and the
  // key/mode reference can never drift apart.
  const harmony = harmonyOf(km);
  const name = keyModeName(harmony);
  const chords = diatonicChords(harmony);
  const degrees = rng.shuffle(chords.map((c) => c.degree.number));
  const options = degrees.map((d) => ({
    id: `${id}-${d}`,
    label: chordFor(harmony, d, sevenths).symbol,
  }));
  const inFamily = (d: number) => chords[d - 1]!.function === family;
  const correct = degrees.filter(inFamily);
  const members = chords.filter((c) => c.function === family).map((c) => c.degree.number);

  const whatItIs: Record<string, string> = {};
  for (const d of degrees) {
    if (inFamily(d)) continue;
    whatItIs[`${id}-${d}`] =
      `${chordFor(harmony, d, sevenths).symbol} is the ${ORDINAL[d - 1]} — ${chords[d - 1]!.function} family.`;
  }

  return {
    kind: 'multi-pick',
    id,
    subject: keyModeName(km),
    prompt: `Which chords are the ${family} family in ${name}?`,
    note: `${COUNT_WORD[members.length]!.replace(/^./, (c) => c.toUpperCase())} of them.`,
    options,
    correctOptionIds: correct.map((d) => `${id}-${d}`),
    feedback: {
      rule: `The ${family} family in ${name} is the ${listOf(
        members.map((d) => ORDINAL[d - 1]!),
      )}: ${listOf(members.map((d) => chordFor(harmony, d, sevenths).symbol))}.`,
      whatItIs,
      visual: { kind: 'note-row', keyMode: harmony, highlight: members },
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
  // Only three families, so they take turns rather than being drawn at random:
  // a set of four should not ask about the dominant three times.
  let familyQueue: ChordFunction[] = [];
  const nextFamily = () => {
    if (familyQueue.length === 0) familyQueue = rng.shuffle([...FAMILIES]);
    return familyQueue.shift()!;
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
      out.push(chordFamily(km, rng, sevenths(i), id, nextFamily()));
    }
  }
  return out;
}
