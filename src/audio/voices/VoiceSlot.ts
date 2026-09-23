import type { VoiceId } from '@/data';
import type { InstrumentVoice } from './InstrumentVoice';
import type { SampledVoiceId } from './presets';

/** What the notes are playing on right now. */
export type VoiceStatus = 'synth' | 'loading' | 'ready' | 'failed';

/**
 * The voice the notes play through, swapped once a sampled one has loaded.
 *
 * Play must never wait on a download, so the synth is always here as the
 * fallback: while samples load, when a load fails, and for anyone who chose
 * it. `PhrasePlayer` reads `voice` as it plays each note, so a load that
 * finishes mid-pass takes over from the next note.
 *
 * A failed load stays on the synth and is not retried until a different voice
 * is chosen — not on every Play.
 */
export class VoiceSlot {
  readonly fallback: InstrumentVoice;
  private readonly make: (id: SampledVoiceId) => InstrumentVoice;
  private chosen: VoiceId = 'synth';
  private sampled: InstrumentVoice | null = null;
  private current: VoiceStatus = 'synth';
  private pending: Promise<void> = Promise.resolve();
  /** Bumped on every choice, so a load that lost the race is thrown away. */
  private generation = 0;
  private readonly listeners = new Set<(status: VoiceStatus) => void>();

  constructor(fallback: InstrumentVoice, make: (id: SampledVoiceId) => InstrumentVoice) {
    this.fallback = fallback;
    this.make = make;
  }

  get voice(): InstrumentVoice {
    return this.sampled ?? this.fallback;
  }

  get status(): VoiceStatus {
    return this.current;
  }

  /** Settles once the chosen voice has loaded or failed. Never rejects. */
  get settled(): Promise<void> {
    return this.pending;
  }

  /** Start using `id`. Resolves when it is playing, or has failed and left the synth. */
  choose(id: VoiceId): Promise<void> {
    if (id === this.chosen) return this.pending;
    this.chosen = id;
    const generation = ++this.generation;
    this.drop();

    if (id === 'synth') {
      this.setStatus('synth');
      this.pending = Promise.resolve();
      return this.pending;
    }

    const voice = this.make(id);
    this.setStatus('loading');
    this.pending = voice.load().then(
      () => {
        if (generation !== this.generation) return voice.dispose();
        this.sampled = voice;
        this.setStatus('ready');
      },
      () => {
        voice.dispose();
        if (generation === this.generation) this.setStatus('failed');
      },
    );
    return this.pending;
  }

  subscribe(listener: (status: VoiceStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.drop();
    this.fallback.dispose();
  }

  private drop(): void {
    this.sampled?.releaseAll();
    this.sampled?.dispose();
    this.sampled = null;
  }

  private setStatus(status: VoiceStatus): void {
    this.current = status;
    for (const listener of this.listeners) listener(status);
  }
}
