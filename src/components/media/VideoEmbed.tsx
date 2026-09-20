import { useState } from 'react';
import { cn } from 'cn';
import { formatVideoTime, thumbnailUrl } from '@/domain/backing';
import { Button } from '@/components/ui/button';
import { ENLARGED, useEnlarge } from './useEnlarge';
import { EnlargeScrim } from './EnlargeScrim';

/**
 * A video to watch — a lesson or a demo. Until it is clicked it is YouTube's
 * still with a play button: no YouTube script, no player, nothing that tracks.
 * Playing it plays the video and nothing else.
 */
export function VideoEmbed({
  videoId,
  title,
  startSec,
  endSec,
  children,
}: {
  videoId: string;
  title: string;
  startSec: number;
  endSec?: number | undefined;
  /** Under the title: an Edit button, say. */
  children?: React.ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const [enlarged, setEnlarged] = useEnlarge();
  const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
  if (startSec > 0) params.set('start', String(Math.floor(startSec)));
  if (endSec !== undefined) params.set('end', String(Math.ceil(endSec)));

  return (
    <>
      {enlarged && <EnlargeScrim onClose={() => setEnlarged(false)} />}
      <div className={cn(enlarged && cn(ENLARGED, 'sheet p-4'))} data-testid="video-embed">
        <div className="aspect-video w-full overflow-hidden rounded-[8px] bg-ink/5">
          {playing ? (
            <iframe
              title={title}
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              className="group relative block h-full w-full"
              aria-label={`Play ${title}`}
              onClick={() => setPlaying(true)}
            >
              <img
                src={thumbnailUrl(videoId)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute inset-0 m-auto flex h-11 w-16 items-center justify-center rounded-[12px] bg-accent text-paper shadow-(--shadow-float) group-hover:bg-accent/85">
                ▶
              </span>
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{title}</p>
            {(startSec > 0 || endSec !== undefined) && (
              <p className="text-[12px] text-ink/64 tabular-nums">
                {formatVideoTime(startSec)}
                {endSec !== undefined ? ` – ${formatVideoTime(endSec)}` : ' on'}
              </p>
            )}
          </div>
          {children}
          <Button
            variant="secondary"
            size="xs"
            aria-pressed={enlarged}
            onClick={() => setEnlarged(!enlarged)}
          >
            {enlarged ? 'Shrink' : 'Enlarge'}
          </Button>
        </div>
      </div>
    </>
  );
}
