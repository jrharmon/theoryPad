import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The small-caps label above almost every block. Ours, not shadcn's — it is a
 * Modernist convention rather than a general UI primitive, but it lives here so
 * everything a screen composes from is in one place.
 */
export function Kicker({
  children,
  accent = false,
  className,
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return <p className={cn('kicker', accent && 'kicker-accent', className)}>{children}</p>;
}
