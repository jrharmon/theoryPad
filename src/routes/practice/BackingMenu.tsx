import { useState } from 'react';
import { Link } from 'react-router';
import type { BackingChoice, Video } from '@/data';
import { modeTitle } from '@/domain/music';
import { SPEED_MUSHY_BELOW, speedPercent } from '@/domain/backing';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from 'cn';
import { usePractice } from '@/store/practice';

/** What the transport says is playing under the exercise. */
function label(resolved: ReturnType<typeof usePractice.getState>['backing']['resolved']): string {
  if (resolved.kind === 'drone') return 'Drone';
  if (resolved.kind === 'video') return resolved.video.title;
  return 'None';
}

/**
 * None, the drone, or a track in the current key. Nothing is chosen for you;
 * what you choose is remembered. Changed between passes, not during one.
 */
export function BackingMenu() {
  const backing = usePractice((s) => s.backing);
  const state = usePractice((s) => s.snapshot?.state);
  const keyMode = usePractice((s) => s.routineSnapshot?.keyMode ?? s.snapshot?.keyMode);
  const choose = usePractice((s) => s.chooseBacking);
  const [open, setOpen] = useState(false);
  const running = state === 'playing' || state === 'count-in' || state === 'paused';
  const key = keyMode ? `${keyMode.tonic} ${modeTitle(keyMode.mode)}` : 'this key';

  const pick = (choice: BackingChoice) => {
    setOpen(false);
    void choose(choice);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={running}
          title={running ? 'Change the backing between passes' : undefined}
          className="max-w-[260px]"
          data-testid="backing-menu"
        >
          <span className="text-ink/64">Backing</span>
          <span className="truncate">{label(backing.resolved)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[340px] p-2">
        <ul className="space-y-0.5" role="listbox" aria-label="Backing">
          <Option
            selected={backing.resolved.kind === 'none'}
            title="None"
            detail="The synth plays the notes, with the metronome."
            onPick={() => pick({ kind: 'none' })}
          />
          <Option
            selected={backing.resolved.kind === 'drone'}
            title="Drone"
            detail={`Root and fifth of ${key}, held under the notes and the metronome.`}
            onPick={() => pick({ kind: 'drone' })}
          />
          {backing.options.map((video) => (
            <Option
              key={video.id}
              selected={backing.resolved.kind === 'video' && backing.resolved.video.id === video.id}
              title={video.title}
              detail={trackDetail(video)}
              onPick={() => pick({ kind: 'video', id: video.id })}
            />
          ))}
        </ul>
        {backing.options.length === 0 && (
          <p className="px-2 pt-2 pb-1 text-[12px] text-ink/64">
            No tracks in {key} yet.{' '}
            <Link to="/settings" className="text-accent-text underline">
              Add one in Settings
            </Link>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function trackDetail(video: Video): string {
  return [
    video.scope.kind === 'exercise' ? 'this exercise’s own' : null,
    video.bpm !== undefined ? `${video.bpm} bpm` : null,
    video.progression,
    ...video.tags,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Option({
  selected,
  title,
  detail,
  onPick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onPick}
        className={cn(
          'w-full rounded-[8px] px-2 py-1.5 text-left hover:bg-ink/5',
          selected && 'bg-toggle-on text-toggle-on-ink hover:bg-toggle-on/85',
        )}
      >
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className={cn('block text-[12px]', selected ? 'opacity-80' : 'text-ink/64')}>{detail}</span>
      </button>
    </li>
  );
}

/** "75%" beside the tempo while a track sets it; flagged where YouTube's audio smears. */
export function TrackSpeed() {
  const backing = usePractice((s) => s.backing);
  if (backing.resolved.kind !== 'video') return null;
  const mushy = backing.speed < SPEED_MUSHY_BELOW;
  return (
    <span
      className={cn('text-[12px] tabular-nums', mushy ? 'text-destructive' : 'text-ink/64')}
      title={mushy ? 'Below 50% the recording gets smeared' : 'The track’s speed'}
      data-testid="track-speed"
    >
      {speedPercent(backing.speed)} speed
    </span>
  );
}
