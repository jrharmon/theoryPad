import type { VoiceId } from '@/data';

export type SampledVoiceId = Exclude<VoiceId, 'synth'>;

/** One sample set, as cut by scripts/fetch-samples.mjs. */
export interface VoicePreset {
  id: SampledVoiceId;
  name: string;
  /** Under public/samples/v1/. */
  dir: string;
  /** Sampled pitch → file name, relative to `dir`. */
  urls: Record<string, string>;
  /**
   * Levels the voice with the synth, so switching does not change the volume:
   * set by rendering the same line through each and matching their RMS.
   */
  volumeDb: number;
  release?: number;
  /**
   * Buffers are cut to this, with a fade, once decoded. The piano's notes ring
   * for up to 24 s, which decoded is ~133 MB; four seconds is ~25 MB, and
   * nothing in the catalog holds a note that long.
   */
  maxSeconds?: number;
}

const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Every `step` semitones from `from` to `to`, as MIDI numbers, named the way the files are. */
function sampled(from: number, to: number, step: number): Record<string, string> {
  const urls: Record<string, string> = {};
  for (let midi = from; midi <= to; midi += step) {
    const name = `${FLAT[midi % 12]}${Math.floor(midi / 12) - 1}`;
    urls[name] = `${name}.mp3`;
  }
  return urls;
}

export const VOICE_PRESETS: Record<SampledVoiceId, VoicePreset> = {
  // Salamander, every minor third: Eb1 (27) to C7 (96).
  piano: {
    id: 'piano',
    name: 'Piano',
    dir: 'piano',
    urls: sampled(27, 96, 3),
    volumeDb: -2,
    release: 1,
    maxSeconds: 4,
  },
  // FluidR3 steel-string acoustic, every semitone — shifted guitar notes sound
  // synthetic — from the 7-string's low B1 (35) to the 24th fret's E6 (88).
  guitar: {
    id: 'guitar',
    name: 'Guitar',
    dir: 'guitar',
    urls: sampled(35, 88, 1),
    volumeDb: 8,
    release: 0.8,
  },
};

/**
 * Where a preset's files are served. Through Vite's base URL, never a leading
 * slash: the deploy lives under /theoryPad/, so a rooted URL works on
 * localhost and 404s in production.
 */
export function sampleDir(
  preset: VoicePreset,
  base: string = import.meta.env.BASE_URL,
): string {
  return `${base}samples/v1/${preset.dir}/`;
}
