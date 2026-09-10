import * as Tone from 'tone';
import type { Clock } from '@/domain/time';
import { ToneClock } from './ToneClock';
import { Metronome, type ClickSink, type MetronomeOptions } from './Metronome';
import { PhrasePlayer } from './PhrasePlayer';
import { SynthVoice } from './voices';
import type { InstrumentVoice } from './voices';

/** Two short percussive clicks. Accent on the downbeat, a lower tick elsewhere. */
class ToneClickSink implements ClickSink {
  private accent: Tone.MembraneSynth | null = null;
  private beat: Tone.MembraneSynth | null = null;

  init(): void {
    if (this.accent) return;
    this.accent = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    }).toDestination();
    this.beat = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    }).toDestination();
    this.accent.volume.value = -6;
    this.beat.volume.value = -14;
  }

  click(audioTime: number, kind: 'accent' | 'beat' | 'subdivision'): void {
    if (kind === 'accent') this.accent?.triggerAttackRelease('C4', 0.04, audioTime);
    else if (kind === 'beat') this.beat?.triggerAttackRelease('G3', 0.03, audioTime);
    else this.beat?.triggerAttackRelease('G3', 0.02, audioTime, 0.3);
  }

  dispose(): void {
    this.accent?.dispose();
    this.beat?.dispose();
    this.accent = null;
    this.beat = null;
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
