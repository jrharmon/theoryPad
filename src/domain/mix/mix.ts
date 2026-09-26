/**
 * The mixer's channels. Master is everything, the video included; the others
 * are one each. Generated is the drone and the bass and piano — the Backing
 * menu only ever plays one of them.
 */
export const MIX_CHANNELS = ['master', 'notes', 'metronome', 'generated', 'video'] as const;
export type MixChannel = (typeof MIX_CHANNELS)[number];

/** A channel's level in dB, or null for Off. */
export type Level = number | null;
export type Mix = Record<MixChannel, Level>;

/** Every channel as it was before the mixer: the levels set by ear stay the zero. */
export const DEFAULT_MIX: Mix = { master: 0, notes: 0, metronome: 0, generated: 0, video: 0 };

/** The quietest a fader goes before Off. */
export const LEVEL_MIN = -30;

/**
 * The loudest. YouTube's volume only turns a video down — 100 is as loud as
 * it plays — so its fader stops at 0 dB.
 */
export function levelMax(channel: MixChannel): number {
  return channel === 'video' ? 0 : 6;
}

/**
 * YouTube's 0–100 volume for a backing track: its own fader and Master
 * together. The HTML5 player's volume is linear gain, so the dB add and the
 * sum becomes a gain, capped at the most YouTube can play.
 */
export function videoVolume(mix: Mix): number {
  if (mix.master === null || mix.video === null) return 0;
  const gain = 10 ** ((mix.master + mix.video) / 20);
  return Math.round(Math.min(1, gain) * 100);
}

/** A stored mix with every channel present, whatever version saved it. */
export function completeMix(stored: Partial<Mix> | undefined): Mix {
  const mix = { ...DEFAULT_MIX };
  for (const channel of MIX_CHANNELS) {
    const level = stored?.[channel];
    if (level === null || typeof level === 'number') mix[channel] = level;
  }
  return mix;
}
