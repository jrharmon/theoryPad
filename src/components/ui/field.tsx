import type { ReactNode } from 'react';
import { Label } from './label';

export function Field({
  label,
  hint,
  htmlFor,
  lead,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  /** Something before the label, on its line — a lock toggle. */
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      {lead ? (
        <div className="-ml-1 flex items-center gap-1">
          {lead}
          <Label htmlFor={htmlFor} className="kicker">
            {label}
          </Label>
        </div>
      ) : (
        <Label htmlFor={htmlFor} className="kicker">
          {label}
        </Label>
      )}
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-caption text-ink-faint">{hint}</p>}
    </div>
  );
}
