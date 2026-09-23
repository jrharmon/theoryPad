import * as Tone from 'tone';
import type { NoteName } from '@/domain/music';
import type { InstrumentVoice } from './InstrumentVoice';
import { sampleDir, type VoicePreset } from './presets';

/** Long enough that a cut tail does not click. */
const FADE_SECONDS = 0.1;

/**
 * A recorded instrument, over Tone.Sampler. Polyphonic, and it pitch-shifts
 * between the sampled notes, so chords come free.
 *
 * Loading is a download of up to a megabyte or so. Nothing waits on it: the
 * engine's voice slot plays the synth until this has loaded.
 */
export class SampledVoice implements InstrumentVoice {
  readonly id: string;
  private sampler: Tone.Sampler | null = null;
  private readonly preset: VoicePreset;
  private readonly dir: string;

  constructor(preset: VoicePreset, dir: string = sampleDir(preset)) {
    this.preset = preset;
    this.dir = dir;
    this.id = preset.id;
  }

  get ready(): boolean {
    return this.sampler !== null;
  }

  /** Rejects if any file fails to load. */
  async load(): Promise<void> {
    if (this.sampler) return;
    const { urls, maxSeconds, release = 1, volumeDb } = this.preset;
    const buffers = await Promise.all(
      Object.entries(urls).map(async ([note, file]) => {
        const buffer = (await Tone.ToneAudioBuffer.fromUrl(this.dir + file)).get();
        if (!buffer) throw new Error(`No audio in ${this.dir}${file}`);
        return [note, maxSeconds ? trimmed(buffer, maxSeconds) : buffer] as const;
      }),
    );
    const sampler = new Tone.Sampler({ urls: Object.fromEntries(buffers), release });
    sampler.toDestination();
    sampler.volume.value = volumeDb;
    this.sampler = sampler;
  }

  play(note: NoteName, durationSeconds: number, atTime: number, velocity = 0.8): void {
    if (!this.sampler) throw new Error('SampledVoice.load() must finish before playing');
    this.sampler.triggerAttackRelease(note, durationSeconds, atTime, velocity);
  }

  releaseAll(): void {
    this.sampler?.releaseAll();
  }

  setVolume(decibels: number): void {
    if (this.sampler) this.sampler.volume.value = decibels;
  }

  dispose(): void {
    this.sampler?.dispose();
    this.sampler = null;
  }
}

/** The first `seconds` of a buffer, faded out at the end. */
function trimmed(buffer: AudioBuffer, seconds: number): AudioBuffer {
  const length = Math.min(buffer.length, Math.round(seconds * buffer.sampleRate));
  if (length === buffer.length) return buffer;
  const fade = Math.round(FADE_SECONDS * buffer.sampleRate);
  const out = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel).slice(0, length);
    for (let i = 0; i < fade; i += 1) data[length - fade + i]! *= 1 - i / fade;
    out.copyToChannel(data, channel);
  }
  return out;
}
