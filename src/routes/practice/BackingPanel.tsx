import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { modeTitle } from '@/domain/music';
import { speedPercent } from '@/domain/backing';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { PlayerSlot } from '@/components/media/PlayerSlot';
import { usePractice } from '@/store/practice';

/**
 * The playing track, in the right-hand column. YouTube requires its player to
 * be visible, so while a track is chosen this column stays, whatever the neck
 * is doing. Enlarge restyles the panel in place — moving the player would
 * reload it and lose its place.
 */
export function BackingPanel() {
  const backing = usePractice((s) => s.backing);
  const [enlarged, setEnlarged] = useState(false);

  // Escape shrinks the video rather than leaving the exercise.
  useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setEnlarged(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [enlarged]);

  if (backing.resolved.kind !== 'video' && !backing.error) return null;
  const video = backing.resolved.kind === 'video' ? backing.resolved.video : null;

  return (
    <>
      {enlarged && (
        // The same scrim as a dialog's, dark in both themes.
        <div className="fixed inset-0 z-30 bg-black/50" aria-hidden onClick={() => setEnlarged(false)} />
      )}
      <div
        className={cn(
          'sheet px-5 pt-4 pb-[18px]',
          enlarged &&
            'fixed top-1/2 left-1/2 z-40 w-[min(92vw,calc(78vh*16/9))] -translate-x-1/2 -translate-y-1/2',
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
            <p className="mt-1 truncate text-[13px] font-semibold">{video.title}</p>
            <p className="text-[12px] text-ink/64">
              {[
                video.keyMode && `${video.keyMode.tonic} ${modeTitle(video.keyMode.mode)}`,
                video.bpm !== undefined &&
                  `${video.bpm} bpm at ${speedPercent(backing.speed)} → ${Math.round(video.bpm * backing.speed)}`,
                video.progression,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-2">
              <PlayerSlot player={backing.player} keepKeys />
            </div>
          </>
        )}
        {backing.error && (
          <p className="mt-2 text-[13px] text-destructive" data-testid="backing-error">
            {backing.error} Playing without it.
          </p>
        )}
      </div>
    </>
  );
}

/** Said once, where the backing menu is: the remembered track isn't in this key. */
export function BackingDroppedNote() {
  const dropped = usePractice((s) => s.backing.resolved.kind === 'none' && s.backing.resolved.dropped);
  const keyMode = usePractice((s) => s.snapshot?.keyMode);
  if (!dropped || !keyMode) return null;
  return (
    <span className="text-[12px] text-ink/64">
      Your track isn’t in {keyMode.tonic} {modeTitle(keyMode.mode)} — the synth plays instead.
    </span>
  );
}
