import * as Tone from 'tone';
import type { DrumSound } from '@/domain/drums';
import type { DrumSink } from './metronomeVoices';

/**
 * The kit's level against the notes, to be tuned by ear at the gate. Rendered
 * offline at 96 bpm, Simple then peaks near −8 dBFS with its RMS about 5 dB
 * under a line of the levelled guitar — room for the notes on top.
 */
const KIT_VOLUME_DB = -12;

/**
 * Each drum's level within the kit. The samples all arrive normalised, which
 * leaves the ride quietest. The snare and ride keep the time, so they must cut
 * through the guitar. The kick should be heard too — at −6 dB it wasn't, at the
 * gate — though it is fine if it sometimes gets buried.
 */
const SOUND_DB: Record<DrumSound, number> = {
  kick: 0,
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
 * patterns are in src/domain/drums, and the metronome decides when. Each sound
 * is loaded on its own, only when a chosen metronome needs it.
 *
 * A closed hat chokes an open one still ringing, as the pedal does on a real
 * hi-hat — without it, Upbeat's open hat rings over the next downbeat.
 */
export class DrumKit implements DrumSink {
  private readonly buffers = new Map<DrumSound, Tone.ToneAudioBuffer>();
  /** Loading or loaded, so a sound is fetched once; a failed one is not retried. */
  private readonly requested = new Set<DrumSound>();
  private output: Tone.Volume | null = null;
  private openHat: Tone.ToneBufferSource | null = null;
  private readonly dir: string;

  constructor(dir: string = kitDir()) {
    this.dir = dir;
  }

  has(sound: DrumSound): boolean {
    return this.buffers.has(sound);
  }

  /**
   * Fetch these sounds, if they are not already in or on their way. Only what
   * the chosen metronome can play is ever asked for. Rejects if any fails;
   * the rest stay usable.
   */
  async load(sounds: readonly DrumSound[]): Promise<void> {
    const wanted = sounds.filter((sound) => !this.requested.has(sound));
    for (const sound of wanted) this.requested.add(sound);
    await Promise.all(
      wanted.map(async (sound) => {
        this.buffers.set(sound, await Tone.ToneAudioBuffer.fromUrl(`${this.dir}${sound}.mp3`));
      }),
    );
  }

  /** `atTime` is in the audio context's timebase, as a Clock callback hands it. */
  play(sound: DrumSound, atTime: number, velocity: number): void {
    const buffer = this.buffers.get(sound);
    if (!buffer) return;
    this.output ??= new Tone.Volume(KIT_VOLUME_DB).toDestination();
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
    for (const buffer of this.buffers.values()) buffer.dispose();
    this.buffers.clear();
    this.requested.clear();
  }
}
