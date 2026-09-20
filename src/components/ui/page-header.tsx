import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Kicker } from './kicker';

/** The kicker, title and one-line intro every screen opens with. */
export function PageHeader({
  kicker,
  title,
  intro,
  children,
  className,
}: {
  kicker: string;
  title: ReactNode;
  intro?: ReactNode;
  /** Anything that sits beside the title, such as a New button. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-8 py-7', children && 'flex items-end justify-between', className)}>
      <div>
        <Kicker accent>{kicker}</Kicker>
        <h1>{title}</h1>
        {intro && <PageIntro>{intro}</PageIntro>}
      </div>
      {children}
    </div>
  );
}

/** The sentence under a title. Its own export for the headers that build their own title. */
export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="max-w-[640px] text-body text-ink-muted">{children}</p>;
}

/** What a screen shows while it reads the database, or rolls what to play. */
export function LoadingState({
  children = 'Loading…',
  inline = false,
}: {
  children?: ReactNode;
  inline?: boolean;
}) {
  return (
    <p className={cn('text-body-sm text-ink-muted', !inline && 'px-8 py-8')}>{children}</p>
  );
}
