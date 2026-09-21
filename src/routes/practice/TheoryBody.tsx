import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Answer, TheoryQuestion } from '@/domain/theory';
import { multiIsCorrect, tableIsCorrect } from '@/domain/theory';
import type { TheoryInstance } from '@/exercises/types';
import { TheoryFeedback } from '@/components/theory/Feedback';
import { MultiPick } from '@/components/theory/MultiPick';
import { SinglePick } from '@/components/theory/SinglePick';
import { TableFill } from '@/components/theory/TableFill';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { usePractice } from '@/store/practice';

/** How long a right answer is shown before the next question. */
const RIGHT_PAUSE_MS = 700;

/**
 * A theory exercise: the set waits to be started, then its questions one at
 * a time. A right answer moves on by itself; a wrong one stays, with the
 * correction, until you move on — that is where the learning is.
 */
export function TheoryBody({ instance }: { instance: TheoryInstance }) {
  const snapshot = usePractice((s) => s.snapshot);
  if (!snapshot) return null;

  if (snapshot.state !== 'playing') {
    const last = snapshot.lastSet;
    return (
      <div className="sheet mx-8 mt-5 mb-2 max-w-[860px] px-6 py-6" data-testid="theory-ready">
        {last ? (
          <>
            <Kicker accent>Last set</Kicker>
            <p className="num text-hero font-extrabold" data-testid="theory-score">
              {last.correct} of {last.total}
            </p>
            <p className="text-body-sm text-ink-muted tabular-nums">
              {formatSeconds(last.seconds)} · a new set is ready — Enter to start it.
            </p>
          </>
        ) : (
          <p className="text-body text-ink-muted">
            {instance.questions.length} questions. Press Start, or Enter, when you are ready.
          </p>
        )}
      </div>
    );
  }

  // Keyed by the set, so a new set starts clean.
  return (
    <QuestionRun
      key={`${snapshot.variation?.seed}-${snapshot.passesPlayed}`}
      questions={instance.questions}
    />
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} min ${String(s).padStart(2, '0')} sec`;
}

type Phase = 'asking' | 'right' | 'wrong';

function QuestionRun({ questions }: { questions: TheoryQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [picks, setPicks] = useState<(string | null)[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [activeRow, setActiveRow] = useState(0);
  const results = useRef<Answer[]>([]);
  const question = questions[index]!;

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      usePractice.getState().submitSet(results.current);
      return;
    }
    setIndex(index + 1);
    setPhase('asking');
    setPickedId(null);
    setPicks([]);
    setTicked([]);
    setActiveRow(0);
  }, [index, questions.length]);

  const record = useCallback(
    (correct: boolean) => {
      results.current = [...results.current, { subject: question.subject, correct }];
      setPhase(correct ? 'right' : 'wrong');
    },
    [question.subject],
  );

  // A right answer moves on by itself.
  useEffect(() => {
    if (phase !== 'right') return;
    const timer = setTimeout(next, RIGHT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [phase, next]);

  const answerSingle = useCallback(
    (optionId: string) => {
      if (question.kind !== 'single-pick' || phase !== 'asking') return;
      setPickedId(optionId);
      record(optionId === question.correctOptionId);
    },
    [question, phase, record],
  );

  const toggle = useCallback(
    (optionId: string) => {
      if (question.kind !== 'multi-pick' || phase !== 'asking') return;
      setTicked((on) =>
        on.includes(optionId) ? on.filter((id) => id !== optionId) : [...on, optionId],
      );
    },
    [question.kind, phase],
  );

  const submitMulti = useCallback(() => {
    if (question.kind !== 'multi-pick' || phase !== 'asking') return;
    if (ticked.length === 0) return;
    record(multiIsCorrect(question, ticked));
  }, [question, phase, ticked, record]);

  const rows = question.kind === 'table-fill' ? question.rows.length : 0;
  const currentPicks = useMemo(
    () => Array.from({ length: rows }, (_, i) => picks[i] ?? null),
    [rows, picks],
  );

  const fill = useCallback(
    (row: number, optionId: string) => {
      if (phase !== 'asking') return;
      const next = [...currentPicks];
      next[row] = optionId;
      setPicks(next);
      // On to the next empty row, so number keys can fill the table in one go.
      const after = next.findIndex((p, i) => p === null && i > row);
      const any = next.findIndex((p) => p === null);
      setActiveRow(after !== -1 ? after : any !== -1 ? any : row);
    },
    [phase, currentPicks],
  );

  const submitTable = useCallback(() => {
    if (question.kind !== 'table-fill' || phase !== 'asking') return;
    if (currentPicks.some((p) => p === null)) return;
    record(tableIsCorrect(question, currentPicks));
  }, [question, phase, currentPicks, record]);

  // Number keys answer; Enter submits a table or moves on after a correction.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        if (phase === 'wrong') next();
        else if (phase !== 'asking') return;
        else if (question.kind === 'table-fill') submitTable();
        else if (question.kind === 'multi-pick') submitMulti();
        return;
      }
      if (question.kind === 'table-fill' && phase === 'asking') {
        if (event.key === 'ArrowDown') setActiveRow((r) => Math.min(rows - 1, r + 1));
        if (event.key === 'ArrowUp') setActiveRow((r) => Math.max(0, r - 1));
      }
      const n = Number(event.key);
      // A family question offers all seven chords of the key, so 7 answers too.
      if (!Number.isInteger(n) || n < 1 || n > 7 || phase !== 'asking') return;
      if (question.kind === 'single-pick') {
        const option = question.options[n - 1];
        if (option) answerSingle(option.id);
      } else if (question.kind === 'multi-pick') {
        const option = question.options[n - 1];
        if (option) toggle(option.id);
      } else {
        const option = question.rows[activeRow]?.options[n - 1];
        if (option) fill(activeRow, option.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    question,
    activeRow,
    rows,
    next,
    submitTable,
    submitMulti,
    answerSingle,
    fill,
    toggle,
  ]);

  return (
    <div className="sheet mx-8 mt-5 mb-2 max-w-[860px] px-6 py-5" data-testid="theory-question">
      <div className="flex items-baseline justify-between">
        <Kicker>
          Question {index + 1} of {questions.length}
        </Kicker>
        {phase === 'right' && (
          <span
            className="text-body-sm font-semibold text-accent-text"
            data-testid="theory-right"
          >
            Right
          </span>
        )}
      </div>
      <h3 className="face-title mb-1 mt-1 text-display">{question.prompt}</h3>
      {question.kind !== 'single-pick' && question.note && (
        <p className="mb-3 text-body-sm text-ink-muted">{question.note}</p>
      )}

      <div className="mt-4">
        {question.kind === 'single-pick' ? (
          <SinglePick question={question} pickedId={pickedId} onPick={answerSingle} />
        ) : question.kind === 'multi-pick' ? (
          <MultiPick
            question={question}
            picked={ticked}
            submitted={phase !== 'asking'}
            onToggle={toggle}
            onSubmit={submitMulti}
          />
        ) : (
          <TableFill
            question={question}
            picks={currentPicks}
            activeRow={activeRow}
            submitted={phase !== 'asking'}
            onPick={fill}
            onFocusRow={setActiveRow}
            onSubmit={submitTable}
          />
        )}
      </div>

      {phase === 'wrong' && (
        <div className="mt-6 space-y-4">
          <TheoryFeedback
            question={question}
            pickedIds={question.kind === 'multi-pick' ? ticked : pickedId ? [pickedId] : []}
          />
          <Button onClick={next} data-testid="theory-continue">
            {index + 1 >= questions.length ? 'Finish' : 'Next question'}
          </Button>
          <span className="ml-3 text-meta text-ink-faint">or Enter</span>
        </div>
      )}
    </div>
  );
}
