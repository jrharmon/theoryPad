import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useExercises } from '@/store/exercises';
import { useSettings } from '@/store/settings';
import { findExerciseDefinition } from '@/exercises/registry';
import { AxisPolicyEditor } from '@/components/variation/AxisPolicyEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import { Separator } from '@/components/ui/separator';
import { ParamsEditor } from './ParamsEditor';

export function ExerciseDetail() {
  const { exerciseId } = useParams();
  const { exercises, loaded, load, update, setAxisPolicy, resetToDefaults, remove } =
    useExercises();
  const navigate = useNavigate();
  const loadSettings = useSettings((s) => s.load);
  const instrument = useSettings((s) => s.settings.instrument);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const definition = exercise ? findExerciseDefinition(exercise.definitionId) : undefined;

  if (!loaded) return <p className="px-8 py-8 text-[13px] text-ink/55">Loading…</p>;
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
    <section>
      <div className="flex items-end justify-between px-8 py-7">
        <div className="min-w-0 flex-1">
          <Kicker accent>Exercise</Kicker>
          <h1>{definition.name}</h1>
          <p className="max-w-[640px] text-[15px] text-ink/70">{definition.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {definition.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={() => void resetToDefaults(exercise.id)}>
            Reset to defaults
          </Button>
          <Button
            variant="secondary"
            onClick={() => void remove(exercise.id).then(() => void navigate('/exercises'))}
          >
            Delete
          </Button>
          <Button asChild>
            <Link to={`/practice/exercise/${exercise.id}`}>Practice this</Link>
          </Button>
        </div>
      </div>

      <div
        className={`grid items-start gap-6 px-8 pt-1 pb-7 ${definition.kind === 'played' ? 'lg:grid-cols-[320px_1fr]' : ''}`}
      >
        {/* A theory exercise has no pulse, so nothing to set a tempo for. */}
        {definition.kind === 'played' && (
          <div className="sheet px-5 py-4">
            <Kicker>Tempo</Kicker>
            <div className="mt-3 space-y-4">
              <Field
                label="Target tempo"
                htmlFor="target-tempo"
                hint="The tempo you mean to play this at. Moving the tempo while practicing never changes it."
              >
                <Input
                  id="target-tempo"
                  type="number"
                  min={30}
                  max={300}
                  className="tabular-nums"
                  value={exercise.tempo.targetTempo ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    void update(exercise.id, {
                      tempo: {
                        ...exercise.tempo,
                        targetTempo: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>

              <Field
                label="Best ever"
                htmlFor="best-tempo"
                hint="Record keeping only. Nothing reads this."
              >
                <Input
                  id="best-tempo"
                  type="number"
                  min={30}
                  max={300}
                  className="tabular-nums"
                  value={exercise.tempo.maxTempo ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    void update(exercise.id, {
                      tempo: {
                        ...exercise.tempo,
                        maxTempo: e.target.value === '' ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        )}

        <div>
          {definition.params && (
            <div className="sheet mb-8 px-5 py-4">
              <Kicker>Settings</Kicker>
              <div className="mt-3 max-w-[320px]">
                <ParamsEditor
                  definition={definition}
                  stored={exercise.params}
                  onChange={(params) => void update(exercise.id, { params })}
                />
              </div>
            </div>
          )}

          <Kicker>What varies</Kicker>
          <p className="mb-3 max-w-[560px] text-[13px] text-ink/60">
            <strong>Roll</strong> picks a new value each time you open it or re-roll. <strong>Fixed</strong> pins one.{' '}
            <strong>Hold</strong> keeps whatever came up last and stays there until you press
            re-roll — for working one key for a while without pinning it forever. When rolling,
            click values to leave them out.
          </p>
          <AxisPolicyEditor
            axes={definition.axes}
            policies={exercise.axisPolicies}
            held={exercise.heldAxisValues}
            instrument={instrument}
            onChange={(axis, policy) => void setAxisPolicy(exercise.id, axis, policy)}
          />

          {definition.axes.length === 0 && (
            <p className="text-[13px] text-ink/60">
              This exercise is the same every time — it varies nothing.
            </p>
          )}
        </div>
      </div>

      <Separator className="invisible" />
    </section>
  );
}
