import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { findExerciseDefinition } from '@/exercises/registry';
import { libraryRows, useExercises } from '@/store/exercises';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';

/**
 * Down the left of a single exercise: the whole library, in library order, so
 * the next one is a click away. Opening another leaves this one, as the
 * back button would.
 */
export function ExerciseList({ currentId }: { currentId: string }) {
  const exercises = useExercises((s) => s.exercises);
  return (
    <ListFrame title="Exercises">
      {libraryRows(exercises).map(({ exercise, definition }) => {
        const current = exercise.id === currentId;
        return (
          <li key={exercise.id}>
            <Link
              to={`/practice/exercise/${exercise.id}`}
              aria-current={current ? 'page' : undefined}
              className={rowClass(current)}
            >
              <RowText name={definition.name} summary={definition.summary} current={current} />
            </Link>
          </li>
        );
      })}
    </ListFrame>
  );
}

/**
 * Down the left of a routine: its items, in order, with what has been played.
 * Clicking one jumps there — forward or back — and waits on it for Play.
 */
export function RoutineList() {
  const routine = usePractice((s) => s.routineSnapshot);
  const goTo = usePractice((s) => s.goTo);
  if (!routine) return null;
  return (
    <ListFrame title="This routine">
      {routine.items.map((item, index) => {
        const definition = findExerciseDefinition(item.definitionId);
        const current = index === routine.index;
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-current={current ? 'step' : undefined}
              className={`flex w-full items-start gap-2 text-left ${rowClass(current)}`}
              onClick={() => goTo(index)}
            >
              <span className="w-4 shrink-0 text-body-sm tabular-nums text-ink-faint">
                {index + 1}
              </span>
              <RowText
                name={definition?.name ?? ''}
                summary={definition?.summary ?? ''}
                current={current}
              />
              {item.completed > 0 ? (
                <CheckIcon aria-label="Played" className="mt-0.5 size-4 shrink-0 text-accent" />
              ) : (
                item.skipped && (
                  <span className="shrink-0 text-meta text-ink-faint">skipped</span>
                )
              )}
            </button>
          </li>
        );
      })}
    </ListFrame>
  );
}

function rowClass(current: boolean): string {
  return `block rounded-control px-3 py-2 ${current ? 'bg-accent-tint' : 'hover:bg-ink/5'}`;
}

function RowText({
  name,
  summary,
  current,
}: {
  name: string;
  summary: string;
  current: boolean;
}) {
  return (
    <span className="block min-w-0 flex-1">
      <span
        className={`block truncate text-body-sm ${current ? 'font-semibold text-accent-text' : ''}`}
      >
        {name}
      </span>
      <span className="block truncate text-meta text-ink-muted">{summary}</span>
    </span>
  );
}

/**
 * The panel, or — put away — a slim rail with its title, to bring it back.
 * It stays in view as the tab scrolls, like the right-hand column.
 */
function ListFrame({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useListOpen();

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-label={`Show ${title}`}
        title="Show"
        onClick={() => setOpen(true)}
        className="sheet sticky top-4 mt-6 ml-6 flex shrink-0 flex-col items-center gap-2 self-start px-1.5 py-3 text-ink-muted hover:text-ink"
        data-testid="practice-list-rail"
      >
        <ChevronRightIcon className="size-4" />
        <span className="kicker [writing-mode:vertical-rl]">{title}</span>
      </button>
    );
  }

  return (
    <nav
      aria-label={title}
      className="sheet sticky top-4 mt-6 ml-6 flex max-h-[calc(100dvh_-_7.5rem)] w-[240px] shrink-0 flex-col self-start pt-4 pb-2"
      data-testid="practice-list"
    >
      <div className="flex items-center gap-3 px-5 pb-2">
        <Kicker>{title}</Kicker>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-ink-muted"
          aria-expanded
          aria-label={`Hide ${title}`}
          title="Hide"
          onClick={() => setOpen(false)}
        >
          <ChevronLeftIcon />
        </Button>
      </div>
      <ul className="space-y-0.5 overflow-y-auto px-2">{children}</ul>
    </nav>
  );
}

// Tailwind's xl. Below it, the list open beside the neck squeezes the tab
// until its digits run together.
const WIDE = '(min-width: 80rem)';

/**
 * Open or put away. On a wide screen that is remembered app-wide, like Hide
 * Info. On a narrow one the tab needs the room, so it starts put away, and
 * opening it is for this visit only.
 */
function useListOpen(): [boolean, (open: boolean) => void] {
  const wide = useMediaQuery(WIDE);
  const ui = useSettings((s) => s.settings.ui);
  const save = useSettings((s) => s.save);
  const [narrowOpen, setNarrowOpen] = useState(false);
  if (!wide) return [narrowOpen, setNarrowOpen];
  return [
    ui.showPracticeList !== false,
    (open) => void save({ ui: { ...ui, showPracticeList: open } }),
  ];
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window.matchMedia !== 'function' || window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
