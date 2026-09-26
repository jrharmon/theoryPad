import * as Tone from 'tone';
import { DEFAULT_MIX, videoVolume, type Level, type Mix } from '@/domain/mix';

/** The channels that are ours to route. The video plays in YouTube's iframe, outside them. */
export type Bus = 'notes' | 'metronome' | 'generated';

/** Long enough that dragging a fader does not zip. */
const RAMP_SECONDS = 0.05;

function setLevel(node: { volume: Tone.Param<'decibels'>; mute: boolean }, level: Level): void {
  // Unmuting restores the level from before the mute, so unmute first, then move.
  node.mute = level === null;
  if (level !== null) node.volume.rampTo(level, RAMP_SECONDS);
}

/**
 * The mixer: a volume node per channel in front of the output, and Master on
 * the output itself. A backing track cannot join them — YouTube's audio never
 * reaches our context — so it is told its volume instead, Master included.
 */
class Mixer {
  private mix: Mix = DEFAULT_MIX;
  private readonly buses = new Map<Bus, Tone.Volume>();
  private readonly videoListeners = new Set<(volume: number) => void>();

  /** Where a sound on this channel connects. Built on first use, at the current level. */
  bus(bus: Bus): Tone.Volume {
    let node = this.buses.get(bus);
    if (!node) {
      node = new Tone.Volume().toDestination();
      setLevel(node, this.mix[bus]);
      this.buses.set(bus, node);
    }
    return node;
  }

  set(mix: Mix): void {
    this.mix = mix;
    for (const [bus, node] of this.buses) setLevel(node, mix[bus]);
    setLevel(Tone.getDestination(), mix.master);
    const volume = videoVolume(mix);
    for (const listener of this.videoListeners) listener(volume);
  }

  /** A backing track's volume, 0–100: now, and whenever the mix changes. */
  onVideoVolume(listener: (volume: number) => void): () => void {
    this.videoListeners.add(listener);
    listener(videoVolume(this.mix));
    return () => this.videoListeners.delete(listener);
  }
}

export const mixer = new Mixer();
