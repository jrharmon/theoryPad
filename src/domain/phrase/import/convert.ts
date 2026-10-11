import type { KeyMode, NoteName } from '@/domain/music';
import { midi, noteNameFromMidi, pitchClass } from '@/domain/music';
import type { Bar, Phrase, TabNote, Technique, TimeSignature } from '../types';
import { PPQ, WHOLE } from '../types';
import { ticksPerBar } from '../time';
import type { GpBeat, GpMasterBar, GpNote, GpRhythm, GpScore } from './score';
import { GP_SLIDE } from './score';

/**
 * A Guitar Pro score, one track and a range of bars → a phrase.
 *
 * Repeats, endings and jumps are written out; voices are merged; a tempo
 * change in the range is ignored and listed (decision 21); a change of time
 * signature is refused (decision 7). Everything the tab can't show is listed
 * as dropped.
 */

/** The bars to import, 0-based and inclusive, as the file numbers them. */
export interface ImportRange {
  track: number;
  firstBar: number;
  lastBar: number;
}

export interface ImportedPhrase {
  phrase: Phrase;
  /** The track's tuning, lowest string first. */
  tuning: NoteName[];
  capo: number;
  keyMode: KeyMode;
  /** What the tab won't show, for the player to read: "trill on 2 notes". */
  dropped: string[];
  /** The section marker the range starts on, or the file's title. */
  name: string;
}

export type ImportResult =
  | { ok: true; value: ImportedPhrase }
  | { ok: false; reason: string; /** 1-based, as Guitar Pro shows it. */ bar: number };

/** Past this many bars, the repeats and jumps are taken never to end. */
const MAX_PLAYED_BARS = 2000;

/** A beat's length in ticks, unrounded: a tuplet need not land on a whole tick. */
export function rhythmTicks(rhythm: GpRhythm): number {
  const plain = WHOLE / rhythm.value;
  const dotted = plain * (2 - 1 / 2 ** rhythm.dots);
  return rhythm.tuplet ? (dotted * rhythm.tuplet.den) / rhythm.tuplet.num : dotted;
}

/** Tracks with a tuning and at least one note in the bars. Drums have no tuning. */
export function playableTracks(score: GpScore, firstBar: number, lastBar: number): number[] {
  return score.tracks.flatMap((track, index) => {
    if (track.tuning.length === 0) return [];
    const bars = track.bars.slice(firstBar, lastBar + 1);
    const hasNotes = bars.some((voices) =>
      voices.some((beats) => beats.some((beat) => beat.notes.length > 0)),
    );
    return hasNotes ? [index] : [];
  });
}

interface PlayedBar {
  /** The master bar in the file. */
  source: number;
  /** Written above the bar: "×2", "D.S. al Coda". */
  mark?: string;
}

const JUMP_LABEL: Record<string, string> = {
  DaCapo: 'D.C.',
  DaCapoAlCoda: 'D.C. al Coda',
  DaCapoAlDoubleCoda: 'D.C. al Double Coda',
  DaCapoAlFine: 'D.C. al Fine',
  DaSegno: 'D.S.',
  DaSegnoAlCoda: 'D.S. al Coda',
  DaSegnoAlDoubleCoda: 'D.S. al Double Coda',
  DaSegnoAlFine: 'D.S. al Fine',
  DaSegnoSegno: 'D.S.S.',
  DaSegnoSegnoAlCoda: 'D.S.S. al Coda',
  DaSegnoSegnoAlDoubleCoda: 'D.S.S. al Double Coda',
  DaSegnoSegnoAlFine: 'D.S.S. al Fine',
};

/** Where a D.C. or D.S. lands, and what it ends on after. */
function jumpPlan(jump: string): { to: 'start' | 'Segno' | 'SegnoSegno'; then?: string } {
  const to = jump.startsWith('DaCapo')
    ? 'start'
    : jump.startsWith('DaSegnoSegno')
      ? 'SegnoSegno'
      : 'Segno';
  const then = jump.endsWith('AlDoubleCoda')
    ? 'DoubleCoda'
    : jump.endsWith('AlCoda')
      ? 'Coda'
      : jump.endsWith('AlFine')
        ? 'Fine'
        : undefined;
  return then ? { to, then } : { to };
}

