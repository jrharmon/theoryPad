import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { useSettings } from '@/store/settings';

/**
 * Hide the whole right-hand column — the neck, the circle, whatever is
 * playing — and give the tab the width. Kept app-wide, like the panels' own
 * minimize buttons.
 */
export function InfoColumnToggle() {
  const ui = useSettings((s) => s.settings.ui);
  const save = useSettings((s) => s.save);
  const shown = ui.showInfoColumn !== false;
  return (
    <Button
      variant="secondary"
      size="xs"
      aria-pressed={shown}
      onClick={() => void save({ ui: { ...ui, showInfoColumn: !shown } })}
      data-testid="info-column-toggle"
    >
      {shown ? 'Hide Info' : 'Show Info'}
    </Button>
  );
}

/**
 * A sheet in the right-hand column that can be shrunk to its title, so the
 * ones you are not using this session stay out of the way — and come back
 * without a trip to Settings. Collapsed, it is as narrow as its title.
 */
export function SidePanel({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`sheet px-5 pt-4 ${open ? 'w-[320px] pb-[18px]' : 'w-auto pb-3'}`}>
      <div className="flex items-center gap-3">
        <Kicker>{title}</Kicker>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-ink/64"
          aria-expanded={open}
          aria-label={open ? `Minimize ${title}` : `Show ${title}`}
          title={open ? 'Minimize' : 'Show'}
          onClick={() => onToggle(!open)}
        >
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </div>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
