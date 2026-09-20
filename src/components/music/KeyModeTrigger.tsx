import { useState } from 'react';
import type { ReactNode } from 'react';
import type { KeyMode } from '@/domain/music';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { modeTitle } from '@/domain/music';
import { KeyModeView } from './KeyModeView';

/**
 * Makes anything showing a key and mode open its reference: the compact
 * popover first, the full drawer from there. Opening either never touches
 * playback. Controlled when the caller passes `open` state (the practice
 * screen does, for its `K` key); self-contained otherwise.
 */
export function KeyModeTrigger({
  keyMode,
  children,
  label,
  popover,
  sheet,
  className,
}: {
  keyMode: KeyMode;
  children: ReactNode;
  /** Accessible name for the trigger. */
  label?: string;
  popover?: { open: boolean; onOpenChange: (open: boolean) => void };
  sheet?: { open: boolean; onOpenChange: (open: boolean) => void };
  className?: string;
}) {
  const [ownPopover, setOwnPopover] = useState(false);
  const [ownSheet, setOwnSheet] = useState(false);
  const popoverOpen = popover?.open ?? ownPopover;
  const setPopoverOpen = popover?.onOpenChange ?? setOwnPopover;
  const sheetOpen = sheet?.open ?? ownSheet;
  const setSheetOpen = sheet?.onOpenChange ?? setOwnSheet;
  const name = `${keyMode.tonic} ${modeTitle(keyMode.mode)}`;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          className={
            className ??
            'text-left underline decoration-ink/30 underline-offset-4 hover:decoration-ink'
          }
          aria-label={label ?? `${name}: notes, chords and how to use it`}
          data-testid="key-mode-trigger"
        >
          {children}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto"
          onKeyDown={(event) => {
            if (event.key === 'k' || event.key === 'K') setPopoverOpen(false);
          }}
        >
          <KeyModeView
            keyMode={keyMode}
            variant="compact"
            onFullView={() => {
              setPopoverOpen(false);
              setSheetOpen(true);
            }}
          />
        </PopoverContent>
      </Popover>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[560px] overflow-y-auto p-6 sm:max-w-[560px]">
          <SheetTitle className="sr-only">{name}</SheetTitle>
          <SheetDescription className="sr-only">
            The notes, chords and character of {name}.
          </SheetDescription>
          <KeyModeView keyMode={keyMode} variant="full" />
        </SheetContent>
      </Sheet>
    </>
  );
}
