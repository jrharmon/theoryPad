import { PauseIcon, PlayIcon, RotateCcwIcon, SquareIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { tickToBarBeat } from '@/domain/phrase';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';
import { BackingMenu, TrackSpeed } from './BackingMenu';
import { CountInMenu } from './CountInMenu';
import { MetronomeMenu } from './MetronomeMenu';
import { BackingDroppedNote } from './BackingPanel';
import { formatClock, runClock } from './runClock';
import { useRunnerTicks } from './usePracticeBody';

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
  const inRoutine = usePractice((s) => s.routineId !== null);
  const startingTrack = usePractice((s) => s.backing.starting);
  const needsClick = usePractice((s) => s.backing.needsClick);
  const state = snapshot?.state;
  // The runner only emits when something happens to it, so the position and
  // the clock are read off the clock itself, frame by frame.
  const ticks = useRunnerTicks(
    state === 'playing' || state === 'count-in' || state === 'paused',
  );

  if (!snapshot || state === undefined) return null;

  const { currentTempo, targetTempo } = snapshot;
  const phrase = instance?.kind === 'played' ? instance.phrase : null;
  // A theory set has no pulse: no tempo, no click, nothing to pause.
  const theory = instance?.kind === 'theory';
  const position = phrase ? tickToBarBeat(phrase, ticks.phraseTick) : null;
  const clock = theory ? null : runClock({ ...snapshot, ...ticks }, phrase);
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
            title="Play  ( Space )"
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
          <Button
            size="icon-lg"
            variant="secondary"
            aria-label="Starting"
            data-testid="starting"
          >
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
          <span className="num w-12 text-center text-lead font-extrabold" data-testid="tempo">
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
            <span className="ml-1 text-meta text-ink-muted tabular-nums">
              target {targetTempo}
            </span>
          )}
        </div>
      )}

      {/* Shown before you start too: how long the exercise runs for is worth
          knowing with a guitar in your hands and no hand free to work it out. */}
      {clock && (
        <span className="num text-body-sm font-extrabold" data-testid="run-clock">
          {formatClock(clock.elapsedSeconds)}
          <span className="font-semibold text-ink-muted">
            {' / '}
            {formatClock(clock.totalSeconds)}
          </span>
        </span>
      )}

      {/* A routine item can be several passes, and which one you are on is the
          one thing the clock cannot tell you. Loop runs past the total on
          purpose: that is what "Stay on this" is doing. */}
      {inRoutine && (
        <span
          className="num text-body-sm font-extrabold"
          data-testid="rep-count"
          aria-label={`Pass ${snapshot.passesThisRun + 1} of ${snapshot.passes}`}
        >
          {snapshot.passesThisRun + 1}
          <span className="font-semibold text-ink-muted">
            {' / '}
            {snapshot.passes}
          </span>
        </span>
      )}

      {!theory && <LoopToggle />}
      {!theory && <MetronomeMenu />}
      {!theory && <CountInMenu />}
      {!theory && <BackingMenu />}
      {!theory && state === 'brief' && <BackingDroppedNote />}
      {!theory && <SoundsNote />}

      {state === 'count-in' && (
        <span className="text-body-sm font-extrabold tabular-nums">Counting in…</span>
      )}
      {state === 'playing' && position && (
        <span className="num text-body-sm font-extrabold" data-testid="position">
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

/**
 * Quiet word while the samples download, and once if they could not: either
 * way the synth is playing, and nothing waited for it.
 */
function SoundsNote() {
  const status = useSounds((s) => s.status);
  if (status === 'loading')
    return <span className="text-meta text-ink-muted">Loading sounds…</span>;
  if (status === 'failed') {
    return (
      <span className="text-meta text-ink-muted">
        Sounds didn’t load — the synth plays instead.
      </span>
    );
  }
  return null;
}

/**
 * Loop, remembered app-wide. In a routine it holds you on the current item.
 * The metronome is a menu of its own, saved to the exercise or item.
 */
export function LoopToggle() {
  const practice = usePractice();
  const loop = useSettings((s) => s.settings.audio.loop);
  const inRoutine = usePractice((s) => s.routineId !== null);
  return (
    // On is ink, off is quiet: the accent stays with Play.
    <ToggleButton on={loop} quietOff onClick={() => void practice.setLoop(!loop)}>
      {inRoutine ? 'Stay on this' : 'Loop'}
    </ToggleButton>
  );
}
