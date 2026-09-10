import { Button } from '@/components/ui/button';
import { tickToBarBeat } from '@/domain/phrase';
import { usePractice } from '@/store/practice';

/**
 * The controls, frozen to the bottom of the screen.
 *
 * A generated exercise can run to twenty-one bars, and having to scroll to the
 * end to press start and back to the top to read it was the wrong shape.
 */
export function TransportBar() {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const practice = usePractice();

  if (!snapshot) return null;

  const { state, currentTempo, targetTempo } = snapshot;
  const phrase = instance?.kind === 'played' ? instance.phrase : null;
  const position = phrase ? tickToBarBeat(phrase, snapshot.phraseTick) : null;
  const idle = state === 'brief' || state === 'rep-complete';
  const running = state === 'playing' || state === 'count-in';

  return (
    <div className="flex flex-wrap items-center gap-3 px-8 py-3">
      {state === 'done' ? (
        <span className="text-[13px] text-ink/55">Set finished.</span>
      ) : (
        <>
          {idle && (
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

          {state === 'count-in' && (
            <span className="text-[13px] font-extrabold tabular-nums">Counting in…</span>
          )}

          {state === 'playing' && position && (
            <span className="text-[13px] font-extrabold tabular-nums" data-testid="position">
              Bar {position.bar + 1} · beat {position.beat + 1}
            </span>
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
                <span className="ml-1 text-[12px] text-ink/55 tabular-nums">
                  target {targetTempo}
                </span>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => practice.reroll()}>
              Re-roll
            </Button>
            <Button variant="secondary" size="sm" onClick={() => practice.skipRep()}>
              Skip
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void practice.end()}>
              End
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
