import type { TheoryQuestion } from '@/domain/theory';
import { CircleStrip } from './CircleStrip';
import { NoteRow } from './NoteRow';

/**
 * The correction: what you picked actually is, the rule, and a picture of it.
 * Shown after a wrong answer, and stays until you move on.
 */
export function TheoryFeedback({
  question,
  pickedId,
}: {
  question: TheoryQuestion;
  /** Single-pick only: the option chosen. */
  pickedId?: string | undefined;
}) {
  const { feedback } = question;
  const whatItIs = pickedId ? feedback.whatItIs?.[pickedId] : undefined;
  const visual = feedback.visual;

  return (
    <div className="space-y-3 border-l-2 border-accent pl-4" data-testid="theory-feedback">
      {whatItIs && <p className="text-body-sm text-ink-muted">{whatItIs}</p>}
      <p className="text-body font-semibold">{feedback.rule}</p>
      {visual?.kind === 'circle-of-fifths' && (
        <CircleStrip
          correct={visual.correct}
          {...(pickedId !== undefined && visual.positions[pickedId] !== undefined
            ? { picked: visual.positions[pickedId] }
            : {})}
        />
      )}
      {visual?.kind === 'note-row' && (
        <NoteRow keyMode={visual.keyMode} highlight={visual.highlight} />
      )}
    </div>
  );
}
