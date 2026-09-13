import { majorAt, minorAt, wrapPosition } from '@/domain/theory';

/** "3♭", "2♯", "0". */
function count(position: number): string {
  if (position === 0) return '0';
  return `${Math.abs(position)}${position > 0 ? '♯' : '♭'}`;
}

/**
 * A stretch of the circle of fifths around the answer: the correct key filled,
 * the one you picked outlined — so a wrong answer shows where you were
 * against where you should have been. Widens to include a pick further away.
 */
export function CircleStrip({ correct, picked }: { correct: number; picked?: number }) {
  // Distance around the circle, the short way, so the strip centres sensibly.
  const offset =
    picked === undefined ? 0 : ((((picked - correct + 6) % 12) + 12) % 12) - 6;
  const low = Math.min(-3, offset);
  const high = Math.max(3, offset);
  const cells = Array.from({ length: high - low + 1 }, (_, i) => wrapPosition(correct + low + i));

  return (
    <div className="flex border border-rule" data-testid="circle-strip" role="img" aria-label="Circle of fifths">
      {cells.map((position, i) => {
        const isCorrect = position === correct;
        const isPicked = picked !== undefined && position === wrapPosition(picked) && !isCorrect;
        return (
          <div
            key={`${position}-${i}`}
            data-testid={isCorrect ? 'circle-correct' : isPicked ? 'circle-picked' : undefined}
            className={[
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2',
              i > 0 ? 'border-l border-rule' : '',
              isCorrect ? 'bg-accent text-white' : '',
              isPicked ? 'outline-2 -outline-offset-2 outline-ink' : '',
            ].join(' ')}
          >
            <span className="text-[15px] font-extrabold">{majorAt(position)}</span>
            <span className={`text-[11px] ${isCorrect ? 'text-white/85' : 'text-ink/55'}`}>
              {minorAt(position)}m
            </span>
            <span className={`text-[11px] tabular-nums ${isCorrect ? 'text-white/85' : 'text-ink/55'}`}>
              {count(position)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
