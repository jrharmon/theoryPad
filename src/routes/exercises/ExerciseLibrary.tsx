import { FolderIcon, MoreHorizontalIcon, StarIcon } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Exercise, Folder } from '@/data';
import {
  byName,
  childFolders,
  countBeneath,
  deletionOf,
  exercisesIn,
  folderAndBelow,
  folderNamesIn,
  folderPath,
} from '@/domain/library';
import { secondLine } from '@/exercises/locks';
import { findExerciseDefinition } from '@/exercises/registry';
import type { AnyExerciseDefinition } from '@/exercises/types';
import { FromBlueprint } from '@/components/library/FromBlueprint';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FavoriteToggle } from '@/components/ui/favorite-toggle';
import { Input } from '@/components/ui/input';
import { LoadingState, PageIntro } from '@/components/ui/page-header';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useExercises } from '@/store/exercises';
import { useFolders } from '@/store/folders';
import { useSettings } from '@/store/settings';
import { DeleteFolderDialog, FolderNameDialog, MoveDialog } from './LibraryDialogs';

/**
 * The Exercises page, a file browser: a folder's subfolders, then its
 * exercises, each sorted by name. Favorites is a folder of its own, first at
 * the top level. A search or a tag flattens the view across every folder.
 * Each folder (and Favorites) is its own route, so leaving one starts afresh.
 */
export function ExerciseLibraryRoute({ favorites = false }: { favorites?: boolean }) {
  const { folderId = null } = useParams();
  const view = favorites ? 'favorites' : (folderId ?? 'top');
  return <ExerciseLibrary key={view} favorites={favorites} folderId={folderId} />;
}

/** Selected rows, by kind: "f:<id>" or "e:<id>". */
type Selection = ReadonlySet<string>;

