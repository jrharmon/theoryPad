import type { BackingChoice, BackingQuery, ResolvedBacking, Video } from '@/data';
import { backingTracks, resolveBacking } from '@/data';
import { effectiveTempo, speedFor, stepSpeed } from '@/domain/backing';
import type { KeyMode } from '@/domain/music';
import type { BackingSource, PlayOptions, YouTubePlayer } from '@/audio';
import type { ExerciseRunner } from '@/exercises/runner';
import type { AudioPort, DroneSource } from './ports';

/** What plays instead of the synth notes, and everything the screen shows about it. */
export interface BackingState {
  /** What was chosen, as remembered on the exercise or routine. */
  choice: BackingChoice;
  /** What that means in the current key: the drone, a track, or none. */
  resolved: ResolvedBacking;
  /** Tracks the menu offers in the current key. */
  options: Video[];
  source: BackingSource | null;
  /** The YouTube player, for the screen to mount. Null unless a track is chosen. */
  player: YouTubePlayer | null;
  /** A track's speed, 0.25–2. */
  speed: number;
  /** The tempo before a track took it over, to go back to without one. */
  tempoBefore: number | null;
  /** YouTube could not be reached, or could not play the video. */
  error: string | null;
  /** Waiting for YouTube to start before the clock goes. */
  starting: boolean;
  /** Sounding (or paused mid-pass) — as opposed to loaded and waiting. */
  started: boolean;
  /** The browser held the video back: it wants a click on the video itself. */
  needsClick: boolean;
  /** An advert is playing over the track. The exercise waits it out. */
  advert: boolean;
}

export const NO_BACKING: BackingState = {
  choice: { kind: 'none' },
  resolved: { kind: 'none', dropped: false },
  options: [],
  source: null,
  player: null,
  speed: 1,
  tempoBefore: null,
  error: null,
  starting: false,
  started: false,
  needsClick: false,
  advert: false,
};

/** The same thing, so a refresh need not rebuild what is already playing. */
export function sameResolution(a: ResolvedBacking, b: ResolvedBacking): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'video' && b.kind === 'video') {
    const x = a.video;
    const y = b.video;
    return x.id === y.id && x.updatedAt === y.updatedAt;
  }
  return true;
}

/** What the menu offers and what the choice resolves to, for a key. */
export function resolveFor(
  videos: readonly Video[],
  choice: BackingChoice,
  query: BackingQuery,
) {
  return {
    options: backingTracks(videos, query),
    resolved: resolveBacking(choice, videos, query),
  };
}

/** What a controller needs from the session around it. */
export interface BackingHost {
  /** The key the backing must fit — the exercise's, or the routine's. */
  keyMode(): KeyMode | null;
  /** The runner whose tempo a track takes over. */
  runner(): ExerciseRunner | null;
}

/**
 * The backing: what the choice means in the current key, the source that plays
 * it, and the hand-off of tempo between a track and the runner.
 *
 * A track takes the tempo over at the speed nearest the one you had, and
 * leaving it gives that tempo back. The controller never listens to the runner:
 * the session tells it when the key may have moved, so setting the runner's
 * tempo from here cannot land back here.
 */
export class BackingController {
  private current: BackingState = NO_BACKING;
  private query: Omit<BackingQuery, 'keyMode'> = {};
  private readonly audio: AudioPort;
  private readonly host: BackingHost;
  private readonly videos: () => readonly Video[];
  private readonly onChange: (state: BackingState) => void;

  constructor(options: {
    audio: AudioPort;
    host: BackingHost;
    videos: () => readonly Video[];
    onChange: (state: BackingState) => void;
  }) {
    this.audio = options.audio;
    this.host = options.host;
    this.videos = options.videos;
    this.onChange = options.onChange;
  }

  get state(): BackingState {
    return this.current;
  }

  /** A track is chosen and playable here: it replaces the notes and owns the tempo. */
  get underTrack(): boolean {
    return this.current.resolved.kind === 'video';
  }

  private set(changes: Partial<BackingState>): void {
    this.current = { ...this.current, ...changes };
    this.onChange(this.current);
  }

  /** What to choose among, and the choice already made. */
  open(choice: BackingChoice, query: Omit<BackingQuery, 'keyMode'>): void {
    this.query = query;
    this.current = { ...this.current, choice };
    this.refresh();
  }

  choose(choice: BackingChoice): void {
    this.current = { ...this.current, choice };
    this.refresh();
  }

