import { folderChoices, type FolderLike } from '@/domain/library';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TOP = '__top__';

/** A folder to put things in, by full path, the top level first. */

export function FolderPicker({
  folders,
  value,
  exclude,
  label = 'Folder',
  onChange,
}: {
  folders: readonly FolderLike[];
  value: string | null;
  /** Folders that can't be chosen — a folder can't go inside itself. */
  exclude?: ReadonlySet<string>;
  label?: string;
  onChange: (folderId: string | null) => void;
}) {
  return (
    <Select value={value ?? TOP} onValueChange={(v) => onChange(v === TOP ? null : v)}>
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {folderChoices(folders, exclude).map((choice) => (
          <SelectItem key={choice.id ?? TOP} value={choice.id ?? TOP}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
