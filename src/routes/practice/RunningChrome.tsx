import { usePractice } from '@/store/practice';

/**
 * The persistent bar across a running exercise: where you are, and the one
 * control that must always be reachable.
 */
export function RunningChrome({ name }: { name: string }) {
  const snapshot = usePractice((s) => s.snapshot);
  const practice = usePractice();
  if (!snapshot) return null;

  const { repIndex, totalReps, state } = snapshot;
  const paused = state === 'paused';
  const running = state === 'playing' || state === 'count-in' || paused;

  return (
    <div className="flex items-center gap-4 bg-ink px-6 py-3 text-bg">
      <span className="text-[16px] font-extrabold tabular-nums">
        {String(Math.min(repIndex + 1, totalReps)).padStart(2, '0')} / {String(totalReps).padStart(2, '0')}
      </span>
      <span className="text-[13px] opacity-75">{name}</span>

      <div className="flex flex-1 gap-[3px]" aria-hidden>
        {Array.from({ length: totalReps }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 ${
              i < repIndex ? 'bg-accent' : i === repIndex ? 'bg-accent-400' : 'bg-bg/25'
            }`}
          />
        ))}
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