function ExerciseLibrary({
  favorites,
  folderId,
}: {
  favorites: boolean;
  folderId: string | null;
}) {
  const { exercises, loaded, load, update } = useExercises();
  const {
    folders,
    loaded: foldersLoaded,
    load: loadFolders,
    create,
    rename,
    remove,
    move,
  } = useFolders();
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Selection>(new Set());
  const [naming, setNaming] = useState<null | 'new' | Folder>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    void load();
    void loadFolders();
    void loadSettings();
  }, [load, loadFolders, loadSettings]);

  const tags = useMemo(() => {
    const all = new Set<string>();
    for (const e of exercises) for (const t of e.tags) all.add(t);
    return [...all].sort();
  }, [exercises]);

  if (!loaded || !foldersLoaded) return <LoadingState />;

  const here = favorites ? null : folderId;
  if (here !== null && !folders.some((f) => f.id === here)) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such folder">
          <Link to="/exercises" className="text-accent-text underline">
            Back to your exercises
          </Link>
        </EmptyState>
      </div>
    );
  }

  const path = folderPath(folders, here);
  const needle = query.trim().toLowerCase();
  const flattened = needle !== '' || tag !== null;
  const favoriteRows = byName(exercises.filter((e) => e.favorite));

  // What the list holds: one folder's contents, Favorites, or — searching or
  // filtering — every exercise that matches, wherever it is.
  const shownFolders = flattened || favorites ? [] : childFolders(folders, here);
  const shownExercises = flattened
    ? byName(
        exercises.filter((e) => {
          const definition = findExerciseDefinition(e.definitionId);
          const named =
            needle === '' ||
            e.name.toLowerCase().includes(needle) ||
            (definition?.name.toLowerCase().includes(needle) ?? false);
          return named && (tag === null || e.tags.includes(tag));
        }),
      )
    : favorites
      ? favoriteRows
      : exercisesIn(folders, exercises, here);
  const showPath = flattened || favorites;
  const showFavorites = here === null && !favorites && !flattened;
  // Opened from Favorites, the practice side panel keeps you among them.
  const listGroup = (exercise: Exercise) =>
    favorites ? 'favorites' : (exercise.folderId ?? 'top');

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const selection = {
    folderIds: [...selected].filter((k) => k.startsWith('f:')).map((k) => k.slice(2)),
    exerciseIds: [...selected].filter((k) => k.startsWith('e:')).map((k) => k.slice(2)),
  };
  const below = new Set(selection.folderIds.flatMap((id) => [...folderAndBelow(folders, id)]));
  const deletion = deleting ? deletionOf(folders, exercises, deleting.id) : null;

  return (
    <section>
      <div className="flex items-end justify-between gap-6 px-8 py-7">
        <div className="min-w-0">
          <nav aria-label="Folders" className="kicker flex flex-wrap items-center gap-1.5">
            {favorites || path.length > 0 ? (
              <Link to="/exercises" className="text-accent-text hover:underline">
                Exercises
              </Link>
            ) : (
              <span className="text-accent-text">Exercises</span>
            )}
            {path.slice(0, -1).map((folder) => (
              <Fragment key={folder.id}>
                <span aria-hidden>›</span>
                <Link
                  to={`/exercises/folder/${folder.id}`}
                  className="text-accent-text hover:underline"
                >
                  {folder.name}
                </Link>
              </Fragment>
            ))}
            {(favorites || path.length > 0) && <span aria-hidden>›</span>}
          </nav>
          <h1>{favorites ? 'Favorites' : (path.at(-1)?.name ?? 'Your library')}</h1>
          {!favorites && path.length === 0 && (
            <PageIntro>
              Everything you can practice. Open one to set its target tempo and how much it
              varies.
            </PageIntro>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={selecting ? 'default' : 'secondary'}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setSelected(new Set());
            }}
          >
            Select
          </Button>
          {!favorites && (
            <Button variant="secondary" onClick={() => setNaming('new')}>
              New folder
            </Button>
          )}
          <Button asChild>
            <Link to={here ? `/exercises/new?folder=${here}` : '/exercises/new'}>
              New exercise
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-8 pb-1">
        <Input
          type="search"
          aria-label="Search exercises"
          placeholder="Search by name"
          className="mr-3 h-8 w-56"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        />
        <span className="kicker mr-1">Filter</span>
        <TagFilter label="All" active={tag === null} onClick={() => setTag(null)} />
        {tags.map((t) => (
          <TagFilter
            key={t}
            label={t}
            active={t === tag}
            onClick={() => setTag(t === tag ? null : t)}
          />
        ))}
      </div>

      {selecting && (
        <div className="flex items-center gap-3 px-8 pt-4" data-testid="selection-bar">
          <span className="text-body-sm tabular-nums text-ink-muted">
            {selected.size === 0
              ? 'Tick the folders and exercises to move.'
              : `${selected.size} selected`}
          </span>
          <Button size="sm" disabled={selected.size === 0} onClick={() => setMoving(true)}>
            Move to…
          </Button>
        </div>
      )}

      <div className="px-8 pt-4 pb-6">
        {shownFolders.length === 0 && shownExercises.length === 0 && !showFavorites && (
          <EmptyState title={flattened ? 'Nothing matches' : 'Nothing here yet'}>
            {flattened
              ? 'No exercise has that name or tag.'
              : favorites
                ? 'Star an exercise to keep it here.'
                : 'Make a new exercise, or move some in.'}
          </EmptyState>
        )}

        <ul className="sheet px-5 empty:hidden">
          {showFavorites && (
            <FolderRow
              to="/exercises/favorites"
              icon={<StarIcon className="size-4 text-star" />}
              name="Favorites"
              count={favoriteRows.length}
            />
          )}
          {shownFolders.map((folder) => (
            <FolderRow
              key={folder.id}
              to={`/exercises/folder/${folder.id}`}
              icon={<FolderIcon className="size-4 text-ink-muted" />}
              name={folder.name}
              count={countBeneath(folders, exercises, folder.id)}
              {...(selecting
                ? {
                    selected: selected.has(`f:${folder.id}`),
                    onSelect: () => toggle(`f:${folder.id}`),
                  }
                : {})}
              onRename={() => setNaming(folder)}
              onDelete={() => setDeleting(folder)}
            />
          ))}
          {shownExercises.map((exercise) => {
            const definition = findExerciseDefinition(exercise.definitionId);
            if (!definition) return null;
            return (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                definition={definition}
                secondLine={secondLine(exercise, definition, instrument)}
                {...(showPath
                  ? {
                      path:
                        folderPath(folders, exercise.folderId)
                          .map((f) => f.name)
                          .join(' › ') || 'Top level',
                    }
                  : {})}
                listGroup={listGroup(exercise)}
                {...(selecting
                  ? {
                      selected: selected.has(`e:${exercise.id}`),
                      onSelect: () => toggle(`e:${exercise.id}`),
                    }
                  : {})}
                onFavorite={(on) => void update(exercise.id, { favorite: on })}
              />
            );
          })}
        </ul>
      </div>

      <FolderNameDialog
        open={naming !== null}
        onOpenChange={(open) => !open && setNaming(null)}
        title={naming === 'new' ? 'New folder' : 'Rename folder'}
        action={naming === 'new' ? 'Create' : 'Rename'}
        initial={naming === 'new' || naming === null ? '' : naming.name}
        taken={
          naming === 'new'
            ? folderNamesIn(folders, here)
            : naming
              ? folderNamesIn(folders, naming.parentId, naming.id)
              : []
        }
        onSave={(name) => {
          if (naming === 'new') void create(name, here);
          else if (naming) void rename(naming.id, name);
        }}
      />
      <DeleteFolderDialog
        folder={deleting}
        folders={(deletion?.folderIds.length ?? 1) - 1}
        exercises={deletion?.exerciseIds.length ?? 0}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={() => {
          if (deleting) void remove(deleting.id);
          setDeleting(null);
        }}
      />
      <MoveDialog
        open={moving}
        onOpenChange={setMoving}
        count={selected.size}
        folders={folders}
        exclude={below}
        initial={here}
        onMove={(to) => {
          void move(selection, to).then(() => {
            setMoving(false);
            setSelecting(false);
            setSelected(new Set());
          });
        }}
      />
    </section>
  );
}

