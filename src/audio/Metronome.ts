import type { TimeSignature } from '@/domain/phrase';
import { FOUR_FOUR, ticksPerBar, ticksPerBeat } from '@/domain/phrase';
import type { Clock } from '@/domain/time';

export interface MetronomeOptions {
  timeSignature?: TimeSignature;
  accentFirstBeat?: boolean;
  /** Extra clicks per beat, quieter. 1 is off. */
  subdivision?: 1 | 2 | 4;
  countInBars?: 0 | 1 | 2;
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

/** What the metronome asks to be sounded. Kept abstract so tests need no audio. */
export interface ClickSink {
  click(audioTime: number, kind: 'accent' | 'beat' | 'subdivision'): void;
}

export type BeatListener = (event: BeatEvent) => void;

/**
 * Beat generation, driven entirely by a Clock — so it is fully testable with
 * FakeClock and produces no sound of its own. Actually making a noise is the
 * ClickSink's job.
 */
export class Metronome {
  private readonly clock: Clock;
  private readonly sink: ClickSink | null;
  private options: Required<MetronomeOptions>;
  private handles: number[] = [];
  private listeners = new Set<BeatListener>();
  private running = false;

  constructor(clock: Clock, sink: ClickSink | null = null, options: MetronomeOptions = {}) {
    this.clock = clock;
    this.sink = sink;
    this.options = {
      timeSignature: options.timeSignature ?? FOUR_FOUR,
      accentFirstBeat: options.accentFirstBeat ?? true,
      subdivision: options.subdivision ?? 1,
      countInBars: options.countInBars ?? 0,
    };
  }

  configure(options: MetronomeOptions): void {
    this.options = { ...this.options, ...options };
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  get countInTicks(): number {
    return ticksPerBar(this.options.timeSignature) * this.options.countInBars;
  }

  onBeat(listener: BeatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    const { timeSignature, subdivision } = this.options;
    const perBeat = ticksPerBeat(timeSignature);
    const perBar = ticksPerBar(timeSignature);
    const countIn = this.countInTicks;

    this.handles.push(
      this.clock.scheduleRepeat((audioTime, tick) => {
        // The count-in occupies the first bars, so musical bar 0 starts after it.
        const musicalTick = tick - countIn;
        const isCountIn = musicalTick < 0;
        const bar = Math.floor(musicalTick / perBar);
        const beat = Math.floor(((musicalTick % perBar) + perBar) % perBar / perBeat);
        const isDownbeat = beat === 0;

        this.sink?.click(
          audioTime,
          isDownbeat && this.options.accentFirstBeat ? 'accent' : 'beat',
        );
        for (const listener of this.listeners) {
          listener({ bar, beat, tick, isDownbeat, isCountIn, audioTime });
        }
      }, perBeat),
    );

    if (subdivision > 1) {
      const step = perBeat / subdivision;
      this.handles.push(
        this.clock.scheduleRepeat((audioTime, tick) => {
          // The beat itself is already clicked above.
          if (tick % perBeat === 0) return;
          this.sink?.click(audioTime, 'subdivision');
        }, step),
      );
    }
  }

  stop(): void {
    for (const handle of this.handles) this.clock.clear(handle);
    this.handles = [];
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
