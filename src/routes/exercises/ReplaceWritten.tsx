import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState, PageHeader } from '@/components/ui/page-header';
import { useExercises } from '@/store/exercises';
import { WrittenImport } from './WrittenImport';
import { writtenSettings, writtenSource, type WrittenChoice } from './written';

/**
 * Replace a written exercise's notes from a file (doc 16, decision 16): new
 * notes, tuning and capo, written tempo, key and source. Everything else
 * stays — name, tags, folder, history, practice tempo, metronome, backing —
 * and routine items, which read the notes through, get the new ones.
 */
export function ReplaceWritten() {
  const { exerciseId } = useParams();
  const navigate = useNavigate();
  const { exercises, loaded, load, update } = useExercises();
  const [choice, setChoice] = useState<WrittenChoice | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!loaded) return <LoadingState />;
  if (!exercise || exercise.definitionId !== 'phrase') {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such written exercise">
          <Link to="/exercises" className="text-accent-text underline">
            Back to the library
          </Link>
        </EmptyState>
      </div>
    );
  }

  const back = `/exercises/${exercise.id}`;
  const replace = async () => {
    if (!choice || saving) return;
    setSaving(true);
    const settings = writtenSettings(choice);
    await update(exercise.id, {
      params: settings.params,
      ...(settings.tuning ? { tuning: settings.tuning } : {}),
      axisPolicies: { ...exercise.axisPolicies, ...settings.axisPolicies },
      // Its other locks stay as the player left them.
      locked: {
        params: [...new Set([...exercise.locked.params, ...(settings.locked?.params ?? [])])],
        axes: [...new Set([...exercise.locked.axes, ...(settings.locked?.axes ?? [])])],
      },
    });
    void navigate(back, { replace: true });
  };

  return (
    <section>
      <PageHeader
        kicker="Replace from file"
        title={exercise.name}
        introClassName="max-w-[900px]"
        intro={`Now: ${writtenSource(exercise) ?? ''}. New notes replace these; its name, history, tempo and places in routines stay.`}
      >
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to={back}>Cancel</Link>
          </Button>
          <Button disabled={!choice || saving} onClick={() => void replace()}>
            Replace
          </Button>
        </div>
      </PageHeader>
      <div className="px-8 pt-1 pb-8">
        <WrittenImport onChange={setChoice} />
      </div>
    </section>
  );
}