function SelectBox({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={`Select ${label}`}
      checked={selected}
      onChange={onSelect}
      className="size-4 shrink-0 self-center"
    />
  );
}

function FolderRow({
  to,
  icon,
  name,
  count,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  to: string;
  icon: React.ReactNode;
  name: string;
  count: number;
  selected?: boolean;
  onSelect?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <li
      className="flex items-center gap-4 border-b border-rule py-3 last:border-b-0"
      data-testid="folder-row"
    >
      {onSelect && <SelectBox selected={selected ?? false} label={name} onSelect={onSelect} />}
      <span className="flex w-6 shrink-0 justify-center">{icon}</span>
      <Link
        to={to}
        className="face-title min-w-0 flex-1 truncate text-title hover:text-accent-text"
      >
        {name}
      </Link>
      <span className="shrink-0 text-body-sm text-ink-muted tabular-nums">
        {count === 1 ? '1 exercise' : `${count} exercises`}
      </span>
      {onRename && onDelete ? (
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${name} menu`}
              className="text-ink-muted"
            >
              <MoreHorizontalIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            <MenuButton
              onClick={() => {
                setMenu(false);
                onRename();
              }}
            >
              Rename
            </MenuButton>
            <MenuButton
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
            >
              Delete
            </MenuButton>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="w-6 shrink-0" />
      )}
    </li>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-control px-3 py-1.5 text-left text-body-sm hover:bg-ink/5"
    >
      {children}
    </button>
  );
}

function ExerciseRow({
  exercise,
  definition,
  secondLine,
  path,
  listGroup,
  selected,
  onSelect,
  onFavorite,
}: {
  exercise: Exercise;
  definition: AnyExerciseDefinition;
  secondLine: string;
  /** Where it lives, when the list mixes folders. */
  path?: string;
  /** Which copy the practice side panel should show, for a favorite listed twice. */
  listGroup: string;
  selected?: boolean;
  onSelect?: () => void;
  onFavorite: (on: boolean) => void;
}) {
  return (
    <li className="flex items-baseline gap-4 border-b border-rule py-4 last:border-b-0">
      {onSelect && (
        <SelectBox selected={selected ?? false} label={exercise.name} onSelect={onSelect} />
      )}
      <FavoriteToggle
        on={exercise.favorite ?? false}
        label={exercise.name}
        onChange={onFavorite}
      />
      <div className="min-w-0 flex-1">
        {path && <p className="kicker mb-0.5 text-ink-faint">{path}</p>}
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            to={`/exercises/${exercise.id}`}
            className="face-title text-title hover:text-accent-text"
          >
            {exercise.name}
          </Link>
          <FromBlueprint name={exercise.name} blueprint={definition.name} />
        </div>
        <p className="text-body-sm text-ink-muted">{secondLine}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercise.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="w-24 shrink-0 text-right">
        <p className="text-title font-extrabold tabular-nums">
          {exercise.tempo.targetTempo ?? '—'}
        </p>
        <p className="kicker">target bpm</p>
      </div>

      <Button asChild className="shrink-0">
        <Link to={`/practice/exercise/${exercise.id}`} state={{ listGroup }}>
          Practice
        </Link>
      </Button>
    </li>
  );
}

function TagFilter({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'secondary'}
      size="xs"
      className="rounded-full"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
