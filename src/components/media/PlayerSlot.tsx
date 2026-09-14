import { useEffect, useRef } from 'react';
import { cn } from 'cn';
import type { YouTubePlayer } from '@/audio/backing';

/**
 * Where a YouTube player shows. The player's node is moved in once and left
 * there: moving an iframe reloads it, so anything that enlarges the video
 * restyles this slot instead.
 */
export function PlayerSlot({ player, className }: { player: YouTubePlayer | null; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

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
