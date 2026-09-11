import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Fretboard, TabStaff } from '@/components/music';
import { ZOOM_MAX, ZOOM_MIN } from '@/components/music/tabLayout';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Kicker } from '@/components/ui/kicker';
import { overlayFretRange } from '@/domain/neck';
import { findExerciseDefinition } from '@/exercises/registry';
import { useExercises } from '@/store/exercises';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { AxisStrip } from './AxisStrip';
import { PracticeSettingsDialog } from './PracticeSettingsDialog';
import { RunningChrome } from './RunningChrome';
import { TransportBar } from './TransportBar';
import { useRunnerHotkeys } from './useRunnerHotkeys';

/**
 * Opening an exercise puts you straight into it: the variation is rolled and
 * the material generated on arrival, with nothing to click through. Audio is
 * the only thing that waits, because an AudioContext can only start from a
 * gesture — so the first press of Play does that.
 */
export function PracticeExercise() {
  const { exerciseId } = useParams();
  const { exercises, loaded, load } = useExercises();
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const prepared = useRef<string | null>(null);
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const definition = exercise ? findExerciseDefinition(exercise.definitionId) : undefined;

  useEffect(() => {
    if (!exercise || prepared.current === exercise.id) return;
    prepared.current = exercise.id;
    void usePractice.getState().prepare(exercise);
  }, [exercise]);

  // Leaving must not leave a metronome running.
  useEffect(() => () => void usePractice.getState().end(), []);

  const leave = useCallback(() => void navigate('/exercises'), [navigate]);
  useRunnerHotkeys({ onLeave: leave, enabled: !settingsOpen });

  const openSettings = () => {
    // Nothing should keep playing behind a dialog.
    usePractice.getState().pause();
    setSettingsOpen(true);
  };

  if (!loaded) return <p className="px-8 py-8 text-[13px] text-ink/55">Loading…</p>;
  if (!exercise || !definition) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such exercise">
          <Link to="/exercises" className="text-accent-700 underline">
            Back to the library
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <section className="pb-24">
      <RunningChrome name={definition.name} />

      {instance && snapshot ? (
        <>
          <div className="border-b border-divider px-8 py-6">
            <Kicker accent>This time you are playing</Kicker>
            <h2 className="max-w-[820px] text-[34px]">{instance.brief.headline}</h2>
            <p className="max-w-[640px] text-[14px] text-ink/70">{instance.brief.instruction}</p>
          </div>

          <AxisStrip />

          {instance.kind === 'played' && <PlayedBody instance={instance} instrument={instrument} />}
        </>
      ) : (
        <p className="px-8 py-8 text-[13px] text-ink/55">Rolling a variation…</p>
      )}

      {/* Frozen at the bottom, so a long exercise never means scrolling back
          down to reach the controls. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-divider bg-bg">
        <TransportBar onOpenSettings={openSettings} />
      </div>

      <PracticeSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        exercise={exercise}
        definition={definition}
      />
    </section>
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
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, ui.tabZoom));
  const setZoom = (next: number) => void save({ ui: { ...ui, tabZoom: next } });

  return (
    <div className={`grid gap-6 px-8 py-6 ${showNeck ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Kicker>Tab · generated for this variation</Kicker>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Tab zoom">
            {/* Smaller fits more bars on a line; bigger, fewer. */}
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom(zoom - 1)}
            >
              −
            </Button>
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom(zoom + 1)}
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

