import type { Bend, Harmonic, TabNote, Technique } from '@/domain/phrase';

/**
 * What tab writes for a note, beyond its fret: the marks on either side of the
 * number, the marks above the staff, and the runs a mark like palm mute spans.
 */

/**
 * Marks that join a note to the one before it on its string, written in front
 * of the fret — tab writes 5h7, not 5 7h. A slide in from nowhere is written
 * the same way, with nothing before it.
 */
const LEADING: Partial<Record<Technique, string>> = {
  'hammer-on': 'h',
  'pull-off': 'p',
  'slide-up': '/',
  'slide-down': '\\',
  'legato-slide-up': '/',
  'legato-slide-down': '\\',
  'slide-in-below': '/',
  'slide-in-above': '\\',
};

/** Marks that describe the note itself, written after it, in this order. */
const TRAILING: [Technique, string][] = [
  ['slide-out-down', '\\'],
  ['slide-out-up', '/'],
  ['vibrato', '~'],
  ['staccato', '.'],
];

/** Harmonics other than natural ones are named above the staff. */
const HARMONIC_LABEL: Record<Exclude<Harmonic['kind'], 'natural'>, string> = {
  artificial: 'A.H.',
  pinch: 'P.H.',
  tapped: 'T.H.',
  semi: 'S.H.',
};

export interface NoteMarks {
  /** Written in front of the fret. */
  leading: string;
  /** The fret as written: `x` for a dead note, `<12>` for a natural harmonic. */
  digit: string;
  /** In parentheses, full size: a ghost note. */
  ghost: boolean;
  /** Written after the fret: a bend, slides out, vibrato, staccato. */
  trailing: string;
}

export function noteMarks(note: TabNote): NoteMarks {
  const techniques = note.techniques ?? [];
  const leading = techniques.map((t) => LEADING[t] ?? '').join('');
  const trailing =
    (note.bend ? bendText(note.bend) : '') +
    TRAILING.filter(([t]) => techniques.includes(t))
      .map(([, glyph]) => glyph)
      .join('');

  const fret = note.display ?? String(note.fret);
  const digit = techniques.includes('dead')
    ? 'x'
    : note.harmonic?.kind === 'natural'
      ? `<${fret}>`
      : fret;

  return { leading, digit, ghost: techniques.includes('ghost'), trailing };
}

/**
 * A bend in line: `b`, `pb` for a pre-bend, and `r` when it comes back down.
 * How far it goes is written above the staff, the way Guitar Pro writes it:
 * text tab's `7b9` was too wide for a column once notes were eighths apart.
 */
export function bendText(bend: Bend): string {
  const tones = bend.points.map((p) => p.tones);
  if (tones.length === 0) return '';
  const peak = Math.max(...tones);
  const pre = tones[0]! > 0;
  const release = tones[tones.length - 1]! < peak;
  return `${pre ? 'pb' : 'b'}${release ? 'r' : ''}`;
}

/** How far a bend goes, as written over it: ¼, ½, full, 1½. */
export function bendAmount(bend: Bend): string {
  const peak = Math.max(0, ...bend.points.map((p) => p.tones));
  if (peak === 1) return 'full';
  const whole = Math.floor(peak);
  const fraction = ({ 0.25: '¼', 0.5: '½', 0.75: '¾' } as Record<number, string>)[peak - whole];
  if (fraction === undefined) return String(peak);
  return `${whole > 0 ? whole : ''}${fraction}`;
}

/** What a note puts above the staff: an accent, a tap, a harmonic's kind, a bend's amount. */
function marksAbove(note: TabNote): string[] {
  const techniques = note.techniques ?? [];
  return [
    ...(techniques.includes('accent') ? ['>'] : []),
    ...(techniques.includes('tap') ? ['T'] : []),
    ...(note.harmonic && note.harmonic.kind !== 'natural'
      ? [HARMONIC_LABEL[note.harmonic.kind]]
      : []),
    ...(note.bend ? [bendAmount(note.bend)] : []),
  ];
}

export interface BeatMark {
  startTick: number;
  text: string;
}

/**
 * The marks above the staff, one entry per tick that has any, the notes of a
 * chord sharing it. Grace notes have no column of their own, so theirs go
 * unwritten.
 */
export function beatMarks(notes: readonly TabNote[]): BeatMark[] {
  const byTick = new Map<number, string[]>();
  for (const note of notes) {
    if (note.grace) continue;
    const marks = marksAbove(note);
    if (marks.length === 0) continue;
    const here = byTick.get(note.startTick) ?? [];
    for (const mark of marks) if (!here.includes(mark)) here.push(mark);
    byTick.set(note.startTick, here);
  }
  return [...byTick]
    .sort(([a], [b]) => a - b)
    .map(([startTick, marks]) => ({ startTick, text: marks.join(' ') }));
}

export interface MarkSpan {
  startTick: number;
  endTick: number;
}

/**
 * Where a mark like palm mute is drawn once over a run instead of on every
 * note. A run is every played moment in a row with the technique on some note
 * there; a moment without it ends the run, while a held note doesn't. It runs
 * to the end of its last note.
 */
export function techniqueSpans(notes: readonly TabNote[], technique: Technique): MarkSpan[] {
  const ticks = [...new Set(notes.filter((n) => !n.grace).map((n) => n.startTick))].sort(
    (a, b) => a - b,
  );
  const spans: MarkSpan[] = [];
  let open: MarkSpan | null = null;

  for (const tick of ticks) {
    const marked = notes.filter(
      (n) => !n.grace && n.startTick === tick && n.techniques?.includes(technique),
    );
    if (marked.length === 0) {
      open = null;
      continue;
    }
    const end = Math.max(...marked.map((n) => n.startTick + n.durationTicks));
    if (open) open.endTick = Math.max(open.endTick, end);
    else {
      open = { startTick: tick, endTick: end };
      spans.push(open);
    }
  }
  return spans;
}
