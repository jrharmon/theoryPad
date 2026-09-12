import type { SinglePickQuestion } from '@/domain/theory';

/**
 * Options in a grid, each with its number key. Once answered, the right one
 * is filled and a wrong pick is outlined; nothing can be picked again.
 */
export function SinglePick({
  question,
  pickedId,
  onPick,
}: {
  question: SinglePickQuestion;
  pickedId: string | null;
  onPick: (optionId: string) => void;
}) {
  const answered = pickedId !== null;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Answers">
      {question.options.map((option, i) => {
        const isCorrect = option.id === question.correctOptionId;
        const isPicked = option.id === pickedId;
        const state = !answered ? 'open' : isCorrect ? 'correct' : isPicked ? 'wrong' : 'other';
        return (
          <button
            key={option.id}
            type="button"
            disabled={answered}
            data-state={state}
            onClick={() => onPick(option.id)}
            className={[
              'flex items-center gap-3 border px-4 py-3 text-left text-[17px] font-semibold',
              state === 'open' ? 'border-divider hover:border-ink' : '',
              state === 'correct' ? 'border-accent bg-accent text-white' : '',
              state === 'wrong' ? 'border-ink border-2 text-ink' : '',
              state === 'other' ? 'border-divider text-ink/40' : '',
            ].join(' ')}
          >
            <span
              className={`w-5 text-[12px] tabular-nums ${state === 'correct' ? 'text-white/80' : 'text-ink/45'}`}
            >
              {i + 1}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
