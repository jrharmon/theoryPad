import { axisDefinition } from '@/domain/variation';
import { usePractice } from '@/store/practice';
import { ReferenceTrigger } from './ReferenceTrigger';

/**
 * The rolled variation, one cell per axis.
 *
 * Freshly rolled axes are tinted and carry a marker, so a change is noticed —
 * and the marker matters, because colour alone is not a signal everyone gets.
 * An exercise that varies nothing renders nothing.
 */
export function AxisStrip() {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  if (!snapshot?.variation || !instance) return null;
  const variation = snapshot.variation;

  const order = instance.brief.highlightAxes;
  const shown = order
    .map((id) => snapshot.variation!.axes[id])
    .filter((axis): axis is NonNullable<typeof axis> => axis !== undefined);

  // Tempo is deliberately absent: the transport is frozen to the bottom of the
  // screen and always shows it, so a second copy here is noise.
  if (shown.length === 0) return null;

  // The key cell reads "Bb Ionian": the mode is rolled too, but showing it in
  // its own cell separates two halves of one idea.
  const mode = variation.axes.mode;

  const cells = shown.map((axis) => ({
    key: axis.id,
    label: axis.id === 'key' ? 'Key & mode' : axisDefinition(axis.id).label,
    value: axis.id === 'key' && mode ? `${axis.display} ${mode.display}` : axis.display,
    fresh: axis.fresh || (axis.id === 'key' && (mode?.fresh ?? false)),
    note: null as string | null,
  }));

  return (
    <div
      className="grid gap-2.5 px-8"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
      data-testid="axis-strip"
    >
      {cells.map((cell) => (
        <div
          key={cell.key}
          data-testid={`axis-${cell.key}`}
          data-fresh={cell.fresh}
          className={[
            'sheet rounded-[10px] px-4 py-3',
            cell.fresh ? 'bg-fresh text-fresh-ink' : '',
          ].join(' ')}
        >
          <p className="kicker">
            {cell.label}
            {cell.fresh && <span className="ml-1 font-bold text-accent-text"> ▲ new</span>}
          </p>
          {cell.key === 'key' ? (
            <ReferenceTrigger
              keyMode={snapshot.keyMode}
              className={`face-title text-left text-[19px] underline decoration-current/25 decoration-1 underline-offset-4 hover:decoration-current ${cell.fresh ? 'highlight' : ''}`}
            >
              {cell.value}
            </ReferenceTrigger>
          ) : (
            <p className={`face-title text-[19px] ${cell.fresh ? 'w-fit highlight' : ''}`}>
              {cell.value}
            </p>
          )}
          {cell.note && <p className="text-[11px] text-ink/64 tabular-nums">{cell.note}</p>}
        </div>
      ))}
    </div>
  );
}
