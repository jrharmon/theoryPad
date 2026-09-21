import type { TheoryQuestion } from '@/domain/theory';
import { CircleStrip } from './CircleStrip';
import { NoteRow } from './NoteRow';

/**
 * The correction: what you picked actually is, the rule, and a picture of it.
 * Shown after a wrong answer, and stays until you move on.
 */
export function TheoryFeedback({
  question,
  pickedIds,
}: {
  question: TheoryQuestion;
  /** What was chosen: one option, or every option ticked in a multi-pick. */
  pickedIds?: readonly string[];
}) {
  const { feedback } = question;
  // Each wrong pick is named, so a multi-pick says what all of them were.
  const whatItIs = (pickedIds ?? [])
    .map((id) => feedback.whatItIs?.[id])
    .filter((line): line is string => line !== undefined);
  const firstPick = pickedIds?.[0];
  const visual = feedback.visual;

  return (
    <div className="space-y-3 border-l-2 border-accent pl-4" data-testid="theory-feedback">
      {whatItIs.map((line) => (
        <p key={line} className="text-body-sm text-ink-muted">
          {line}
        </p>
      ))}
      <p className="text-body font-semibold">{feedback.rule}</p>
      {visual?.kind === 'circle-of-fifths' && (
        <CircleStrip
          correct={visual.correct}
          {...(firstPick !== undefined && visual.positions[firstPick] !== undefined
            ? { picked: visual.positions[firstPick] }
            : {})}
        />
      )}
      {visual?.kind === 'note-row' && (
        <NoteRow keyMode={visual.keyMode} highlight={visual.highlight} />
      )}
    </div>
  );
}
