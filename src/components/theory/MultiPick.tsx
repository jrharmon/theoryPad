import type { MultiPickQuestion } from '@/domain/theory';
import { Button } from '@/components/ui/button';

/**
 * Tick every option that belongs, then submit. Like the table, nothing is
 * marked until it is submitted, and then it is one answer: right only if the
 * ticks match exactly. Afterwards each option says which of the four things
 * it was — right, wrongly ticked, missed, or correctly left alone.
 */
export function MultiPick({
  question,
  picked,
  submitted,
  onToggle,
  onSubmit,
}: {
  question: MultiPickQuestion;
  picked: readonly string[];
  submitted: boolean;
  onToggle: (optionId: string) => void;
  onSubmit: () => void;
}) {
  const correct = new Set(question.correctOptionIds);

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Answers">
        {question.options.map((option, i) => {
          const isPicked = picked.includes(option.id);
          const belongs = correct.has(option.id);
          const state = !submitted
            ? isPicked
              ? 'on'
              : 'open'
            : isPicked && belongs
              ? 'right'
              : isPicked
                ? 'wrong'
                : belongs
                  ? 'missed'
                  : 'other';
          return (
            <button
              key={option.id}
              type="button"
              disabled={submitted}
              aria-pressed={isPicked}
              data-state={state}
              onClick={() => onToggle(option.id)}
              className={[
                'flex items-center gap-3 rounded-control border px-4 py-3 text-left text-lead font-semibold',
                state === 'open' ? 'border-toggle-edge bg-paper hover:bg-surface' : '',
                state === 'on' ? 'border-ink bg-ink text-paper' : '',
                state === 'right' ? 'border-accent bg-accent text-on-accent' : '',
                state === 'wrong' ? 'border-2 border-ink bg-paper text-ink' : '',
                // Missed: outlined in the accent rather than filled, so a
                // right tick and one you failed to make do not look the same.
                state === 'missed' ? 'border-2 border-accent bg-paper text-ink' : '',
                state === 'other' ? 'border-toggle-edge bg-paper text-ink-faint' : '',
              ].join(' ')}
            >
              <span
                className={`w-5 text-meta tabular-nums ${
                  state === 'right'
                    ? 'text-on-accent/80'
                    : state === 'on'
                      ? 'text-paper/70'
                      : 'text-ink-faint'
                }`}
              >
                {i + 1}
              </span>
              <span className={state === 'wrong' ? 'line-through' : ''}>{option.label}</span>
              {state === 'missed' && (
                <span className="ml-auto text-meta font-semibold text-accent-text">missed</span>
              )}
            </button>
          );
        })}
      </div>

      {!submitted && (
        <div className="mt-4 flex items-center gap-3">
          <Button disabled={picked.length === 0} onClick={onSubmit} data-testid="submit-multi">
            Submit
          </Button>
          <span className="text-meta text-ink-faint">
            {picked.length === 0
              ? 'Number keys tick options. Nothing is marked until you submit.'
              : 'Enter submits.'}
          </span>
        </div>
      )}
    </div>
  );
}
