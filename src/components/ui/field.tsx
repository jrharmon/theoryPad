import type { ReactNode } from 'react';
import { Label } from './label';

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="kicker">
        {label}
      </Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-ink/50">{hint}</p>}
    </div>
  );
}