  /**
   * Work out what the choice means in the current key, and make or drop its
   * source to match. Cheap and idempotent: the session calls it after anything
   * that can move the key or change the choice.
   */
  refresh(): void {
    const keyMode = this.host.keyMode();
    if (!keyMode) return;
    const backing = this.current;
    const { options, resolved } = resolveFor(this.videos(), backing.choice, {
      ...this.query,
      keyMode,
    });

    if (
      sameResolution(backing.resolved, resolved) &&
      (backing.source || resolved.kind === 'none')
    ) {
      if (backing.resolved.kind === 'drone')
        (backing.source as DroneSource | null)?.setKeyMode(keyMode);
      this.set({ options, resolved });
      return;
    }

    backing.source?.dispose();
    let next: BackingState = {
      ...backing,
      options,
      resolved,
      source: null,
      player: null,
      error: null,
      started: false,
    };
    let tempo: number | null = null;
    // Leaving a track: back to the tempo from before it took over.
    if (
      backing.resolved.kind === 'video' &&
      resolved.kind !== 'video' &&
      backing.tempoBefore !== null
    ) {
      tempo = backing.tempoBefore;
      next.tempoBefore = null;
    }

    if (resolved.kind === 'drone') {
      next.source = this.audio.drone(keyMode);
    } else if (resolved.kind === 'video' && resolved.video.bpm !== undefined) {
      const { video } = resolved;
      const bpm = video.bpm!;
      const source = this.audio.track({
        videoId: video.videoId,
        startSec: video.startSec,
        bpm,
        beatsPerBar: video.beatsPerBar,
        ...(video.endSec !== undefined ? { endSec: video.endSec } : {}),
      });
      source.load().catch((e: unknown) => {
        if (this.current.source === source) this.set({ error: (e as Error).message });
      });
      const snapshot = this.host.runner()?.snapshot;
      const before = next.tempoBefore ?? snapshot?.currentTempo ?? snapshot?.targetTempo ?? bpm;
      const speed = speedFor(before, bpm);
      source.setRate(speed);
      tempo = effectiveTempo(bpm, speed);
      next = { ...next, source, player: source.player, speed, tempoBefore: before };
    }
    this.current = next;
    this.onChange(next);
    if (tempo !== null) this.host.runner()?.setTempo(tempo);
  }

  /**
   * Move the tempo under a track, in its own terms: the nearest speed. False
   * without a track, for the caller to move the runner instead.
   */
  setTempo(bpm: number): boolean {
    const { resolved } = this.current;
    if (resolved.kind !== 'video' || !resolved.video.bpm) return false;
    this.setSpeed(speedFor(bpm, resolved.video.bpm));
    return true;
  }

  /** Under a track the tempo moves in the track's own steps: 5% of its speed. */
  nudge(delta: number): boolean {
    if (!this.underTrack) return false;
    this.setSpeed(stepSpeed(this.current.speed, Math.sign(delta)));
    return true;
  }

  /** A track's speed, and the tempo that comes out of it. */
  private setSpeed(speed: number): void {
    const { resolved, source } = this.current;
    if (resolved.kind !== 'video' || !source) return;
    source.setRate(speed);
    this.set({ speed });
    this.host.runner()?.setTempo(effectiveTempo(resolved.video.bpm ?? 0, speed));
  }

  /**
   * A routine's next item, at its own tempo: the track's speed changes to fit
   * it, and that tempo is what leaving the track goes back to.
   */
  fitTo(runner: ExerciseRunner): void {
    const { resolved } = this.current;
    if (resolved.kind !== 'video' || !resolved.video.bpm) return;
    const tempo = runner.snapshot.targetTempo ?? runner.snapshot.currentTempo;
    if (tempo === null) return;
    this.current = { ...this.current, tempoBefore: tempo };
    this.setSpeed(speedFor(tempo, resolved.video.bpm));
  }

  /**
   * What a video that has not started yet means: an advert to wait out, or a
   * browser holding it back until the video itself is clicked.
   */
  private readonly whileStarting: PlayOptions = {
    onBlocked: () => this.set({ needsClick: true }),
    onAdvert: () => this.set({ advert: true }),
  };

  /**
   * Start the backing ahead of the clock, settling once it sounds. A track
   * that will not start is dropped, and says so, and the notes play instead.
   */
  async start(countInTicks: number): Promise<void> {
    const { source, starting } = this.current;
    if (!source || starting) return;
    this.set({ starting: true });
    try {
      // The play goes out before this awaits — inside the click, if there was one.
      await source.start(countInTicks, this.whileStarting);
      this.set({ starting: false, started: true, needsClick: false });
    } catch (e) {
      source.dispose();
      this.set({
        source: null,
        player: null,
        resolved: { kind: 'none', dropped: false },
        error: (e as Error).message,
        starting: false,
        started: false,
        needsClick: false,
        advert: false,
      });
    }
  }

  /**
   * A routine's played item has started its clock with the track not yet
   * going — the first item, or the first after a theory set. Hold the clock,
   * start the track a count-in ahead of bar 1, and let the clock go again.
   */
  async catchUp(runner: ExerciseRunner): Promise<void> {
    if (this.current.starting) return;
    if (!this.current.source) this.refresh();
    const snapshot = runner.snapshot;
    if (snapshot.freeTime) {
      await this.start(0);
      return;
    }
    runner.pause();
    await this.start(snapshot.countInRemaining + this.audio.clock.ticks);
    runner.resume();
  }

  /** Silent and back to its start, ready for the next Play. */
  stop(): void {
    const { source, started, starting } = this.current;
    if (!source || (!started && !starting)) return;
    source.stop();
    this.set({ started: false, advert: false });
  }

  /**
   * The clock has been moved and the backing has not. Whatever is sounding
   * plays on from where it is, and takes the clock's new position as the one
   * to keep step with, so nothing drags it back.
   */
  reanchor(): void {
    this.current.source?.reanchor?.();
  }

  pause(): void {
    this.current.source?.pause();
  }

  async resume(): Promise<void> {
    await this.current.source?.resume(this.whileStarting).catch(() => undefined);
    if (this.current.needsClick || this.current.advert)
      this.set({ needsClick: false, advert: false });
  }

  /**
   * A theory set pauses a track. Its player goes with the tab it sat beside,
   * so the next played item builds a fresh one.
   */
  shelveTrack(): void {
    const { source } = this.current;
    if (!source || !this.underTrack) return;
    source.dispose();
    this.set({ source: null, player: null, started: false, advert: false });
  }

  dispose(): void {
    this.current.source?.dispose();
    this.current = NO_BACKING;
  }
}
