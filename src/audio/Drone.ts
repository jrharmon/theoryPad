import * as Tone from 'tone';
import type { KeyMode } from '@/domain/music';
import { droneNotes } from '@/domain/backing';
import type { BackingSource } from './backing/types';

/**
 * The drone: the key's root and fifth, held. The simplest generated backing —
 * no rhythm and no chords, which is exactly why it suits every key and mode,
 * works offline, and leaves the metronome in charge of the beat.
 */
export class Drone implements BackingSource {
  readonly kind = 'drone';
  readonly rates = null;
  readonly effectiveBpm = null;

  private keyMode: KeyMode;
  private synth: Tone.PolySynth | null = null;
  private filter: Tone.Filter | null = null;
  private sounding = false;

  constructor(keyMode: KeyMode) {
    this.keyMode = keyMode;
  }

  load(): Promise<void> {
    return Promise.resolve();
  }

  /** Built on first sound, after the AudioContext has started from a gesture. */
  private voice(): Tone.PolySynth {
    this.filter ??= new Tone.Filter(1100, 'lowpass').toDestination();
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fattriangle', count: 3, spread: 14 },
        envelope: { attack: 1.2, decay: 0.4, sustain: 0.85, release: 2.5 },
      } as never).connect(this.filter);
      this.synth.volume.value = -14;
    }
    return this.synth;
  }

  start(): Promise<void> {
    if (!this.sounding) {
      this.voice().triggerAttack(droneNotes(this.keyMode), Tone.now(), 0.6);
      this.sounding = true;
    }
    return Promise.resolve();
  }

  pause(): void {
    this.synth?.releaseAll();
    this.sounding = false;
  }

  resume(): Promise<void> {
    return this.start();
  }

  stop(): void {
    this.pause();
  }

  setRate(): void {}

  /** A re-roll moved the key: sound the new one if it was sounding. */
  setKeyMode(keyMode: KeyMode): void {
    this.keyMode = keyMode;
    if (this.sounding) {
      this.pause();
      void this.start();
    }
  }

  dispose(): void {
    this.synth?.dispose();
    this.filter?.dispose();
    this.synth = null;
    this.filter = null;
    this.sounding = false;
  }
}
