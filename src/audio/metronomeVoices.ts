import type { DrumPattern, DrumSound } from '@/domain/drums';
import type { TimeSignature } from '@/domain/phrase';
import { ticksPerBeat } from '@/domain/phrase';
import type { GridEvent, MetronomeVoice } from './Metronome';

/** The synthesised click. */
export interface ClickSink {
  click(audioTime: number, kind: 'accent' | 'beat' | 'subdivision'): void;
}

/** The sample kit: plays what it has loaded. */
export interface DrumSink {
  has(sound: DrumSound): boolean;
  play(sound: DrumSound, audioTime: number, velocity: number): void;
}

const COUNT_IN_DOWNBEAT = 1;
const COUNT_IN_BEAT = 0.7;

/**
 * The click: a high tick on every beat, accented on the downbeat, with
 * optional quieter subdivisions. It counts in on the stick when the kit has
 * it, and on the click itself when not — Off loads no samples at all.
 */
export class ClickVoice implements MetronomeVoice {
  private readonly click: ClickSink;
  private readonly kit: DrumSink | null;
  private readonly accentFirstBeat: boolean;
  private readonly subdivision: 1 | 2 | 4;

  constructor(
    click: ClickSink,
    kit: DrumSink | null = null,
    options: { accentFirstBeat?: boolean; subdivision?: 1 | 2 | 4 } = {},
  ) {
    this.click = click;
    this.kit = kit;
    this.accentFirstBeat = options.accentFirstBeat ?? true;
    this.subdivision = options.subdivision ?? 1;
  }

  gridTicks(timeSignature: TimeSignature): number {
    return ticksPerBeat(timeSignature) / this.subdivision;
  }

  at(event: GridEvent): void {
    const onBeat = event.tickInBar % ticksPerBeat(event.timeSignature) === 0;
    if (event.isCountIn && onBeat && this.kit?.has('stick')) {
      const velocity = event.isDownbeat ? COUNT_IN_DOWNBEAT : COUNT_IN_BEAT;
      this.kit.play('stick', event.audioTime, velocity);
      return;
    }
    const kind = !onBeat
      ? 'subdivision'
      : event.isDownbeat && this.accentFirstBeat
        ? 'accent'
        : 'beat';
    this.click.click(event.audioTime, kind);
  }
}

/**
 * A drum beat doing the metronome's job. It counts in on an open hat, louder
 * on the downbeat — a stick count-in into a kit sounds like two machines.
 *
 * Until the kit has every drum it needs — still loading, or failed — it plays
 * the click instead. Samples are a nicety; the time must never go silent.
 */
export class DrumVoice implements MetronomeVoice {
  private readonly pattern: DrumPattern;
  private readonly kit: DrumSink;
  private readonly fallback: MetronomeVoice;
  private readonly needs: readonly DrumSound[];
  private cached: {
    bar: number;
    timeSignature: TimeSignature;
    hits: ReturnType<DrumPattern['bar']>;
  } | null = null;

  constructor(
    pattern: DrumPattern,
    kit: DrumSink,
    fallback: MetronomeVoice,
    needs: readonly DrumSound[],
  ) {
    this.pattern = pattern;
    this.kit = kit;
    this.fallback = fallback;
    this.needs = needs;
  }

  private get ready(): boolean {
    return this.needs.every((sound) => this.kit.has(sound));
  }

  gridTicks(timeSignature: TimeSignature): number {
    return this.ready
      ? this.pattern.gridTicks(timeSignature)
      : this.fallback.gridTicks(timeSignature);
  }

  at(event: GridEvent): void {
    if (!this.ready) {
      // The fallback's grid may be coarser than the one this step came from.
      if (event.tickInBar % this.fallback.gridTicks(event.timeSignature) === 0) {
        this.fallback.at(event);
      }
      return;
    }
    if (event.isCountIn) {
      if (event.tickInBar % ticksPerBeat(event.timeSignature) !== 0) return;
      const velocity = event.isDownbeat ? COUNT_IN_DOWNBEAT : COUNT_IN_BEAT;
      this.kit.play('hat-open', event.audioTime, velocity);
      return;
    }
    for (const hit of this.barHits(event)) {
      if (hit.tick === event.tickInBar) this.kit.play(hit.sound, event.audioTime, hit.velocity);
    }
  }

  private barHits(event: GridEvent) {
    const { bar, timeSignature } = event;
    if (this.cached?.bar !== bar || this.cached.timeSignature !== timeSignature) {
      this.cached = { bar, timeSignature, hits: this.pattern.bar(timeSignature, bar) };
    }
    return this.cached.hits;
  }
}
