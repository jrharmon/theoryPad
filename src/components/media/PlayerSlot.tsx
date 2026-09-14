import { useEffect, useRef } from 'react';
import { cn } from 'cn';
import type { YouTubePlayer } from '@/audio/backing';

/**
 * Where a YouTube player shows. The player's node is moved in once and left
 * there: moving an iframe reloads it, so anything that enlarges the video
 * restyles this slot instead.
 */
export function PlayerSlot({
  player,
  className,
  keepKeys = false,
}: {
  player: YouTubePlayer | null;
  className?: string;
  /**
   * Hand the keyboard straight back after a click on the video. A focused
   * iframe swallows every key, and Space should still pause the exercise.
   */
  keepKeys?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!keepKeys) return;
    // Focus moving into the iframe blurs the window; the click still lands.
    const onBlur = () =>
      setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLIFrameElement && host.current?.contains(active)) active.blur();
      }, 0);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [keepKeys]);

  useEffect(() => {
    const node = host.current;
    if (!node || !player) return;
    node.appendChild(player.element);
    return () => {
      if (player.element.parentNode === node) node.removeChild(player.element);
    };
  }, [player]);

  return (
    <div
      ref={host}
      data-testid="player-slot"
      className={cn('aspect-video w-full overflow-hidden rounded-[8px] bg-ink/5', className)}
    />
  );
}
