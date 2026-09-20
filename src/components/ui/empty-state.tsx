import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="sheet px-6 py-8">
      <p className="face-title text-lead">{title}</p>
      {children && <div className="mt-1 text-body-sm text-ink-muted">{children}</div>}
    </div>
  );
}
