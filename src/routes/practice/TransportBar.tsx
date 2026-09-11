import { Button } from '@/components/ui/button';
import { tickToBarBeat } from '@/domain/phrase';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';

/**
 * The controls, frozen to the bottom of the screen.
 *
 * A generated exercise can run to twenty-one bars, and having to scroll to the
 * end to press start and back to the top to read it was the wrong shape.
 *
 * There is no End and no Skip: leaving the screen is how you finish, and every
 * pass is logged as it ends, so there is nothing to remember to press.
 */
export function TransportBar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const practice = usePractice();
  const audio = useSettings((s) => s.settings.audio);

  if (!snapshot) return null;

  const { state, currentTempo, targetTempo } = snapshot;
  const phrase = instance?.kind === 'played' ? instance.phrase : null;
  const position = phrase ? tickToBarBeat(phrase, snapshot.phraseTick) : null;
  const running = state === 'playing' || state === 'count-in';

  return (
    <div className="flex flex-wrap items-center gap-3 px-8 py-3">
      {state === 'brief' && (
        <Button size="lg" onClick={() => void practice.play()} data-testid="play">
          Play
        </Button>
      )}

      {(running || state === 'paused') && (
        <Button
          size="lg"
          variant={state === 'paused' ? 'default' : 'secondary'}
          onClick={() => (state === 'paused' ? practice.resume() : practice.pause())}
          data-testid="pause"
        >
          {state === 'paused' ? 'Resume' : 'Pause'}
        </Button>
      )}

      {currentTempo !== null && (
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
            className="w-12 text-center text-[17px] font-extrabold tabular-nums"
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
          {targetTempo !== null && currentTempo !== targetTempo && (
            <span className="ml-1 text-[12px] text-ink/55 tabular-nums">target {targetTempo}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1" role="group" aria-label="Playback">
        <Toggle
          label="Metronome"
          on={audio.metronomeEnabled}
          onChange={(on) => void practice.setMetronome(on)}
        />
        <Toggle
          label="Count-in"
          on={audio.countInBars > 0}
          onChange={(on) => void practice.setCountIn(on)}
        />
        <Toggle label="Loop" on={audio.loop} onChange={(on) => void practice.setLoop(on)} />
      </div>

      {state === 'count-in' && (
        <span className="text-[13px] font-extrabold tabular-nums">Counting in…</span>
      )}
      {state === 'playing' && position && (
        <span className="text-[13px] font-extrabold tabular-nums" data-testid="position">
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
      </div>
    </div>
  );
}

/** On is ink, off is quiet: the accent stays with Play. */
function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-pressed={on}
      className={on ? 'bg-ink text-bg hover:bg-ink/85' : 'text-ink/45'}
      onClick={() => onChange(!on)}
    >
      {label}
    </Button>
  );
}