/**
 * The bars in the order they are played. Repeats go back to the last repeat
 * start in the range (or its first bar); alternate endings play on their
 * passes; a D.C. or D.S. is taken once, after which repeats are not taken
 * again and "To Coda" or "Fine" applies. A jump to a sign outside the range is
 * left out, and said.
 */
function playOrder(
  bars: readonly GpMasterBar[],
  firstBar: number,
  lastBar: number,
  notes: string[],
): PlayedBar[] | null {
  const order: PlayedBar[] = [];
  const passes = new Map<number, number>();
  const jumpsTaken = new Set<number>();
  const find = (target: string, after = firstBar) => {
    for (let i = Math.max(firstBar, after); i <= lastBar; i += 1) {
      if (bars[i]!.targets.includes(target)) return i;
    }
    return -1;
  };

  let repeatStart = firstBar;
  let pass = 1;
  let cameBack = false;
  let afterJump: string | undefined; // what a taken D.C./D.S. ends on, or '' for nothing
  let mark: string | undefined;

  let i = firstBar;
  while (i <= lastBar) {
    if (order.length > MAX_PLAYED_BARS) return null;
    const bar = bars[i]!;
    if (bar.repeatStart && !cameBack) {
      repeatStart = i;
      pass = 1;
    }
    cameBack = false;
    if (bar.alternateEndings.length > 0 && !bar.alternateEndings.includes(pass)) {
      i += 1;
      continue;
    }
    order.push(mark ? { source: i, mark } : { source: i });
    mark = undefined;

    if (afterJump === 'Fine' && bar.targets.includes('Fine')) break;

    if (bar.repeatEnd > 1 && afterJump === undefined) {
      const played = passes.get(i) ?? 1;
      if (played < bar.repeatEnd) {
        passes.set(i, played + 1);
        pass = played + 1;
        mark = `×${pass}`;
        i = repeatStart;
        cameBack = true;
        continue;
      }
      pass = 1;
    }

    let next = i + 1;
    for (const jump of bar.jumps) {
      if (jump === 'DaCoda' || jump === 'DaDoubleCoda') {
        const target = jump === 'DaCoda' ? 'Coda' : 'DoubleCoda';
        if (afterJump !== target) continue;
        const to = find(target, i + 1);
        if (to < 0)
          notes.push(
            `To ${target === 'Coda' ? 'Coda' : 'Double Coda'} at bar ${i + 1} ignored: its sign is outside the bars`,
          );
        else {
          next = to;
          mark = target === 'Coda' ? 'Coda' : 'Double Coda';
        }
        break;
      }
      const label = JUMP_LABEL[jump];
      if (!label || jumpsTaken.has(i)) continue;
      jumpsTaken.add(i);
      const plan = jumpPlan(jump);
      const to = plan.to === 'start' ? firstBar : find(plan.to);
      if (to < 0) {
        notes.push(`${label} at bar ${i + 1} ignored: its sign is outside the bars`);
        continue;
      }
      afterJump = plan.then ?? '';
      next = to;
      mark = label;
      break;
    }
    i = next;
  }
  return order;
}

/**
 * The range is one repeated block, start to end, and nothing else jumps: it
 * is stored once with `repeat`, so "4 bars ×4" stays four bars on screen.
 */
function wholeRangeRepeat(bars: readonly GpMasterBar[], firstBar: number, lastBar: number) {
  const range = bars.slice(firstBar, lastBar + 1);
  const last = range[range.length - 1]!;
  const plain = range.every(
    (bar, i) =>
      bar.alternateEndings.length === 0 &&
      bar.jumps.length === 0 &&
      (i === range.length - 1 || bar.repeatEnd <= 1) &&
      (i === 0 || !bar.repeatStart),
  );
  return plain && last.repeatEnd > 1 ? last.repeatEnd : null;
}

const MAJOR_BY_SHARPS = [
  'Cb',
  'Gb',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
];
const MINOR_BY_SHARPS = [
  'Ab',
  'Eb',
  'Bb',
  'F',
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'G#',
  'D#',
  'A#',
];

/** A key signature as a key: major, or minor as Aeolian. */
export function keyFromSignature(key: GpMasterBar['key']): KeyMode {
  const index = Math.max(-7, Math.min(7, key.accidentals)) + 7;
  return key.minor
    ? { tonic: pitchClass(MINOR_BY_SHARPS[index]!), scale: 'major', mode: 'aeolian' }
    : { tonic: pitchClass(MAJOR_BY_SHARPS[index]!), scale: 'major', mode: 'ionian' };
}

