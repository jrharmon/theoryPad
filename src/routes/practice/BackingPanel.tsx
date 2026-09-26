import { cn } from 'cn';
import { ENLARGED, useEnlarge } from '@/components/media/useEnlarge';
import { EnlargeScrim } from '@/components/media/EnlargeScrim';
import { keyModeName, modeTitle } from '@/domain/music';
import { speedPercent } from '@/domain/backing';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { PlayerSlot } from '@/components/media/PlayerSlot';
import { usePractice } from '@/store/practice';
import { useVideos } from '@/store/videos';
import { referenceVideos } from '@/data';
import { VideoEmbed } from '@/components/media/VideoEmbed';

/**
 * The playing track, in the right-hand column. YouTube requires its player to
 * be visible, so while a track is chosen this column stays, whatever the neck
 * is doing. Enlarge restyles the panel in place — moving the player would
 * reload it and lose its place.
 */
export function BackingPanel() {
  const backing = usePractice((s) => s.backing);
  const [enlarged, setEnlarged] = useEnlarge();

  if (backing.resolved.kind !== 'video' && !backing.error) return null;
  const video = backing.resolved.kind === 'video' ? backing.resolved.video : null;

  return (
    <>
      {enlarged && <EnlargeScrim onClose={() => setEnlarged(false)} />}
      <div
        className={cn(
          'sheet px-5 pt-4 pb-[18px]',
          backing.needsClick && 'ring-2 ring-accent',
          enlarged && ENLARGED,
        )}
        data-testid="backing-panel"
      >
        <div className="flex items-center gap-2">
          <Kicker>Backing track</Kicker>
          {video && (
            <Button
              variant="secondary"
              size="xs"
              className="ml-auto"
              aria-pressed={enlarged}
              onClick={() => setEnlarged(!enlarged)}
            >
              {enlarged ? 'Shrink' : 'Enlarge'}
            </Button>
          )}
        </div>
        {video && (
          <>
            <p className="mt-1 truncate text-body-sm font-semibold">{video.title}</p>
            <p className="text-meta text-ink-muted">
              {[
                video.keyMode && `${video.keyMode.tonic} ${modeTitle(video.keyMode.mode)}`,
                video.bpm !== undefined &&
                  `${video.bpm} bpm at ${speedPercent(backing.speed)} → ${Math.round(video.bpm * backing.speed)}`,
                video.progression,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {backing.needsClick && (
              <p
                className="mt-2 text-body-sm font-semibold text-accent-text"
                data-testid="needs-click"
              >
                Your browser wants the first play to come from the video itself. Press its play
                button — the app lines the track up from there.
              </p>
            )}
            {backing.advert && !backing.needsClick && (
              <p className="mt-2 text-body-sm text-ink-muted" data-testid="backing-advert">
                An ad is playing. The exercise starts when the track does.
              </p>
            )}
            <div className="mt-2">
              <PlayerSlot player={backing.player} keepKeys />
            </div>
          </>
        )}
        {backing.error && (
          <p className="mt-2 text-body-sm text-destructive" data-testid="backing-error">
            {backing.error} Playing without it.
          </p>
        )}
      </div>
    </>
  );
}

/**
 * The exercise's reference videos, to watch while learning it. Practicing on
 * its own only — a routine is for playing through, not for lessons.
 */
export function ReferencePanel() {
  const exerciseId = usePractice((s) => s.exerciseId);
  const videos = useVideos((s) => s.videos);
  if (!exerciseId) return null;
  const lessons = referenceVideos(videos, exerciseId);
  if (lessons.length === 0) return null;
  return (
    <div className="sheet px-5 pt-4 pb-[18px]" data-testid="reference-panel">
      <Kicker>{lessons.length === 1 ? 'Reference video' : 'Reference videos'}</Kicker>
      <div className="mt-2 space-y-4">
        {lessons.map((video) => (
          <VideoEmbed
            key={video.id}
            videoId={video.videoId}
            title={video.title}
            startSec={video.startSec}
            endSec={video.endSec}
          />
        ))}
      </div>
    </div>
  );
}

/** Said once, where the backing menu is: the remembered track isn't in this key. */
export function BackingDroppedNote() {
  const dropped = usePractice(
    (s) => s.backing.resolved.kind === 'none' && s.backing.resolved.dropped,
  );
  const keyMode = usePractice((s) => s.snapshot?.keyMode);
  if (!dropped || !keyMode) return null;
  return (
    <span className="text-meta text-ink-muted">
      Your track isn’t in {keyModeName(keyMode)} — the notes play instead.
    </span>
  );
}
