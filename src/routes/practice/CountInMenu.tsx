import { useState } from 'react';
import type { CountInBars } from '@/domain/phrase';
import { COUNT_IN_CHOICES } from '@/domain/phrase';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from 'cn';
import { usePractice } from '@/store/practice';

const LABEL: Record<number, string> = { 0: 'None', 0.5: '½ bar', 1: '1 bar', 2: '2 bars' };

const DETAIL: Record<number, string> = {
  0: 'Straight in on the first beat.',
  0.5: 'Two beats. Enough at a slow tempo, where a whole bar is a long wait.',
  1: 'One bar before the first note.',
  2: 'Two bars, for something you need to feel first.',
};

/**
 * How long this exercise counts in for — its own setting, like its tempo, and
 * saved to it. In a routine it belongs to the item being played, and counts
 * that item in wherever it falls.
 */
export function CountInMenu() {
  const bars = usePractice((s) => s.snapshot?.countInBars ?? 0);
  const inRoutine = usePractice((s) => s.routineId !== null);
  const setCountIn = usePractice((s) => s.setCountIn);
  const [open, setOpen] = useState(false);

  const pick = (choice: CountInBars) => {
    setOpen(false);
    void setCountIn(choice);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" data-testid="count-in-menu">
          <span className="text-ink/64">Count-in</span>
          <span>{LABEL[bars]}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[300px] p-2">
        <ul className="space-y-0.5" role="listbox" aria-label="Count-in">
          {COUNT_IN_CHOICES.map((choice) => (
            <li key={choice}>
              <button
                type="button"
                role="option"
                aria-selected={choice === bars}
                className={cn(
                  'w-full rounded-[8px] px-2 py-1.5 text-left hover:bg-ink/5',
                  choice === bars && 'bg-toggle-on text-toggle-on-ink hover:bg-toggle-on/85',
                )}
                onClick={() => pick(choice)}
              >
                <span className="block text-[13px] font-semibold">{LABEL[choice]}</span>
                <span className={cn('block text-[12px]', choice === bars ? 'opacity-80' : 'text-ink/64')}>
                  {DETAIL[choice]}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-2 pt-2 pb-1 text-[12px] text-ink/64">
          {inRoutine
            ? 'This item’s own, and kept — it counts the item in wherever it falls in the routine.'
            : 'This exercise’s own, and kept. It takes effect on the next Play.'}
        </p>
      </PopoverContent>
    </Popover>
  );
}