const timeLabel = (t: GpMasterBar['time']) => `${t.beats}/${t.unit}`;

/** A note being placed, with where it came from. */
interface Placed {
  gp: GpNote;
  beat: GpBeat;
  startTick: number;
  durationTicks: number;
}

/** Counted for the dropped list, once per place in the file however often it plays. */
class Dropped {
  private readonly counts = new Map<string, { notes: number; beats: number; bars: number }>();
  readonly notes: string[] = [];

  add(label: string, unit: 'notes' | 'beats' | 'bars') {
    const count = this.counts.get(label) ?? { notes: 0, beats: 0, bars: 0 };
    count[unit] += 1;
    this.counts.set(label, count);
  }

  list(): string[] {
    const counted = [...this.counts].map(([label, count]) => {
      const [unit, n] = count.notes
        ? ['note', count.notes]
        : count.beats
          ? ['beat', count.beats]
          : ['bar', count.bars];
      return `${label} on ${n} ${unit}${n === 1 ? '' : 's'}`;
    });
    return [...counted, ...this.notes];
  }
}

export function importPhrase(score: GpScore, range: ImportRange): ImportResult {
  const { firstBar, lastBar } = range;
  const track = score.tracks[range.track];
  if (!track || track.tuning.length === 0) {
    return { ok: false, reason: 'That track has no strings to read.', bar: firstBar + 1 };
  }
  const bars = score.masterBars;
  if (firstBar < 0 || lastBar >= bars.length || firstBar > lastBar) {
    return { ok: false, reason: 'Those bars are not in the file.', bar: firstBar + 1 };
  }

  const dropped = new Dropped();
  const repeat = wholeRangeRepeat(bars, firstBar, lastBar);
  const order: PlayedBar[] | null =
    repeat !== null
      ? Array.from({ length: lastBar - firstBar + 1 }, (_, i) => ({ source: firstBar + i }))
      : playOrder(bars, firstBar, lastBar, dropped.notes);
  if (order === null) {
    return {
      ok: false,
      reason: 'The repeats and jumps never come to an end.',
      bar: firstBar + 1,
    };
  }

  const first = bars[firstBar]!;
  const sources = [...new Set(order.map((b) => b.source))].sort((a, b) => a - b);
  const meterChange = sources.find((s) => timeLabel(bars[s]!.time) !== timeLabel(first.time));
  if (meterChange !== undefined) {
    return {
      ok: false,
      reason: `The time signature changes to ${timeLabel(bars[meterChange]!.time)} at bar ${meterChange + 1}.`,
      bar: meterChange + 1,
    };
  }

  const timeSignature = { beats: first.time.beats, unit: first.time.unit } as TimeSignature;
  const perBar = ticksPerBar(timeSignature);

  // Tempo: the one in force at the first bar; later ones are ignored (decision 21).
  const before = score.tempos.filter((t) => t.bar <= firstBar);
  const writtenTempo = before[before.length - 1]?.bpm ?? score.tempos[0]?.bpm ?? 120;
  let tempo = writtenTempo;
  for (const change of score.tempos.filter((t) => t.bar > firstBar && t.bar <= lastBar)) {
    if (change.bpm === tempo) continue;
    dropped.notes.push(`tempo change to ${change.bpm} at bar ${change.bar + 1} ignored`);
    tempo = change.bpm;
  }
  let key = first.key;
  for (const s of sources) {
    const bar = bars[s]!;
    if (bar.key.accidentals !== key.accidentals || bar.key.minor !== key.minor) {
      dropped.notes.push(`key change at bar ${s + 1} ignored`);
      key = bar.key;
    }
    for (const label of bar.unsupported) dropped.add(label, 'bars');
    for (const voice of track.bars[s] ?? []) {
      for (const beat of voice) {
        for (const label of beat.unsupported) dropped.add(label, 'beats');
        for (const note of beat.notes)
          for (const label of note.unsupported) dropped.add(label, 'notes');
      }
    }
  }

  // Place every note, bar by bar in played order; voices are merged.
  const placed: Placed[] = [];
  let overfull = false;
  order.forEach(({ source }, index) => {
    const barStart = index * perBar;
    for (const voice of track.bars[source] ?? []) {
      let position = 0;
      for (const beat of voice) {
        const length = rhythmTicks(beat.rhythm);
        const start = Math.round(position);
        if (start >= perBar) {
          overfull = true;
          break;
        }
        const durationTicks = beat.grace
          ? Math.max(1, Math.round(length))
          : Math.max(1, Math.round(position + length) - start);
        for (const gp of beat.notes) {
          placed.push({ gp, beat, startTick: barStart + start, durationTicks });
        }
        if (!beat.grace) position += length;
      }
    }
  });
  if (overfull) dropped.notes.push('notes past the end of a full bar left out');

  // Graces sound before the note on their beat, so they come first.
  placed.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      Number(!a.beat.grace) - Number(!b.beat.grace) ||
      a.gp.string - b.gp.string,
  );

  const notes: TabNote[] = [];
  const lastOnString = new Map<number, { note: TabNote; gp: GpNote }>();
  const taken = new Set<string>();
  for (const { gp, beat, startTick, durationTicks } of placed) {
    if (gp.string < 0 || gp.string >= track.tuning.length) continue;
    // Two voices on one string at one moment: the first one written wins.
    const key = `${gp.string}:${startTick}:${beat.grace ?? ''}`;
    if (taken.has(key)) continue;
    taken.add(key);

    const previous = lastOnString.get(gp.string);
    const techniques: Technique[] = [];
    if (previous && previous.gp.slide & (GP_SLIDE.shift | GP_SLIDE.legato)) {
      const legato = (previous.gp.slide & GP_SLIDE.legato) !== 0;
      const up = gp.fret > previous.note.fret;
      if (gp.fret !== previous.note.fret) {
        techniques.push(
          legato
            ? up
              ? 'legato-slide-up'
              : 'legato-slide-down'
            : up
              ? 'slide-up'
              : 'slide-down',
        );
      }
    }
    if (gp.hopoDestination && techniques.length === 0) {
      techniques.push(previous && gp.fret < previous.note.fret ? 'pull-off' : 'hammer-on');
    }
    if (gp.slide & GP_SLIDE.inBelow) techniques.push('slide-in-below');
    if (gp.slide & GP_SLIDE.inAbove) techniques.push('slide-in-above');
    techniques.push(...gp.techniques);
    if (gp.slide & GP_SLIDE.outDown) techniques.push('slide-out-down');
    if (gp.slide & GP_SLIDE.outUp) techniques.push('slide-out-up');

    // A tie from before the range has nothing to continue: the note is picked.
    const tied = gp.tied && previous !== undefined;
    const note: TabNote = {
      string: gp.string,
      fret: gp.fret,
      startTick,
      durationTicks,
      ...(techniques.length > 0 ? { techniques } : {}),
      ...(gp.bend ? { bend: gp.bend } : {}),
      ...(gp.harmonic ? { harmonic: gp.harmonic } : {}),
      ...(beat.grace ? { grace: beat.grace } : {}),
      ...(beat.pickStroke ? { pickStroke: beat.pickStroke } : {}),
      ...(tied ? { tied } : {}),
    };
    notes.push(note);
    lastOnString.set(gp.string, { note, gp });
  }
  notes.sort((a, b) => a.startTick - b.startTick || a.string - b.string);

  const phraseBars: Bar[] = order.map(({ source, mark }, index) => {
    const label = [bars[source]!.section, mark].filter(Boolean).join(' · ');
    return {
      index,
      startTick: index * perBar,
      timeSignature,
      ...(label ? { label } : {}),
    };
  });

  const phrase: Phrase = {
    ppq: PPQ,
    timeSignature,
    bars: phraseBars,
    notes,
    totalTicks: order.length * perBar,
    writtenTempo,
    ...(repeat !== null ? { repeat } : {}),
  };

  return {
    ok: true,
    value: {
      phrase,
      tuning: track.tuning.map((pitch) => noteNameFromMidi(midi(pitch))),
      capo: track.capo,
      keyMode: keyFromSignature(first.key),
      dropped: dropped.list(),
      name: first.section ?? (score.title.trim() || 'Untitled'),
    },
  };
}
