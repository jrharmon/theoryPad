import type { TableFillQuestion } from '@/domain/theory';
import { Button } from '@/components/ui/button';

/**
 * A table to fill and then submit. Nothing is marked until it is submitted,
 * and then it is one answer: right only if every cell is. After a wrong
 * submission each cell shows whether it was right, and what it should be.
 */
export function TableFill({
  question,
  picks,
  activeRow,
  submitted,
  onPick,
  onFocusRow,
  onSubmit,
}: {
  question: TableFillQuestion;
  picks: readonly (string | null)[];
  /** The row number keys fill. */
  activeRow: number;
  submitted: boolean;
  onPick: (row: number, optionId: string) => void;
  onFocusRow: (row: number) => void;
  onSubmit: () => void;
}) {
  const complete = picks.every((p) => p !== null);
  const givenColumns = question.columns.filter((c) => c.id !== question.answerColumnId);
  const answerLabel = question.columns.find((c) => c.id === question.answerColumnId)?.label;

  return (
    <div>
      <div
        className="overflow-hidden rounded-control border border-rule"
        role="table"
        aria-label={question.prompt}
      >
        <div className="flex border-b border-rule bg-ink/5 px-3 py-1.5" role="row">
          {givenColumns.map((c) => (
            <span key={c.id} className="kicker w-20 shrink-0" role="columnheader">
              {c.label}
            </span>
          ))}
          <span className="kicker" role="columnheader">
            {answerLabel}
          </span>
        </div>

        {question.rows.map((row, r) => {
          const picked = picks[r] ?? null;
          const right = picked === row.correctOptionId;
          const active = !submitted && r === activeRow;
          return (
            <div
              key={row.id}
              role="row"
              data-testid="table-row"
              data-active={active || undefined}
              onClick={() => !submitted && onFocusRow(r)}
              className={[
                'flex items-center px-3 py-2',
                r > 0 ? 'border-t border-rule' : '',
                active ? 'bg-ink/5' : '',
              ].join(' ')}
            >
              {givenColumns.map((c) => (
                <span
                  key={c.id}
                  className="w-20 shrink-0 text-[15px] font-extrabold"
                  role="cell"
                >
                  {row.given[c.id]}
                </span>
              ))}
              <div className="flex flex-wrap items-center gap-1" role="cell">
                {row.options.map((option, i) => {
                  const isPicked = option.id === picked;
                  const showCorrect = submitted && !right && option.id === row.correctOptionId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={submitted}
                      aria-pressed={isPicked}
                      data-toggle={isPicked && !submitted ? 'on' : 'off'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(r, option.id);
                      }}
                      className={[
                        'min-w-12 rounded-full border px-2.5 py-1 text-[14px] font-semibold',
                        // Picked, before the set is marked: the toggle look.
                        isPicked && !submitted ? 'border-transparent' : '',
                        isPicked && submitted && right
                          ? 'border-accent bg-accent text-on-accent'
                          : '',
                        isPicked && submitted && !right
                          ? 'border-2 border-ink line-through'
                          : '',
                        showCorrect ? 'border-accent bg-accent text-on-accent' : '',
                        !isPicked && !showCorrect
                          ? 'border-toggle-edge bg-paper hover:border-ink disabled:text-ink/35 disabled:hover:border-toggle-edge'
                          : '',
                      ].join(' ')}
                    >
                      {active && <span className="mr-1 text-[10px] text-ink/45">{i + 1}</span>}
                      {option.label}
                    </button>
                  );
                })}
                {submitted && (
                  <span
                    className={`ml-2 text-[13px] font-semibold ${right ? 'text-ink/50' : 'text-destructive'}`}
                  >
                    {right ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!submitted && (
        <div className="mt-4 flex items-center gap-3">
          <Button disabled={!complete} onClick={onSubmit} data-testid="submit-table">
            Submit
          </Button>
          <span className="text-[12px] text-ink/50">
            {complete
              ? 'Enter submits.'
              : 'Number keys fill the highlighted row. Nothing is marked until you submit.'}
          </span>
        </div>
      )}
    </div>
  );
}
