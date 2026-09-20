import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EmptyState } from '@/components/ui/empty-state';
import { findExerciseDefinition } from '@/exercises/registry';
import { useExercises } from '@/store/exercises';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { PracticeBody } from './PracticeBody';
import { PracticeSettingsDialog } from './PracticeSettingsDialog';
import { RunningChrome } from './RunningChrome';
import { TransportBar } from './TransportBar';
import { useKeyModeView } from '@/store/keyModeView';
import { useRunnerHotkeys } from './useRunnerHotkeys';
import { LoadingState } from '@/components/ui/page-header';

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
  const referenceOpen = useKeyModeView((s) => s.popover || s.sheet);
  useRunnerHotkeys({ onLeave: leave, enabled: !settingsOpen && !referenceOpen });

  const openSettings = () => {
    // Nothing should keep playing behind a dialog.
    usePractice.getState().pause();
    setSettingsOpen(true);
  };

  if (!loaded) return <LoadingState />;
  if (!exercise || !definition) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such exercise">
          <Link to="/exercises" className="text-accent-text underline">
            Back to the library
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <section className="pb-28">
      <RunningChrome name={definition.name} />

      <PracticeBody />

      {/* Frozen at the bottom, so a long exercise never means scrolling back
          down to reach the controls. */}
      <div className="fixed inset-x-4 bottom-3.5 z-20 rounded-[14px] bg-transport text-transport-ink shadow-(--shadow-float) ring-1 ring-transport-edge">
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
