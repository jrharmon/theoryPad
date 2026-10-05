import { useState } from 'react';
import { nameProblem, type FolderLike } from '@/domain/library';
import { FolderPicker } from '@/components/library/FolderPicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/** A folder's name: a new folder's, or a rename. A clash or a blank shows inline. */
export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  action,
  initial = '',
  taken,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  action: string;
  initial?: string;
  /** Folder names already beside it. */
  taken: readonly string[];
  onSave: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <NameDraft
          title={title}
          action={action}
          initial={initial}
          taken={taken}
          onSave={(name) => {
            onSave(name);
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function NameDraft({
  title,
  action,
  initial,
  taken,
  onSave,
}: {
  title: string;
  action: string;
  initial: string;
  taken: readonly string[];
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [tried, setTried] = useState(false);
  const problem = nameProblem(name, taken);
  const save = () => {
    setTried(true);
    if (problem === null) onSave(name.trim());
  };
  return (
    <DialogContent className="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Field label="Name" htmlFor="folder-name">
        <Input
          id="folder-name"
          autoFocus
          value={name}
          aria-invalid={tried && problem !== null}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
      </Field>
      {problem === 'taken' && (
        <p className="text-meta text-destructive">A folder here already has that name.</p>
      )}
      {tried && problem === 'empty' && (
        <p className="text-meta text-destructive">A name is needed.</p>
      )}
      <DialogFooter>
        <Button onClick={save}>{action}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Deleting a folder takes everything in it: said plainly, before it happens. */
export function DeleteFolderDialog({
  folder,
  folders,
  exercises,
  onOpenChange,
  onDelete,
}: {
  folder: FolderLike | null;
  folders: number;
  exercises: number;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const contents = [
    folders > 0 ? plural(folders, 'folder') : null,
    exercises > 0 ? plural(exercises, 'exercise') : null,
  ].filter(Boolean);
  return (
    <Dialog open={folder !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Delete {folder?.name}?</DialogTitle>
          <DialogDescription>
            {contents.length === 0
              ? 'It is empty.'
              : `Everything in it goes too: ${contents.join(' and ')}. To keep any of it, move it out first.`}{' '}
            Practice already logged stays in your history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Where to move what is selected. Its own folders, and anything below them, aren't offered. */
export function MoveDialog({
  open,
  onOpenChange,
  ...draft
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  folders: readonly FolderLike[];
  exclude: ReadonlySet<string>;
  initial: string | null;
  onMove: (to: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <MoveDraft {...draft} />}
    </Dialog>
  );
}

function MoveDraft({
  count,
  folders,
  exclude,
  initial,
  onMove,
}: {
  count: number;
  folders: readonly FolderLike[];
  exclude: ReadonlySet<string>;
  initial: string | null;
  onMove: (to: string | null) => void;
}) {
  const [to, setTo] = useState<string | null>(initial);
  return (
    <DialogContent className="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle>Move {count === 1 ? '1 item' : `${count} items`}</DialogTitle>
        <DialogDescription>A name already used there gets “ - 2” added.</DialogDescription>
      </DialogHeader>
      <Field label="To" htmlFor="move-to">
        <FolderPicker
          folders={folders}
          value={to}
          exclude={exclude}
          label="Move to"
          onChange={setTo}
        />
      </Field>
      <DialogFooter>
        <Button onClick={() => onMove(to)}>Move</Button>
      </DialogFooter>
    </DialogContent>
  );
}
