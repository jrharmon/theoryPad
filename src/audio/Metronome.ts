import type { TimeSignature } from '@/domain/phrase';
import { FOUR_FOUR, SIXTEENTH, ticksPerBar, ticksPerBeat } from '@/domain/phrase';
import type { Clock } from '@/domain/time';

export interface MetronomeOptions {
  timeSignature?: TimeSignature;
  /** Ticks of count-in before bar 1 — whole beats, from `countInTicks`. */
  countInTicks?: number;
}

export interface BeatEvent {
  /** Bar index from the metronome's start, counting the count-in negatively. */
  bar: number;
  /** 0-based beat within the bar. */
  beat: number;
  tick: number;
  isDownbeat: boolean;
  isCountIn: boolean;
  audioTime: number;
}

/** One step of the metronome's grid, as a voice hears it. */
export interface GridEvent {
  audioTime: number;
  timeSignature: TimeSignature;
  /** Ticks from the start of this bar. */
  tickInBar: number;
  /** Bar from the current exercise's bar 1; negative through its count-in. */
  bar: number;
  beat: number;
  isDownbeat: boolean;
  isCountIn: boolean;
}

/**
 * What the metronome sounds through: the click, or a drum beat. Kept abstract
 * so tests need no audio.
 */
export interface MetronomeVoice {
  /** Ticks between the events this voice wants. A multiple of a sixteenth. */
  gridTicks(timeSignature: TimeSignature): number;
  at(event: GridEvent): void;
}

export type BeatListener = (event: BeatEvent) => void;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * The finest step any voice asks for. The grid runs at this whatever the voice,
 * and each voice hears only the steps on its own grid — so a voice can be
 * swapped mid-run, between a routine's items, without re-scheduling anything
 * or shifting the beat.
 */
const GRID_TICKS = SIXTEENTH;

/**
 * Beat generation, driven entirely by a Clock — so it is fully testable with
 * FakeClock and produces no sound of its own. Making a noise is the voice's job.
 */
export class Metronome {
  private readonly clock: Clock;
  private voice: MetronomeVoice | null;
  private options: Required<MetronomeOptions>;
  private handles: number[] = [];
  private listeners = new Set<BeatListener>();
  private running = false;
  private muted = false;
  private silenced = false;
  /** A count-in in the middle of the clock — a routine's next item. */
  private extraCountIn: { from: number; to: number } | null = null;

  constructor(
    clock: Clock,
    voice: MetronomeVoice | null = null,
    options: MetronomeOptions = {},
  ) {
    this.clock = clock;
    this.voice = voice;
    this.options = {
      timeSignature: options.timeSignature ?? FOUR_FOUR,
      countInTicks: options.countInTicks ?? 0,
    };
  }

  configure(options: MetronomeOptions): void {
    this.options = { ...this.options, ...options };
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  /** Takes over from the next step of the grid. Safe mid-run. */
  setVoice(voice: MetronomeVoice): void {
    this.voice = voice;
  }

  get countInTicks(): number {
    return this.options.countInTicks;
  }

  onBeat(listener: BeatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    const { timeSignature } = this.options;
    const perBeat = ticksPerBeat(timeSignature);
    const perBar = ticksPerBar(timeSignature);
    const countIn = this.countInTicks;
    const inCountIn = (tick: number) => tick < countIn || this.inExtraCountIn(tick);

    // The beat, for listeners: the playhead and the transport read it.
    this.handles.push(
      this.clock.scheduleRepeat((audioTime, tick) => {
        // The count-in occupies the first bars, so musical bar 0 starts after it.
        const musicalTick = tick - countIn;
        const bar = Math.floor(musicalTick / perBar);
        const beat = Math.floor(mod(musicalTick, perBar) / perBeat);
        for (const listener of this.listeners) {
          listener({
            bar,
            beat,
            tick,
            isDownbeat: beat === 0,
            isCountIn: inCountIn(tick),
            audioTime,
          });
        }
      }, perBeat),
    );

    // The sound.
    this.handles.push(
      this.clock.scheduleRepeat((audioTime, tick) => {
        const voice = this.voice;
        const isCountIn = inCountIn(tick);
        // Muting silences the click but never the count-in: with the click
        // off, the count-in is still how you know when to start.
        if (!voice || this.silenced || (this.muted && !isCountIn)) return;
        // Bars count from this exercise's bar 1 — in a routine, the item that
        // is counting in now — so a beat's backbeat lands where its bar does.
        const fromBarOne = tick - this.barOne(tick);
        const tickInBar = mod(fromBarOne, perBar);
        if (tickInBar % voice.gridTicks(timeSignature) !== 0) return;
        voice.at({
          audioTime,
          timeSignature,
          tickInBar,
          bar: Math.floor(fromBarOne / perBar),
          beat: Math.floor(tickInBar / perBeat),
          isDownbeat: tickInBar === 0,
          isCountIn,
        });
      }, GRID_TICKS),
    );
  }

  stop(): void {
    for (const handle of this.handles) this.clock.clear(handle);
    this.handles = [];
    this.running = false;
    this.extraCountIn = null;
  }

  /**
   * Silence the voice without stopping the beat. Beat listeners keep firing,
   * and the timeline is untouched, so it can be switched mid-bar.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * No sound at all, count-in included: under a backing track the recording
   * is the count-in. Beat listeners still fire.
   */
  setSilenced(silenced: boolean): void {
    this.silenced = silenced;
  }

  /**
   * Treat these ticks as a count-in: they sound even when muted, and `to` is
   * the next exercise's bar 1. For a count-in that does not start at zero, like
   * the one between a routine's items.
   */
  countInBetween(from: number, to: number): void {
    this.extraCountIn = { from, to };
  }

  /** The tick of bar 1 for the exercise sounding at `tick`. */
  private barOne(tick: number): number {
    const extra = this.extraCountIn;
    return extra && tick >= extra.from ? extra.to : this.options.countInTicks;
  }

  private inExtraCountIn(tick: number): boolean {
    return (
      this.extraCountIn !== null &&
      tick >= this.extraCountIn.from &&
      tick < this.extraCountIn.to
    );
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
