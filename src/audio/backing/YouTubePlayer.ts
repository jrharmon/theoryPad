/**
 * YouTube's IFrame API, loaded on first use and wrapped to the little this app
 * needs.
 *
 * Never loaded on page load: it is heavy, and it tracks. Nothing touches
 * YouTube until someone chooses a track or presses play on a video.
 *
 * The host is www.youtube.com rather than youtube-nocookie.com, which this
 * used until 2026-09-20. nocookie strips the viewer's YouTube session, so a
 * Premium subscription never reached the iframe and every track opened with an
 * advert. The regular host costs cookies and viewing history logged against
 * the account, and buys a Premium viewer no adverts at all — the trade the
 * player chose, and the same one Soundslice makes. Adverts still reach anyone
 * without Premium, which is why `StartWatch` stays.
 */

import { StartWatch, isTrackTime } from '@/domain/backing';

interface YTPlayerApi {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YTPlayerApi;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YouTube's player states, by the numbers its API reports. */
export const YT_STATE = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
};

/** Thrown when YouTube cannot be reached — offline, or blocked. */
export class YouTubeUnavailableError extends Error {
  constructor() {
    super('Backing tracks need a connection to YouTube.');
  }
}

/** Told to play, a video may be held back by the browser, or sat behind an advert. */
export interface PlayOptions {
  /** Nothing is moving at all: the browser wants a click on the video itself. */
  onBlocked?: () => void;
  /** Something is playing, but it is not the track yet: a pre-roll advert. */
  onAdvert?: () => void;
}

/** How often to read a video that has been told to play and has not said so yet. */
const WATCH_INTERVAL_MS = 250;
/**
 * Give up on a video that has done nothing at all for this long — counted from
 * the last sign of life, never from the play. A sponsored pair measured 107 s
 * on the deploy and the second was labelled 2:35, so a ceiling over the whole
 * wait would drop a track that was playing perfectly well.
 */
const QUIET_CEILING_MS = 180_000;

let loading: Promise<YTNamespace> | null = null;

function loadApi(timeoutMs = 15_000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    const fail = () => {
      loading = null;
      reject(new YouTubeUnavailableError());
    };
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else fail();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
    setTimeout(() => {
      if (!window.YT?.Player) fail();
    }, timeoutMs);
  });
  return loading;
}

/**
 * One embedded video.
 *
 * `element` is created here and stays the same node for the player's life:
 * mount it where the video should show. Moving an iframe in the DOM reloads it,
 * so to enlarge the video, restyle its container rather than moving it.
 */
export class YouTubePlayer {
  readonly element: HTMLDivElement;
  /** Settles when the player can be driven; rejects if YouTube is unreachable. */
  readonly ready: Promise<void>;

  private api: YTPlayerApi | null = null;
  private readonly listeners = new Set<(state: number) => void>();
  /** Waits for playback that closing the player must end. */
  private readonly cancels = new Set<(error: Error) => void>();
  private destroyed = false;
  private loaded = false;

