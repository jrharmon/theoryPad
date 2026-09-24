import { Fretboard, TabStaff } from '@/components/music';
import { ZOOM_MAX, ZOOM_MIN } from '@/components/music/tabLayout';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { overlayFretRange } from '@/domain/neck';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { AxisStrip } from './AxisStrip';
import { BackingPanel, ReferencePanel } from './BackingPanel';
import { CircleSheet } from './CircleSheet';
import { InfoColumnToggle, SidePanel } from './SidePanel';
import { ImprovBody } from './ImprovBody';
import { usePhraseTick, useVideoColumn } from './usePracticeBody';
import { TheoryBody } from './TheoryBody';
import { clampZoom, nudgeTabZoom } from './tabZoom';
import { LoadingState } from '@/components/ui/page-header';

/**
 * What is being played: the brief, the rolled axes, the tab and the neck.
 * The same for a single exercise and for the current item of a routine.
 */
export function PracticeBody() {
  const instrument = useSettings((s) => s.settings.instrument);
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);

  if (!instance || !snapshot) {
    return <LoadingState>Rolling a variation…</LoadingState>;
  }

  return (
    <>
      <div className="px-8 pt-6 pb-4">
        <Kicker accent>This time you are playing</Kicker>
        <h2 className="max-w-[820px]">{instance.brief.headline}</h2>
        <p className="max-w-[640px] text-body-sm text-ink-muted">
          {instance.brief.instruction}
        </p>
      </div>

      <AxisStrip />

      {/* Nothing written — an improvisation — is counted, not read. */}
      {instance.kind === 'played' &&
        (instance.phrase.notes.length === 0 ? (
          <ImprovBody instance={instance} instrument={instrument} />
        ) : (
          <PlayedBody instance={instance} instrument={instrument} />
        ))}
      {instance.kind === 'theory' && <TheoryBody instance={instance} />}
    </>
  );
}

function PlayedBody({
  instance,
  instrument,
}: {
  instance: Extract<
    NonNullable<ReturnType<typeof usePractice.getState>['instance']>,
    { kind: 'played' }
  >;
  instrument: ReturnType<typeof useSettings.getState>['settings']['instrument'];
}) {
  const state = usePractice((s) => s.snapshot?.state);
  const playing = state === 'playing';
  // Paused keeps the playhead where it stopped — losing your place is exactly
  // what you did not want when you paused.
  const showPlayhead = playing || state === 'paused' || state === 'count-in';
  const tick = usePhraseTick(showPlayhead);
  // Counting in, the playhead sits on the first note whatever the last pass
  // reached: the count-in is a fresh start, and a restart must look like one.
  const playheadTick = showPlayhead ? (state === 'count-in' ? 0 : tick) : null;
  const seekable = playing || state === 'paused';
  const chords = usePractice((s) => s.chords);
  /**
   * Clicking a note moves the playhead to it. A repeating phrase is drawn once
   * but played several times over, so the click lands in the pass being played
   * rather than jumping back to the first.
   */
  const seek = (startTick: number) => {
    const total = instance.phrase.totalTicks;
    const at = usePractice.getState().runner?.snapshot.phraseTick ?? 0;
    const pass = total > 0 ? Math.floor(at / total) : 0;
    usePractice.getState().seekTo(pass * total + startTick);
  };

  const ui = useSettings((s) => s.settings.ui);
  const save = useSettings((s) => s.save);
  const hasNeck = instance.neck.notes.length > 0;
  const showNeck = hasNeck && ui.showNeck;
  const videoColumn = useVideoColumn();
  const keyMode = usePractice((s) => s.snapshot?.keyMode);
  const hasCircle = keyMode !== undefined;
  const showCircle = ui.showCircle !== false && hasCircle;
  // The column is there for the panels themselves; minimized, they shrink to
  // their titles rather than vanishing, so they can be brought back from here.
  // Hide Info puts the whole column away and gives the tab the width.
  const showSide = (hasNeck || videoColumn || hasCircle) && ui.showInfoColumn !== false;
  const wide = videoColumn || showNeck || showCircle;
  // One size for every exercise. The tab works out how many bars fit.
  const zoom = clampZoom(ui.tabZoom);

  return (
    <div
      className={`grid gap-6 px-8 py-6 ${
        showSide ? (wide ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-[1fr_auto]') : ''
      }`}
    >
      <div className="sheet min-w-0 px-5 pt-4 pb-[18px]">
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
          <InfoColumnToggle />
        </div>
        <div className="mt-2">
          <TabStaff
            phrase={instance.phrase}
            instrument={instrument}
            playheadTick={playheadTick}
            chords={chords}
            {...(seekable ? { onSeek: seek } : {})}
            size="large"
            zoom={zoom}
            autoScroll={playing}
          />
        </div>
      </div>

      {showSide && (
        <div className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh_-_7.5rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          <BackingPanel />
          <ReferencePanel />
          {/* A note-finding exercise leaves the neck empty — drawing it would give the answers away. */}
          {hasNeck && (
            <SidePanel
              title="Shape on the neck"
              open={showNeck}
              onToggle={(open) => void save({ ui: { ...ui, showNeck: open } })}
            >
              <Fretboard
                instrument={instrument}
                overlay={instance.neck}
                fretRange={overlayFretRange(instance.neck, instrument)}
              />
            </SidePanel>
          )}
          {hasCircle && <CircleSheet keyMode={keyMode} />}
        </div>
      )}
    </div>
  );
}
