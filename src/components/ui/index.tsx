import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * Minimal primitives in the Modernist idiom: zero radius, flush left, accent
 * used sparingly.
 *
 * The plan calls for shadcn/ui, and that still holds for the genuinely hard
 * primitives — dialog, popover, combobox — which arrive with the key/mode
 * drawer in milestone 6. Generating its whole surface now to strip the radius
 * off every file would be more code than these twenty lines.
 */

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-bg hover:bg-accent-600 active:bg-accent-700',
  secondary: 'border border-divider hover:bg-ink/5 active:bg-ink/10',
  ghost: 'text-accent-700 hover:bg-accent/10 active:bg-accent/20',
};

export function Button({
  variant = 'secondary',
  block = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={[
        // Labels are flush left even in a wide button.
        'inline-flex items-center justify-start gap-2 px-4 py-2 text-[13px] font-semibold',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANT[variant],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    />
  );
}

export function Kicker({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return <p className={accent ? 'kicker kicker-accent' : 'kicker'}>{children}</p>;
}

export function Tag({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: 'neutral' | 'accent' | 'outline';
}) {
  const styles = {
    neutral: 'bg-surface text-ink/70',
    accent: 'bg-accent text-bg',
    outline: 'border border-divider text-ink/70',
  } as const;
  return (
    <span className={`px-2 py-0.5 text-[11px] font-semibold ${styles[variant]}`}>{children}</span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="kicker">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink/50">{hint}</span>}
    </label>
  );
}

export function NumberInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={`mt-1 w-full border border-divider bg-bg px-2 py-1.5 text-[15px] font-semibold tabular-nums ${className}`}
    />
  );
}

export function Rule({ strong = false }: { strong?: boolean }) {
  return <hr className={strong ? 'border-t-2 border-divider' : 'border-t border-divider'} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-divider bg-surface px-6 py-8">
      <p className="text-[17px] font-extrabold">{title}</p>
      {children && <div className="mt-1 text-[13px] text-ink/65">{children}</div>}
    </div>
  );
}
