/**
 * YouTube's IFrame API, loaded on first use and wrapped to the little this app
 * needs.
 *
 * Never loaded on page load: it is heavy, and it tracks. Nothing touches
 * YouTube until someone chooses a track or presses play on a video. The host is
 * youtube-nocookie.com, the privacy-preserving embed.
 */

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
export const YT_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 };

/** Thrown when YouTube cannot be reached — offline, or blocked. */
export class YouTubeUnavailableError extends Error {
  constructor() {
    super('Backing tracks need a connection to YouTube.');
  }
}

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
  private destroyed = false;

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
            host: 'https://www.youtube-nocookie.com',
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
              onReady: () => resolve(),
              onStateChange: (event) => {
                for (const listener of this.listeners) listener(event.data);
              },
              onError: (event) => reject(new Error(`YouTube could not play this video (${event.data}).`)),
            },
          });
        }),
    );
  }

  get currentTime(): number {
    return this.api?.getCurrentTime() ?? 0;
  }

  /** Zero until YouTube knows. */
  get duration(): number {
    return this.api?.getDuration() ?? 0;
  }

  get state(): number {
    return this.api?.getPlayerState() ?? YT_STATE.unstarted;
  }

  onState(listener: (state: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(): void {
    this.api?.playVideo();
  }

  pause(): void {
    this.api?.pauseVideo();
  }

  seekTo(seconds: number): void {
    this.api?.seekTo(Math.max(0, seconds), true);
  }

  setRate(rate: number): void {
    this.api?.setPlaybackRate(rate);
  }

  /**
   * Play from a point, settling once sound is actually coming out. YouTube
   * takes a few hundred milliseconds to seek and start; nothing should count
   * from the click.
   */
  async playFrom(seconds: number, timeoutMs = 10_000): Promise<void> {
    await this.ready;
    this.seekTo(seconds);
    await this.playAndWait(timeoutMs);
  }

  /** Carry on from where it is, settling once it is playing. */
  async resume(timeoutMs = 10_000): Promise<void> {
    await this.ready;
    await this.playAndWait(timeoutMs);
  }

  private playAndWait(timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        stop();
        if (ok) resolve();
        else reject(new YouTubeUnavailableError());
      };
      const stop = this.onState((state) => {
        if (state === YT_STATE.playing) done(true);
      });
      const timer = setTimeout(() => done(false), timeoutMs);
      this.play();
      if (this.state === YT_STATE.playing) done(true);
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
    this.api?.destroy();
    this.api = null;
    this.element.remove();
  }
}
