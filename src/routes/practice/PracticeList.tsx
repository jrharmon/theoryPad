import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { listGroups } from '@/domain/library';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { secondLine } from '@/exercises/locks';
import { findExerciseDefinition } from '@/exercises/registry';
import { exerciseLabel, useExerciseLookup, useExercises } from '@/store/exercises';
import { useFolders } from '@/store/folders';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';

/**
 * Down the left of a single exercise: the whole library, so the next one is a
 * click away — Favorites, the top level, then each folder with exercises in
 * it, under its full path. A favorite is in two places, and both are marked
 * current. Opening another leaves this one, as the back button would.
 */
export function ExerciseList({ currentId }: { currentId: string }) {
  const exercises = useExercises((s) => s.exercises);
  const folders = useFolders((s) => s.folders);
  const loadFolders = useFolders((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  // Which copy was clicked, for a favorite listed twice: that one stays in view.
  const clicked = (useLocation().state as { listGroup?: string } | null)?.listGroup;
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const groups = useMemo(
    () =>
      listGroups(
        folders,
        exercises.filter((e) => findExerciseDefinition(e.definitionId)),
      ),
    [folders, exercises],
  );

  // Bring the current one into view, only if it is out of it: clicking
  // between neighbours never moves the list under you.
  useEffect(() => {
    const container = list.current;
    if (!container) return;
    const row =
      container.querySelector<HTMLElement>(`[data-row="${clicked}:${currentId}"]`) ??
      container.querySelector<HTMLElement>(`[data-row$=":${currentId}"]`);
    if (!row) return;
    // In view means on screen too: at the top of the page the panel runs on
    // below the window, and the transport floats over its foot.
    const box = container.getBoundingClientRect();
    const transport = document.querySelector('[data-testid="transport"]');
    const bottom = Math.min(
      box.bottom,
      transport?.getBoundingClientRect().top ?? window.innerHeight,
    );
    const at = row.getBoundingClientRect();
    if (at.top < box.top) container.scrollTop += at.top - box.top - 8;
    else if (at.bottom > bottom) container.scrollTop += at.bottom - bottom + 8;
  }, [currentId, clicked, groups]);

  return (
    <ListFrame title="Exercises" listRef={list}>
      {groups.map((group, index) => (
        <li key={group.key}>
          {group.kind === 'top' ? (
            // The top level has no name: a hairline sets it off from Favorites.
            index > 0 && <div className="mx-3 my-2 border-t border-rule" />
          ) : (
            <GroupHeader path={group.kind === 'favorites' ? ['Favorites'] : group.path} />
          )}
          <ul className="space-y-0.5">
            {group.exercises.map((exercise) => {
              const definition = findExerciseDefinition(exercise.definitionId)!;
              const current = exercise.id === currentId;
              return (
                <li key={exercise.id} data-row={`${group.key}:${exercise.id}`}>
                  <Link
                    to={`/practice/exercise/${exercise.id}`}
                    state={{ listGroup: group.key }}
                    aria-current={current ? 'page' : undefined}
                    className={rowClass(current)}
                  >
                    <RowText
                      name={exercise.name}
                      summary={secondLine(exercise, definition, instrument)}
                      current={current}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ListFrame>
  );
}

/**
 * A folder's full path, right-aligned on one line. Too long for the panel, it
 * runs off the left edge, so the end — the folder itself — always shows. Only
 * the display is clipped: the whole path is in the text, and on hover.
 */
function GroupHeader({ path }: { path: string[] }) {
  const full = path.join(' › ');
  return (
    <div
      className="kicker flex justify-end overflow-hidden px-3 pt-3 pb-1 whitespace-nowrap text-ink-faint"
      title={full}
    >
      <span className="shrink-0">{full}</span>
    </div>
  );
}

/**
 * Down the left of a routine: its items, in order, with what has been played.
 * Clicking one jumps there — forward or back — and waits on it for Play.
 */
export function RoutineList() {
  const routine = usePractice((s) => s.routineSnapshot);
  const goTo = usePractice((s) => s.goTo);
  const lookup = useExerciseLookup();
  if (!routine) return null;
  return (
    <ListFrame title="This routine">
      {routine.items.map((item, index) => {
        const definition = findExerciseDefinition(item.definitionId);
        const exercise = lookup(item.exerciseId);
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
                name={exercise ? exerciseLabel(exercise) : (definition?.name ?? '')}
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
 * It stays in view as the tab scrolls, like the right-hand column. It sits
 * close to the page's edge, and its negative right margin pulls the page's
 * own 32px gutter in to 12px beside it: room is what the tab needs most. It
 * is short enough to end above the transport with the page at its top, under
 * the chrome, so its last row is never hidden behind the transport.
 */
function ListFrame({
  title,
  listRef,
  children,
}: {
  title: string;
  /** The scrolling list, for bringing a row into view. */
  listRef?: React.Ref<HTMLUListElement>;
  children: ReactNode;
}) {
  const [open, setOpen] = useListOpen();

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-label={`Show ${title}`}
        title="Show"
        onClick={() => setOpen(true)}
        className="sheet sticky top-4 mt-6 ml-2 -mr-5 flex shrink-0 flex-col items-center gap-2 self-start px-1.5 py-3 text-ink-muted hover:text-ink"
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
      className="sheet sticky top-4 mt-6 ml-2 -mr-5 flex max-h-[calc(100dvh_-_13.5rem)] w-[240px] shrink-0 flex-col self-start pt-4 pb-2"
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
      <ul ref={listRef} className="space-y-0.5 overflow-y-auto px-2">
        {children}
      </ul>
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
