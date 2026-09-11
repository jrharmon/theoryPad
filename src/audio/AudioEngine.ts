import * as Tone from 'tone';
import type { Clock } from '@/domain/time';
import { ToneClock } from './ToneClock';
import { Metronome, type ClickSink, type MetronomeOptions } from './Metronome';
import { PhrasePlayer } from './PhrasePlayer';
import { SynthVoice } from './voices';
import type { InstrumentVoice } from './voices';

/**
 * The metronome click.
 *
 * High and short, not a drum. A low percussive thud sits in the same register
 * as the guitar's low strings and disappears under them; a click near 2kHz cuts
 * through anything being played over it, which is the entire job.
 */
const ACCENT_HZ = 2000;
const BEAT_HZ = 1400;
const SUBDIVISION_HZ = 1400;

class ToneClickSink implements ClickSink {
  private voice: Tone.Synth | null = null;

  init(): void {
    if (this.voice) return;
    this.voice = new Tone.Synth({
      oscillator: { type: 'square' },
      // Near-instant attack and a very fast decay: a click, not a tone.
      envelope: { attack: 0.0005, decay: 0.028, sustain: 0, release: 0.01 },
    }).toDestination();
    this.voice.volume.value = -16;
  }

  click(audioTime: number, kind: 'accent' | 'beat' | 'subdivision'): void {
    if (!this.voice) return;
    switch (kind) {
      case 'accent':
        this.voice.triggerAttackRelease(ACCENT_HZ, 0.02, audioTime, 1);
        break;
      case 'beat':
        this.voice.triggerAttackRelease(BEAT_HZ, 0.018, audioTime, 0.6);
        break;
      case 'subdivision':
        this.voice.triggerAttackRelease(SUBDIVISION_HZ, 0.012, audioTime, 0.25);
        break;
    }
  }

  dispose(): void {
    this.voice?.dispose();
    this.voice = null;
  }
}

/**
 * The audio facade. Nothing outside src/audio imports Tone.
 *
 * Browsers will not start an AudioContext without a user gesture, so `init()`
 * must be called from a click. Getting that wrong is the classic silent-app
 * bug, so `ready` is exposed for the UI to gate on rather than assumed.
 */
export class AudioEngine {
  readonly clock: Clock;
  readonly metronome: Metronome;
  readonly phrase: PhrasePlayer;

  private readonly clickSink = new ToneClickSink();
  private readonly voice: InstrumentVoice;
  private started = false;

  constructor(options: { clock?: Clock; voice?: InstrumentVoice } = {}) {
    this.clock = options.clock ?? new ToneClock();
    this.voice = options.voice ?? new SynthVoice('guitar');
    this.metronome = new Metronome(this.clock, this.clickSink);
    this.phrase = new PhrasePlayer(this.clock, this.voice);
  }

  get ready(): boolean {
    return this.started;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.clickSink.init();
    await this.voice.load();
    this.started = true;
  }

  configureMetronome(options: MetronomeOptions): void {
    this.metronome.configure(options);
  }

  setMasterVolume(decibels: number): void {
    Tone.getDestination().volume.value = decibels;
  }

  dispose(): void {
    this.metronome.stop();
    this.phrase.clear();
    this.clock.clearAll();
    this.clock.stop();
    this.clickSink.dispose();
    this.voice.dispose();
    this.started = false;
  }
}

let engine: AudioEngine | null = null;

/**
 * The app's single engine. Lazily constructed so Tone — about 90KB gzipped —
 * is not on the first-paint path.
 */
export function getAudioEngine(): AudioEngine {
  engine ??= new AudioEngine();
  return engine;
}

/** For tests and teardown. */
export function resetAudioEngine(): void {
  engine?.dispose();
  engine = null;
}
