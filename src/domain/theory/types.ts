import type { KeyMode } from '@/domain/music';

export interface Option {
  id: string;
  label: string;
}

/**
 * What a wrong answer is shown alongside. Data rather than a component, so any
 * theory exercise can use any of them.
 */
export type FeedbackVisual =
  /**
   * A stretch of the circle, the correct key filled and the picked one marked.
   * `positions` maps each option to its place on the circle, so the picked
   * one can be shown wherever it is.
   */
  | { kind: 'circle-of-fifths'; correct: number; positions: Record<string, number> }
  /** The key's seven notes, with the degrees in question picked out. */
  | { kind: 'note-row'; keyMode: KeyMode; highlight: number[] };

export interface Feedback {
  /** The teaching sentence: why the answer is what it is. */
  rule: string;
  /** What each wrong option actually is — "That's E major." — keyed by option id. */
  whatItIs?: Record<string, string>;
  visual?: FeedbackVisual;
}

interface QuestionBase {
  id: string;
  prompt: string;
  /**
   * What the question was about, for the log — "key:Eb", "D dorian". Lets a
   * later milestone lean toward what you get wrong without timing anything.
   */
  subject: string;
  feedback: Feedback;
}

export interface SinglePickQuestion extends QuestionBase {
  kind: 'single-pick';
  /** Two to six, so a number key can answer. */
  options: Option[];
  correctOptionId: string;
}

export interface TableRow {
  id: string;
  /** Cells shown already filled, by column id. */
  given: Record<string, string>;
  options: Option[];
  correctOptionId: string;
}

/**
 * Several cells, filled in and then submitted together. Right only if every
 * cell is — one question, one right or wrong.
 */
export interface TableFillQuestion extends QuestionBase {
  kind: 'table-fill';
  /** "The root is given." */
  note?: string;
  columns: { id: string; label: string }[];
  /** The column the player fills. */
  answerColumnId: string;
  rows: TableRow[];
}

export type TheoryQuestion = SinglePickQuestion | TableFillQuestion;

/** One question's outcome, as logged. */
export interface Answer {
  subject: string;
  correct: boolean;
}

/** Whether a table's answers, one option id per row, are all right. */
export function tableIsCorrect(
  question: TableFillQuestion,
  picks: readonly (string | null)[],
): boolean {
  return question.rows.every((row, i) => picks[i] === row.correctOptionId);
}
