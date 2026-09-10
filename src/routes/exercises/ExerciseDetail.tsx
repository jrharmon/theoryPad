import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useExercises } from '@/store/exercises';
import { useSettings } from '@/store/settings';
import { findExerciseDefinition } from '@/exercises/registry';
import { axisDefinition } from '@/domain/variation';
import type { AxisId, AxisPolicy } from '@/domain/variation';
import { Button, EmptyState, Field, Kicker, NumberInput, Rule, Tag } from '@/components/ui';

export function ExerciseDetail() {
  const { exerciseId } = useParams();
  const { exercises, loaded, load, update } = useExercises();
  const loadSettings = useSettings((s) => s.load);

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
          <Link to="/exercises" className="text-accent-700 underline">
            Back to the library
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-end justify-between border-b-2 border-divider px-8 py-7">
        <div>
          <Kicker accent>Exercise</Kicker>
          <h1 className="text-[42px]">{exercise.name}</h1>
          <p className="max-w-[640px] text-[15px] text-ink/70">{definition.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {definition.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
        <Link to={`/practice/exercise/${exercise.id}`}>
          <Button variant="primary">Practise this</Button>
        </Link>
      </div>

      <div className="grid gap-8 px-8 py-7 lg:grid-cols-[320px_1fr]">
        <div>
          <Kicker>Tempo and reps</Kicker>
          <div className="mt-3 space-y-4">
            <Field
              label="Target tempo"
              hint="The tempo you mean to play this at. Moving the tempo while practising never changes it."
            >
              <NumberInput
                min={30}
                max={300}
                value={exercise.tempo.targetTempo ?? ''}
                onChange={(e) =>
                  void update(exercise.id, {
                    tempo: {
                      ...exercise.tempo,
                      targetTempo: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>

            <Field label="Best ever" hint="Record keeping only. Nothing reads this.">
              <NumberInput
                min={30}
                max={300}
                value={exercise.tempo.maxTempo ?? ''}
                onChange={(e) =>
                  void update(exercise.id, {
                    tempo: {
                      ...exercise.tempo,
                      maxTempo: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>

            <Field label="Reps">
              <NumberInput
                min={1}
                max={9}
                value={exercise.defaultReps}
                onChange={(e) => void update(exercise.id, { defaultReps: Number(e.target.value) })}
              />
            </Field>
          </div>
        </div>

        <div>
          <Kicker>What varies</Kicker>
          <p className="mb-3 text-[13px] text-ink/60">
            Each axis can roll freely, be pinned to one value, or hold whatever it was last time.
          </p>
          <AxisPolicyEditor
            axes={definition.axes}
            policies={exercise.axisPolicies}
            onChange={(axisPolicies) => void update(exercise.id, { axisPolicies })}
          />

          {definition.axes.length === 0 && (
            <p className="text-[13px] text-ink/60">
              This exercise is the same every time — it varies nothing.
            </p>
          )}
        </div>
      </div>

      <Rule strong />
    </section>
  );
}

/** One row per axis: the control that replaced the wildness dial. */
function AxisPolicyEditor({
  axes,
  policies,
  onChange,
}: {
  axes: AxisId[];
  policies: Partial<Record<AxisId, AxisPolicy>>;
  onChange: (next: Partial<Record<AxisId, AxisPolicy>>) => void;
}) {
  return (
    <div className="border border-divider">
      {axes.map((id, index) => (
        <AxisRow
          key={id}
          id={id}
          first={index === 0}
          policy={policies[id] ?? { mode: 'roll' }}
          onChange={(policy) => onChange({ ...policies, [id]: policy })}
        />
      ))}
    </div>
  );
}

function AxisRow({
  id,
  first,
  policy,
  onChange,
}: {
  id: AxisId;
  first: boolean;
  policy: AxisPolicy;
  onChange: (policy: AxisPolicy) => void;
}) {
  const definition = axisDefinition(id);
  // The real instrument matters: positions are filtered by fret count and
  // string sets are generated from the tuning.
  const instrument = useSettings((s) => s.settings.instrument);

  const candidates = useMemo(
    () => definition.candidates({ instrument, resolved: {} }),
    [definition, instrument],
  );

  return (
    <div
      className={`grid grid-cols-[140px_120px_1fr] items-center gap-3 px-3 py-2 ${
        first ? '' : 'border-t border-divider'
      }`}
    >
      <span className="text-[13px] font-semibold">{definition.label}</span>

      <select
        value={policy.mode}
        aria-label={`${definition.label} policy`}
        className="border border-divider bg-bg px-2 py-1 text-[13px]"
        onChange={(e) => {
          const mode = e.target.value as AxisPolicy['mode'];
          if (mode === 'fixed') {
            const first = candidates[0];
            onChange({ mode: 'fixed', value: first ? definition.key(first) : '' });
          } else if (mode === 'hold') {
            onChange({ mode: 'hold' });
          } else {
            onChange({ mode: 'roll' });
          }
        }}
      >
        <option value="roll">Roll</option>
        <option value="fixed">Fixed</option>
        <option value="hold">Hold</option>
      </select>

      {policy.mode === 'fixed' && candidates.length > 0 && (
        <select
          value={policy.value}
          aria-label={`${definition.label} value`}
          className="border border-divider bg-bg px-2 py-1 text-[13px]"
          onChange={(e) => onChange({ mode: 'fixed', value: e.target.value })}
        >
          {candidates.map((candidate) => (
            <option key={definition.key(candidate)} value={definition.key(candidate)}>
              {definition.format(candidate)}
            </option>
          ))}
        </select>
      )}

      {policy.mode === 'roll' && (
        <span className="text-[12px] text-ink/50">Any of {candidates.length}</span>
      )}
      {policy.mode === 'hold' && (
        <span className="text-[12px] text-ink/50">Keeps last session’s value</span>
      )}
    </div>
  );
}
