import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Fretboard } from '@/components/music';
import { Button } from '@/components/ui/button';
import type { Instrument } from '@/domain/instrument';
import type { NeckOverlay } from '@/domain/neck';
import { openingFretWindow, overlayFretRange, stepFretWindow } from '@/domain/neck';

/**
 * The side panel's neck: a few frets at a time, big enough to read, with
 * arrows to move along a shape that runs further. It opens where the phrase
 * starts and stays put while you play, until a new roll brings a new shape.
 */
export function NeckWindow({
  instrument,
  overlay,
  startFret,
}: {
  instrument: Instrument;
  overlay: NeckOverlay;
  /** The phrase's first fret, so the window opens where you start playing. */
  startFret: number;
}) {
  const range = overlayFretRange(overlay, instrument);
  const open = () => ({ overlay, frets: openingFretWindow(overlay, range, startFret) });
  const [state, setState] = useState(open);
  // A new roll is a new shape: open where it starts, not where the last one was.
  if (state.overlay !== overlay) setState(open());
  const view = state.overlay === overlay ? state.frets : open().frets;
  const setView = (frets: typeof view) => setState({ overlay, frets });
  const scrolls = view.low > range.low || view.high < range.high;

  return (
    <div>
      <Fretboard instrument={instrument} overlay={overlay} fretRange={view} />
      {scrolls && (
        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Lower on the neck"
            title="Lower on the neck"
            disabled={view.low <= range.low}
            onClick={() => setView(stepFretWindow(view, range, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="num text-caption text-ink-muted" data-testid="neck-window-frets">
            Frets {view.low}–{view.high}
          </span>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Higher on the neck"
            title="Higher on the neck"
            disabled={view.high >= range.high}
            onClick={() => setView(stepFretWindow(view, range, 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
