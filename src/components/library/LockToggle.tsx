import { LockIcon, LockOpenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Locks a setting into an exercise for good, or frees it. A locked setting is
 * hidden wherever the exercise is used; here, where its value is set, it stays
 * editable.
 */
export function LockToggle({
  locked,
  label,
  onChange,
}: {
  locked: boolean;
  /** The setting, for assistive tech: "Lock Rhythm". */
  label: string;
  onChange: (locked: boolean) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-pressed={locked}
      aria-label={`${locked ? 'Unlock' : 'Lock'} ${label}`}
      title={
        locked ? 'Locked: hidden wherever this exercise is used' : 'Lock this into the exercise'
      }
      // Locked is marked with the highlighter, as a settled thing; open is faint.
      className={
        locked
          ? 'bg-highlight text-ink hover:bg-highlight'
          : 'text-ink-disabled hover:text-ink-muted'
      }
      onClick={() => onChange(!locked)}
    >
      {locked ? <LockIcon className="size-3.5" strokeWidth={2.5} /> : <LockOpenIcon />}
    </Button>
  );
}
