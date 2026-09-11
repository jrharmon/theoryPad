import { usePractice } from '@/store/practice';

/**
 * The persistent bar across a running exercise: what it is, how many passes
 * you have played, and how far through this one you are.
 */
export function RunningChrome({ name }: { name: string }) {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const practice = usePractice();
  if (!snapshot) return null;

  const { passesPlayed, state, phraseTick } = snapshot;
  const paused = state === 'paused';
  const running = state === 'playing' || state === 'count-in' || paused;
  const total = instance?.kind === 'played' ? instance.phrase.totalTicks : 0;
  const progress = running && total > 0 ? Math.min(1, phraseTick / total) : 0;

  return (
    <div className="flex items-center gap-4 bg-ink px-6 py-3 text-bg">
      <span className="text-[13px] font-semibold">{name}</span>
      <span className="text-[13px] tabular-nums opacity-75" data-testid="passes">
        {passesPlayed === 1 ? '1 pass' : `${passesPlayed} passes`}
      </span>

      <div className="h-1.5 flex-1 bg-bg/25" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>

      {running && (
        <button
          type="button"
          onClick={() => (paused ? practice.resume() : practice.pause())}
          className="border border-bg/40 px-3 py-1 text-[13px] font-semibold hover:bg-bg/10"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      )}
    </div>
  );
}
