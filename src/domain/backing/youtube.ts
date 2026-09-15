/**
 * Reading what people paste: a YouTube link in any of its shapes, and times
 * written the way YouTube writes them.
 */

export interface YouTubeLink {
  videoId: string;
  /** From `t=` or `start=`, when the link carries one. */
  startSec?: number;
}

const ID = /^[\w-]{11}$/;

/** "216", "216s", "3m36s", "1h2m3s" → seconds. */
function linkTime(value: string | undefined): number | undefined {
  if (!value) return undefined;
  if (/^\d+(\.\d+)?s?$/.test(value)) return parseFloat(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match || value === '') return undefined;
  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function param(query: string, name: string): string | undefined {
  for (const pair of query.split(/[&?#]/)) {
    const [key, value] = pair.split('=');
    if (key === name && value !== undefined) return decodeURIComponent(value);
  }
  return undefined;
}

/** A pasted link or a bare id, or null when it is neither. */
export function parseYouTubeLink(input: string): YouTubeLink | null {
  const text = input.trim();
  if (ID.test(text)) return { videoId: text };

  const match =
    /^(?:https?:\/\/)?(?:[\w-]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)(\/[^?#]*)?([?#].*)?$/i.exec(
      text,
    );
  if (!match) return null;
  const [, host = '', path = '', query = ''] = match;

  let videoId: string | undefined;
  if (host.toLowerCase() === 'youtu.be') videoId = path.split('/')[1];
  else if (path === '/watch') videoId = param(query, 'v');
  else videoId = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(path)?.[1];

  if (!videoId || !ID.test(videoId)) return null;
  const startSec = linkTime(param(query, 't') ?? param(query, 'start'));
  return startSec === undefined ? { videoId } : { videoId, startSec };
}

/**
 * 216.05 → "3:36.05", 216.5 → "3:36.5", 216 → "3:36". To the hundredth: bar 1
 * is nudged in twentieths, and a coarser display rounds a nudge away.
 */
export function formatVideoTime(seconds: number): string {
  const hundredths = Math.round(seconds * 100);
  const whole = Math.floor(hundredths / 100);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const fraction = hundredths % 100;
  const ss =
    String(s).padStart(2, '0') +
    (fraction ? `.${String(fraction).padStart(2, '0').replace(/0$/, '')}` : '');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "3:36.5", "1:02:03" or "216.5" → seconds; null if it is none of those. */
export function parseVideoTime(text: string): number | null {
  const trimmed = text.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(trimmed);
  if (!match) return null;
  const [, h = '0', m = '0', s = '0'] = match;
  if (Number(s) >= 60 || (match[1] !== undefined && Number(m) >= 60)) return null;
  return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
}

/** The still YouTube serves for a video — what the facade shows before anything loads. */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
