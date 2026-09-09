import * as Tone from 'tone';
import type { NoteName } from '@/domain/music';
import type { InstrumentVoice } from './InstrumentVoice';

export type SynthVoiceKind = 'guitar' | 'bass' | 'pad';

/**
 * Tone's option objects are nested, so Partial<> is not enough. Arrays must be
 * handled before the object branch, or `partials: number[]` maps to
 * `(number | undefined)[]` and fails under exactOptionalPropertyTypes.
 * This mirrors Tone's own RecursivePartial, which it does not export.
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

const SETTINGS: Record<SynthVoiceKind, DeepPartial<Tone.SynthOptions>> = {
  guitar: {
    oscillator: { type: 'fmtriangle' },
    envelope: { attack: 0.004, decay: 0.5, sustain: 0.06, release: 0.6 },
  },
  bass: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.35, sustain: 0.2, release: 0.5 },
  },
  pad: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.12, decay: 0.4, sustain: 0.5, release: 1.2 },
  },
};

/**
 * A plucked-ish synthetic voice. Good enough to hear what a phrase is; not a
 * guitar. When it stops being good enough — the first real test is whether
 * ear training can distinguish maj7 from dom7 — a SampledVoice implements the
 * same interface and nothing else changes.
 */
export class SynthVoice implements InstrumentVoice {
  readonly id: string;
  private synth: Tone.PolySynth | null = null;
  private readonly kind: SynthVoiceKind;

  constructor(kind: SynthVoiceKind = 'guitar') {
    this.kind = kind;
    this.id = `synth-${kind}`;
  }

  get ready(): boolean {
    return this.synth !== null;
  }

  load(): Promise<void> {
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, SETTINGS[this.kind]).toDestination();
      this.synth.volume.value = -8;
    }
    return Promise.resolve();
  }

  play(note: NoteName, durationSeconds: number, atTime: number, velocity = 0.8): void {
    if (!this.synth) throw new Error('SynthVoice.load() must be awaited before playing');
    this.synth.triggerAttackRelease(note, durationSeconds, atTime, velocity);
  }

  releaseAll(): void {
    this.synth?.releaseAll();
  }

  setVolume(decibels: number): void {
    if (this.synth) this.synth.volume.value = decibels;
  }

  dispose(): void {
    this.synth?.dispose();
    this.synth = null;
  }
}
