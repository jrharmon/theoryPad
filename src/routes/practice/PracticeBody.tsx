import { useEffect, useRef, useState } from 'react';
import { Fretboard, TabStaff } from '@/components/music';
import { ZOOM_MAX, ZOOM_MIN } from '@/components/music/tabLayout';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { overlayFretRange } from '@/domain/neck';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { AxisStrip } from './AxisStrip';
import { clampZoom, nudgeTabZoom } from './tabZoom';

/**
 * What is being played: the brief, the rolled axes, the tab and the neck.
 * The same for a single exercise and for the current item of a routine.
 */
export function PracticeBody() {
  const instrument = useSettings((s) => s.settings.instrument);
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);

  if (!instance || !snapshot) {
    return <p className="px-8 py-8 text-[13px] text-ink/55">Rolling a variation…</p>;
  }

  return (
    <>
      <div className="border-b border-divider px-8 py-6">
        <Kicker accent>This time you are playing</Kicker>
        <h2 className="max-w-[820px] text-[34px]">{instance.brief.headline}</h2>
        <p className="max-w-[640px] text-[14px] text-ink/70">{instance.brief.instruction}</p>
      </div>

      <AxisStrip />

      {instance.kind === 'played' && <PlayedBody instance={instance} instrument={instrument} />}
    </>
  );
}

function PlayedBody({
  instance,
  instrument,
}: {
  instance: Extract<NonNullable<ReturnType<typeof usePractice.getState>['instance']>, { kind: 'played' }>;
  instrument: ReturnType<typeof useSettings.getState>['settings']['instrument'];
}) {
  const state = usePractice((s) => s.snapshot?.state);
  const [tick, setTick] = useState(0);
  const frame = useRef<number | null>(null);
  const playing = state === 'playing';
  // Paused keeps the playhead where it stopped — losing your place is exactly
  // what you did not want when you paused.
  const showPlayhead = playing || state === 'paused' || state === 'count-in';

  // Polled rather than pushed: the runner's clock is the source of truth, and
  // reading it on rAF keeps the tab in step without the clock driving React.
  useEffect(() => {
    if (!playing) return;
    const step = () => {
      setTick(usePractice.getState().runner?.snapshot.phraseTick ?? 0);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing]);

  const ui = useSettings((s) => s.settings.ui);
  const save = useSettings((s) => s.save);
  const hasNeck = instance.neck.notes.length > 0;
  const showNeck = hasNeck && ui.showNeck;
  // One size for every exercise. The tab works out how many bars fit.
  const zoom = clampZoom(ui.tabZoom);

  return (
    <div className={`grid gap-6 px-8 py-6 ${showNeck ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Kicker>Tab · generated for this variation</Kicker>
          <div className="ml-auto flex items-center gap-1.5" role="group" aria-label="Tab size">
            {/* Smaller fits more bars on a line; bigger, fewer. */}
            <span className="kicker mr-1" aria-hidden>
              Tab size
            </span>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Smaller"
              title="Smaller  ( - )"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => nudgeTabZoom(-1)}
            >
              −
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Bigger"
              title="Bigger  ( = )"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => nudgeTabZoom(1)}
            >
              +
            </Button>
          </div>
          {hasNeck && (
            <Button
              variant="secondary"
              size="xs"
              aria-pressed={ui.showNeck}
              onClick={() => void save({ ui: { ...ui, showNeck: !ui.showNeck } })}
            >
              {ui.showNeck ? 'Hide neck' : 'Show neck'}
            </Button>
          )}
        </div>
        <div className="mt-2">
          <TabStaff
            phrase={instance.phrase}
            instrument={instrument}
            playheadTick={showPlayhead ? tick : null}
            size="large"
            zoom={zoom}
            autoScroll={playing}
          />
        </div>
      </div>

      {/* A note-finding exercise leaves the neck empty — drawing it would give the answers away. */}
      {showNeck && (
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Kicker>Shape on the neck</Kicker>
          <div className="mt-2">
            <Fretboard
              instrument={instrument}
              overlay={instance.neck}
              fretRange={overlayFretRange(instance.neck, instrument)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

