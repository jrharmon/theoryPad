import { PauseIcon, PlayIcon, RotateCcwIcon, SquareIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tickToBarBeat } from '@/domain/phrase';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { BackingMenu, TrackSpeed } from './BackingMenu';
import { CountInMenu } from './CountInMenu';
import { BackingDroppedNote } from './BackingPanel';

/**
 * The controls, frozen to the bottom of the screen.
 *
 * A generated exercise can run to twenty-one bars, and having to scroll to the
 * end to press start and back to the top to read it was the wrong shape.
 *
 * There is no End: leaving the screen is how you finish, and every pass is
 * logged as it ends, so there is nothing to remember to press. Stop and
 * Restart go back to the top of the same material; skip appears only in a
 * routine, where there is a next exercise to skip to.
 */
export function TransportBar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const practice = usePractice();
  const inRoutine = usePractice((s) => s.routine !== null);
  const startingTrack = usePractice((s) => s.backing.starting);
  const needsClick = usePractice((s) => s.backing.needsClick);

  if (!snapshot) return null;

  const { state, currentTempo, targetTempo } = snapshot;
  const phrase = instance?.kind === 'played' ? instance.phrase : null;
  // A theory set has no pulse: no tempo, no click, nothing to pause.
  const theory = instance?.kind === 'theory';
  const position = phrase ? tickToBarBeat(phrase, snapshot.phraseTick) : null;
  const running = state === 'playing' || state === 'count-in';

  return (
    <div className="flex flex-wrap items-center gap-3 px-[18px] py-2.5">
      {/* Icons, not words: the transport is read at a glance from behind a guitar. */}
      {state === 'brief' &&
        !startingTrack &&
        (theory ? (
          <Button size="lg" onClick={() => void practice.play()} data-testid="play">
            {snapshot.lastSet ? 'Again' : 'Start'}
          </Button>
        ) : (
          <Button
            size="icon-lg"
            onClick={() => void practice.play()}
            aria-label="Play"
            title="Play  ( Enter )"
            data-testid="play"
          >
            <PlayIcon className="size-5 fill-current" />
          </Button>
        ))}

      {/* A track takes a moment to sound. The transport just looks like it is
          playing — a "starting…" state only draws the eye to the wait. The
          exception is a browser holding the video back, which needs a press. */}
      {startingTrack &&
        (needsClick ? (
          <Button size="lg" variant="secondary" disabled data-testid="starting-track">
            Press play on the video
          </Button>
        ) : (
          <Button size="icon-lg" variant="secondary" aria-label="Starting" data-testid="starting">
            <PauseIcon className="size-5 fill-current" />
          </Button>
        ))}

      {!theory && !startingTrack && (running || state === 'paused') && (
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-lg"
            variant={state === 'paused' ? 'default' : 'secondary'}
            onClick={() => (state === 'paused' ? practice.resume() : practice.pause())}
            aria-label={state === 'paused' ? 'Resume' : 'Pause'}
            title={`${state === 'paused' ? 'Resume' : 'Pause'}  ( Space )`}
            data-testid="pause"
          >
            {state === 'paused' ? (
              <PlayIcon className="size-5 fill-current" />
            ) : (
              <PauseIcon className="size-5 fill-current" />
            )}
          </Button>
          {/* A routine runs hands-off, but a pass that fell apart can still go again. */}
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => void practice.restart()}
            aria-label="Restart"
            title="From the top, counted in  ( Enter )"
            data-testid="restart"
          >
            <RotateCcwIcon className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => practice.stop()}
            aria-label="Stop"
            title="Back to the top  ( Backspace )"
            data-testid="stop"
          >
            <SquareIcon className="size-3.5 fill-current" />
          </Button>
        </div>
      )}

      {!theory && currentTempo !== null && (
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => practice.nudgeTempo(-2)}
            aria-label="Slower"
          >
            −
          </Button>
          <span
            className="num w-12 text-center text-[17px] font-extrabold"
            data-testid="tempo"
          >
            {currentTempo}
          </span>
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => practice.nudgeTempo(2)}
            aria-label="Faster"
          >
            +
          </Button>
          <TrackSpeed />
          {targetTempo !== null && currentTempo !== targetTempo && (
            <span className="ml-1 text-[12px] text-ink/64 tabular-nums">target {targetTempo}</span>
          )}
        </div>
      )}

      {!theory && <PlaybackToggles />}
      {!theory && <CountInMenu />}
      {!theory && <BackingMenu />}
      {!theory && state === 'brief' && <BackingDroppedNote />}

      {state === 'count-in' && (
        <span className="text-[13px] font-extrabold tabular-nums">Counting in…</span>
      )}
      {state === 'playing' && position && (
        <span className="num text-[13px] font-extrabold" data-testid="position">
          Bar {position.bar + 1} · beat {position.beat + 1}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {onOpenSettings && (
          <Button variant="secondary" size="sm" onClick={onOpenSettings}>
            Settings
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => practice.reroll()}>
          Re-roll
        </Button>
        {/* Only a routine has somewhere to skip to. */}
        {inRoutine && (
          <Button variant="secondary" size="sm" onClick={() => practice.skip()}>
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}

/** Metronome and loop. Remembered app-wide, and applied straight away. */
export function PlaybackToggles() {
  const practice = usePractice();
  const audio = useSettings((s) => s.settings.audio);
  const inRoutine = usePractice((s) => s.routine !== null);
  // A track is the click: the metronome waits it out, and says why.
  const underTrack = usePractice((s) => s.backing.resolved.kind === 'video');
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Playback">
      <Toggle
        label="Metronome"
        on={audio.metronomeEnabled && !underTrack}
        disabled={underTrack}
        title={underTrack ? 'Muted under a backing track' : undefined}
        onChange={(on) => void practice.setMetronome(on)}
      />
      <Toggle
        // In a routine, looping holds you on the current exercise.
        label={inRoutine ? 'Stay on this' : 'Loop'}
        on={audio.loop}
        onChange={(on) => void practice.setLoop(on)}
      />
    </div>
  );
}

/** On is ink, off is quiet: the accent stays with Play. */
function Toggle({
  label,
  on,
  onChange,
  disabled = false,
  title,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  title?: string | undefined;
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-pressed={on}
      disabled={disabled}
      title={title}
      className={`rounded-toggle ${on ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85' : 'text-toggle-off-ink'}`}
      onClick={() => onChange(!on)}
    >
      {label}
    </Button>
  );
}
