import { findExerciseDefinition } from '@/exercises/registry';
import { usePractice } from '@/store/practice';
import { useRunnerTicks } from './usePracticeBody';

/**
 * The persistent bar across a running exercise: what it is, how many passes
 * you have played, and how far through this one you are.
 */
export function RunningChrome({ name }: { name: string }) {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const routine = usePractice((s) => s.routineSnapshot);
  const practice = usePractice();
  const state = snapshot?.state;
  // The runner does not emit as the clock moves, so the bar has to read it.
  const { phraseTick } = useRunnerTicks(
    state === 'playing' || state === 'count-in' || state === 'paused',
  );
  if (!snapshot) return null;

  if (routine) {
    const { index, items } = routine;
    const current = findExerciseDefinition(items[index]?.definitionId ?? '')?.name;
    const next = findExerciseDefinition(items[index + 1]?.definitionId ?? '')?.name;
    return (
      <div
        className="flex items-center gap-4 border-b border-rule bg-chrome px-6 py-3 text-chrome-ink"
        data-testid="routine-chrome"
      >
        <span className="num text-body font-extrabold">
          {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
        <span className="text-body-sm font-semibold">{current}</span>
        <div className="flex flex-1 gap-[3px]" aria-hidden>
          {items.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 flex-1 rounded-full ${i < index ? 'bg-fill' : i === index ? 'bg-fill-current' : 'bg-track'}`}
            />
          ))}
        </div>
        <span className="text-meta opacity-70">
          {next ? `Next: ${next}` : `${name} · last one`}
        </span>
      </div>
    );
  }

  const { passesPlayed } = snapshot;
  const paused = state === 'paused';
  // A theory set has no clock: nothing to pause, and no phrase to be through.
  const theory = instance?.kind === 'theory';
  const running = !theory && (state === 'playing' || state === 'count-in' || paused);
  const total = instance?.kind === 'played' ? instance.phrase.totalTicks : 0;
  const progress = running && total > 0 ? Math.min(1, phraseTick / total) : 0;

  return (
    <div className="flex items-center gap-4 border-b border-rule bg-chrome px-6 py-3 text-chrome-ink">
      <span className="text-body-sm font-semibold">{name}</span>
      <span className="num text-body-sm opacity-75" data-testid="passes">
        {theory
          ? passesPlayed === 1
            ? '1 set'
            : `${passesPlayed} sets`
          : passesPlayed === 1
            ? '1 pass'
            : `${passesPlayed} passes`}
      </span>

      <div
        className={`h-1.5 flex-1 overflow-hidden rounded-full ${theory ? '' : 'bg-track'}`}
        aria-hidden
      >
        {!theory && (
          <div
            className="h-full rounded-full bg-fill"
            style={{ width: `${progress * 100}%` }}
          />
        )}
      </div>

      {running && (
        <button
          type="button"
          onClick={() => (paused ? practice.resume() : practice.pause())}
          className="rounded-full border border-rule px-3 py-1 text-body-sm font-semibold hover:bg-chrome-ink/10"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      )}
    </div>
  );
}
