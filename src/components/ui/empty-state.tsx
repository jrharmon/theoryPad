import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-rule bg-surface px-6 py-8">
      <p className="face-title text-[17px]">{title}</p>
      {children && <div className="mt-1 text-[13px] text-ink/65">{children}</div>}
    </div>
  );
}