  constructor(videoId: string, options: { startSec?: number; controls?: boolean } = {}) {
    this.element = document.createElement('div');
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    const slot = document.createElement('div');
    this.element.appendChild(slot);

    this.ready = loadApi().then(
      (YT) =>
        new Promise<void>((resolve, reject) => {
          if (this.destroyed) return reject(new Error('The player was closed.'));
          this.api = new YT.Player(slot, {
            host: 'https://www.youtube.com',
            videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              start: Math.floor(options.startSec ?? 0),
              playsinline: 1,
              rel: 0,
              // Keys belong to the app: Space pauses the exercise, not the video.
              disablekb: 1,
              controls: options.controls === false ? 0 : 1,
            },
            events: {
              onReady: () => {
                this.loaded = true;
                resolve();
              },
              onStateChange: (event) => {
                for (const listener of this.listeners) listener(event.data);
              },
              onError: (event) =>
                reject(new Error(`YouTube could not play this video (${event.data}).`)),
            },
          });
        }),
    );
  }

  /** Loaded, so a play can go out straight away rather than after an await. */
  get isReady(): boolean {
    return this.loaded && this.api !== null;
  }

  /**
   * The API, once it can be called. Before onReady the player object exists
   * but has no methods: calling one threw, from inside a routine starting its
   * first item, and the track never started. A rate set before then is applied
   * when the track starts.
   */
  private get live(): YTPlayerApi | null {
    return this.loaded ? this.api : null;
  }

  get currentTime(): number {
    return this.live?.getCurrentTime() ?? 0;
  }

  /** Zero until YouTube knows. */
  get duration(): number {
    return this.live?.getDuration() ?? 0;
  }

  get state(): number {
    return this.live?.getPlayerState() ?? YT_STATE.unstarted;
  }

  onState(listener: (state: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(): void {
    this.live?.playVideo();
  }

  pause(): void {
    this.live?.pauseVideo();
  }

  seekTo(seconds: number): void {
    this.live?.seekTo(Math.max(0, seconds), true);
  }

  setRate(rate: number): void {
    this.live?.setPlaybackRate(rate);
  }

  /**
   * Play from a point, settling once sound is actually coming out — YouTube
   * takes a few hundred milliseconds, and nothing should count from the click.
   *
   * Loaded, the play goes out before this returns. Some browsers (Safari,
   * Firefox) only let a video with sound start inside the click that asked for
   * it, and an await in between loses the click. If it is held back anyway,
   * `onBlocked` asks for a click on the video; when that starts it, from
   * wherever it was, it is put back where it should be.
   */
  playFrom(seconds: number, options: PlayOptions = {}): Promise<void> {
    if (!this.isReady) return this.ready.then(() => this.playFrom(seconds, options));
    this.seekTo(seconds);
    return this.playAndWait(options, seconds, () => this.seekTo(seconds));
  }

  /** Carry on from where it is, settling once it is playing. */
  resume(options: PlayOptions = {}): Promise<void> {
    if (!this.isReady) return this.ready.then(() => this.resume(options));
    // Where it already is, is where it should come back: an advert would read
    // well short of it.
    return this.playAndWait(options, this.currentTime, null);
  }

  /**
   * Wait for the track itself.
   *
   * `from` is where the video was sent to. `playing` is taken at face value
   * only when the time reported with it belongs to the track rather than to an
   * advert playing over it (`isTrackTime`). The state event is the fast path;
   * the poll behind it is the safety net, so a reading that arrives a beat
   * late costs a quarter of a second rather than the whole wait.
   *
   * Nothing here runs on a deadline measured from the play. Adverts measured
   * 31.4 s and 107 s on the deployed site, and every fixed deadline this
   * replaced was shorter than either.
   */
  private playAndWait(
    options: PlayOptions,
    from: number,
    realign: (() => void) | null,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const watch = new StartWatch(startedAt);
      let blocked = false;
      let advertSeen = false;

      const finish = (error?: Error) => {
        clearInterval(poll);
        stop();
        this.cancels.delete(finish);
        if (error) reject(error);
        else resolve();
      };
      /** Playing, and playing the track: done. */
      const accept = (): boolean => {
        if (this.state !== YT_STATE.playing || !isTrackTime(this.currentTime, from))
          return false;
        if (blocked) realign?.();
        finish();
        return true;
      };

      const stop = this.onState((state) => {
        if (state === YT_STATE.playing) accept();
      });

      const poll = setInterval(() => {
        if (accept()) return;
        const atMs = Date.now();
        if (atMs - watch.lastProgressAtMs >= QUIET_CEILING_MS) {
          finish(
            blocked ? new Error('The video was never started.') : new YouTubeUnavailableError(),
          );
          return;
        }
        const verdict = watch.observe({
          atMs,
          state: this.state,
          currentTime: this.currentTime,
        });
        if (verdict === 'advert' && !advertSeen) {
          advertSeen = true;
          options.onAdvert?.();
        } else if (verdict === 'stalled' && !blocked) {
          blocked = true;
          // Nobody to ask for the click: nothing is going to start it.
          if (options.onBlocked) options.onBlocked();
          else finish(new YouTubeUnavailableError());
        }
      }, WATCH_INTERVAL_MS);

      this.cancels.add(finish);
      this.play();
      accept();
    });
  }

  destroy(): void {
    this.destroyed = true;
    for (const cancel of [...this.cancels]) cancel(new Error('The player was closed.'));
    this.listeners.clear();
    // Before onReady there is no destroy to call; removing the element ends it.
    this.live?.destroy();
    this.api = null;
    this.element.remove();
  }
}
