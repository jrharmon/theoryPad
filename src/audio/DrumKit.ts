import * as Tone from 'tone';
import { DRUM_SOUNDS, type DrumSound } from '@/domain/drums';

/**
 * The kit's level against the notes, to be tuned by ear at the gate. Rendered
 * offline at 96 bpm, Simple then peaks near −8 dBFS with its RMS about 5 dB
 * under a line of the levelled guitar — room for the notes on top.
 */
const KIT_VOLUME_DB = -12;

/**
 * Each drum's level within the kit. The samples all arrive normalised, which
 * leaves the kick loudest and the ride quietest — backwards for a metronome.
 * The snare and ride keep the time, so they must cut through the guitar; the
 * kick is there for feel and can sit under it.
 */
const SOUND_DB: Record<DrumSound, number> = {
  kick: -6,
  snare: 0,
  'hat-closed': 0,
  'hat-open': -2,
  ride: 3,
  crash: -3,
  stick: 0,
};

/**
 * Where the kit is served. Through Vite's base URL, never a leading slash: the
 * deploy lives under /theoryPad/.
 */
export function kitDir(base: string = import.meta.env.BASE_URL): string {
  return `${base}samples/v1/kit/`;
}

/**
 * Plays drum hits from the sample kit at exact audio times. Pure playback: the
 * patterns are in src/domain/drums, and the metronome decides when.
 *
 * A closed hat chokes an open one still ringing, as the pedal does on a real
 * hi-hat — without it, Upbeat's open hat rings over the next downbeat.
 */
export class DrumKit {
  private buffers: Map<DrumSound, Tone.ToneAudioBuffer> | null = null;
  private output: Tone.Volume | null = null;
  private openHat: Tone.ToneBufferSource | null = null;
  private readonly dir: string;

  constructor(dir: string = kitDir()) {
    this.dir = dir;
  }

  get ready(): boolean {
    return this.buffers !== null;
  }

  /** Rejects if any sample fails to load. */
  async load(): Promise<void> {
    if (this.buffers) return;
    const entries = await Promise.all(
      DRUM_SOUNDS.map(
        async (sound) =>
          [sound, await Tone.ToneAudioBuffer.fromUrl(`${this.dir}${sound}.mp3`)] as const,
      ),
    );
    this.output ??= new Tone.Volume(KIT_VOLUME_DB).toDestination();
    this.buffers = new Map(entries);
  }

  /** `atTime` is in the audio context's timebase, as a Clock callback hands it. */
  play(sound: DrumSound, atTime: number, velocity: number): void {
    const buffer = this.buffers?.get(sound);
    if (!buffer || !this.output) return;
    if (sound === 'hat-closed' || sound === 'hat-open') this.openHat?.stop(atTime);
    const source = new Tone.ToneBufferSource({
      url: buffer,
      // Only heard when a hat is choked: long enough not to click.
      fadeOut: 0.02,
      onended: () => {
        if (this.openHat === source) this.openHat = null;
        source.dispose();
      },
    }).connect(this.output);
    source.start(atTime, 0, undefined, velocity * Tone.dbToGain(SOUND_DB[sound]));
    if (sound === 'hat-open') this.openHat = source;
  }

  dispose(): void {
    this.openHat = null;
    this.output?.dispose();
    this.output = null;
    for (const buffer of this.buffers?.values() ?? []) buffer.dispose();
    this.buffers = null;
  }
}
