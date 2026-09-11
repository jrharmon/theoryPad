import type { FretPosition } from '@/domain/instrument';
import type {
  Articulation,
  Bar,
  Finger,
  NoteRole,
  Phrase,
  TabNote,
  TimeSignature,
} from './types';
import { FOUR_FOUR, PPQ, QUARTER } from './types';
import { expandRhythm, type RhythmPattern } from './rhythm';
import { ticksPerBar } from './time';

/**
 * Builds phrases so generators never do tick arithmetic themselves. The maths
 * is wrong in one place or right in one place; this is that place.
 */

export interface NoteOptions {
  velocity?: number;
  articulation?: Articulation;
  finger?: Finger;
  role?: NoteRole;
  annotation?: string;
  display?: string;
  pickStroke?: 'down' | 'up';
  tied?: boolean;
}

export interface PhraseBuilderOptions {
  timeSignature?: TimeSignature;
  repeat?: number;
}

export class PhraseBuilder {
  private readonly timeSignature: TimeSignature;
  private readonly notes: TabNote[] = [];
  private readonly barLabels = new Map<number, string>();
  private readonly repeat: number | undefined;
  private cursor = 0;
  private defaultDuration = QUARTER;

  constructor(options: PhraseBuilderOptions = {}) {
    this.timeSignature = options.timeSignature ?? FOUR_FOUR;
    this.repeat = options.repeat;
  }

  /** Set the note length used by subsequent `note`/`notes` calls. */
  rhythm(durationTicks: number): this {
    if (durationTicks <= 0) throw new Error(`Duration must be positive, got ${durationTicks}`);
    this.defaultDuration = durationTicks;
    return this;
  }

  /** Append one note at the cursor, then advance the cursor past it. */
  note(position: FretPosition, options: NoteOptions = {}, durationTicks?: number): this {
    const duration = durationTicks ?? this.defaultDuration;
    this.notes.push({
      string: position.string,
      fret: position.fret,
      startTick: this.cursor,
      durationTicks: duration,
      ...options,
    });
    this.cursor += duration;
    return this;
  }

  /** Append a run of notes at the current default length. */
  sequence(positions: FretPosition[], options: NoteOptions = {}): this {
    for (const position of positions) this.note(position, options);
    return this;
  }

  /**
   * Append a run of notes shaped by a rhythm pattern. The pattern cycles, so
   * the same one fits a four-note run or a forty-note one.
   */
  withRhythm(
    positions: FretPosition[],
    pattern: RhythmPattern,
    options: NoteOptions | ((position: FretPosition, index: number) => NoteOptions) = {},
  ): this {
    const timings = expandRhythm(pattern, positions.length);
    const base = this.cursor;

    positions.forEach((position, i) => {
      const timing = timings[i]!;
      const perNote = typeof options === 'function' ? options(position, i) : options;
      this.notes.push({
        string: position.string,
        fret: position.fret,
        startTick: base + timing.startTick,
        durationTicks: timing.durationTicks,
        velocity: timing.velocity,
        ...perNote,
      });
    });

    const last = timings[timings.length - 1];
    this.cursor = last ? base + last.startTick + last.durationTicks : base;
    return this;
  }

  /** Play these notes together, advancing the cursor once. */
  chord(positions: FretPosition[], options: NoteOptions = {}, durationTicks?: number): this {
    const duration = durationTicks ?? this.defaultDuration;
    for (const position of positions) {
      this.notes.push({
        string: position.string,
        fret: position.fret,
        startTick: this.cursor,
        durationTicks: duration,
        ...options,
      });
    }
    this.cursor += duration;
    return this;
  }

  /** Advance the cursor without sounding anything. */
  rest(durationTicks?: number): this {
    this.cursor += durationTicks ?? this.defaultDuration;
    return this;
  }

  /** Advance to the start of the next bar, if not already on one. */
  fillBar(): this {
    const perBar = ticksPerBar(this.timeSignature);
    const into = this.cursor % perBar;
    if (into !== 0) this.cursor += perBar - into;
    return this;
  }

  /** Label the bar the cursor is currently in. */
  labelBar(label: string): this {
    const perBar = ticksPerBar(this.timeSignature);
    this.barLabels.set(Math.floor(this.cursor / perBar), label);
    return this;
  }

  labelBarAt(barIndex: number, label: string): this {
    this.barLabels.set(barIndex, label);
    return this;
  }

  /** Where the cursor is, in ticks. */
  get position(): number {
    return this.cursor;
  }

  build(): Phrase {
    const perBar = ticksPerBar(this.timeSignature);

    // The phrase always ends on a bar line: a partial bar would leave the
    // metronome and the tab grid disagreeing about where the phrase ends.
    const end = Math.max(
      this.cursor,
      ...this.notes.map((n) => n.startTick + n.durationTicks),
      0,
    );
    const barCount = Math.max(1, Math.ceil(end / perBar));
    const totalTicks = barCount * perBar;

    const bars: Bar[] = Array.from({ length: barCount }, (_, index) => {
      const label = this.barLabels.get(index);
      return {
        index,
        startTick: index * perBar,
        timeSignature: this.timeSignature,
        ...(label !== undefined ? { label } : {}),
      };
    });

    const notes = [...this.notes].sort(
      (a, b) => a.startTick - b.startTick || a.string - b.string,
    );

    return {
      ppq: PPQ,
      timeSignature: this.timeSignature,
      bars,
      notes,
      totalTicks,
      ...(this.repeat !== undefined ? { repeat: this.repeat } : {}),
    };
  }
}

export function phraseBuilder(options?: PhraseBuilderOptions): PhraseBuilder {
  return new PhraseBuilder(options);
}

/** An empty phrase of `barCount` bars — for exercises with no written notes. */
export function emptyPhrase(barCount: number, timeSignature: TimeSignature = FOUR_FOUR): Phrase {
  return phraseBuilder({ timeSignature })
    .rest(ticksPerBar(timeSignature) * barCount)
    .build();
}
