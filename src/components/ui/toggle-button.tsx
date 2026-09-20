import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

/**
 * A control that is on or off: a pill that fills when it is on.
 *
 * How "on" is drawn lives in `index.css`, keyed on `data-toggle`, so the
 * class string is written once rather than in every transport, menu and
 * settings row. A button that is pressed but drawn plain — Hide info — is an
 * ordinary secondary button and does not use this.
 */
export function ToggleButton({
  on,
  quietOff = false,
  className,
  children,
  ...props
}: {
  on: boolean;
  /** Off is muted rather than ink: the transport and the settings rows. */
  quietOff?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<typeof Button>, 'variant'>) {
  return (
    <Button
      size="sm"
      variant="secondary"
      aria-pressed={on}
      data-toggle={on ? 'on' : 'off'}
      className={cn('rounded-toggle', !on && quietOff && 'text-toggle-off-ink', className)}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * One of several, as pills: attached into a single control, or spaced apart.
 *
 * Attached is for a small fixed set that reads as one setting (Appearance);
 * spaced is for a row of choices that each stand alone.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  attached = false,
  quietOff = false,
  className,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  attached?: boolean;
  quietOff?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('flex', attached ? '' : 'gap-1', className)}
      role="group"
      aria-label={label}
    >
      {options.map((option, i) => (
        <ToggleButton
          key={option.id}
          on={value === option.id}
          quietOff={quietOff}
          className={cn(
            attached && i > 0 && '-ml-px rounded-l-none',
            attached && i < options.length - 1 && 'rounded-r-none',
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </ToggleButton>
      ))}
    </div>
  );
}
