import { findExerciseDefinition } from '@/exercises/registry';
import { usePractice } from '@/store/practice';

/**
 * The persistent bar across a running exercise: what it is, how many passes
 * you have played, and how far through this one you are.
 */
export function RunningChrome({ name }: { name: string }) {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const routine = usePractice((s) => s.routineSnapshot);
  const practice = usePractice();
  if (!snapshot) return null;

  if (routine) {
    const { index, items } = routine;
    const current = findExerciseDefinition(items[index]?.definitionId ?? '')?.name;
    const next = findExerciseDefinition(items[index + 1]?.definitionId ?? '')?.name;
    return (
      <div
        className="flex items-center gap-4 bg-chrome px-6 py-3 text-chrome-ink"
        data-testid="routine-chrome"
      >
        <span className="num text-[16px] font-extrabold">
          {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
        <span className="text-[13px] font-semibold">{current}</span>
        <div className="flex flex-1 gap-[3px]" aria-hidden>
          {items.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 flex-1 ${i < index ? 'bg-fill' : i === index ? 'bg-fill-current' : 'bg-track'}`}
            />
          ))}
        </div>
        <span className="text-[12px] opacity-70">
          {next ? `Next: ${next}` : `${name} · last one`}
        </span>
      </div>
    );
  }

  const { passesPlayed, state, phraseTick } = snapshot;
  const paused = state === 'paused';
  // A theory set has no clock: nothing to pause, and no phrase to be through.
  const theory = instance?.kind === 'theory';
  const running = !theory && (state === 'playing' || state === 'count-in' || paused);
  const total = instance?.kind === 'played' ? instance.phrase.totalTicks : 0;
  const progress = running && total > 0 ? Math.min(1, phraseTick / total) : 0;

  return (
    <div className="flex items-center gap-4 bg-chrome px-6 py-3 text-chrome-ink">
      <span className="text-[13px] font-semibold">{name}</span>
      <span className="num text-[13px] opacity-75" data-testid="passes">
        {theory
          ? passesPlayed === 1
            ? '1 set'
            : `${passesPlayed} sets`
          : passesPlayed === 1
            ? '1 pass'
            : `${passesPlayed} passes`}
      </span>

      <div className={`h-1.5 flex-1 ${theory ? '' : 'bg-track'}`} aria-hidden>
        {!theory && (
          <div className="h-full bg-fill" style={{ width: `${progress * 100}%` }} />
        )}
      </div>

      {running && (
        <button
          type="button"
          onClick={() => (paused ? practice.resume() : practice.pause())}
          className="border border-chrome-ink/40 px-3 py-1 text-[13px] font-semibold hover:bg-chrome-ink/10"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      )}
    </div>
  );
}
