import { axisDefinition } from '@/domain/variation';
import { usePractice } from '@/store/practice';

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

  if (shown.length === 0 && snapshot.currentTempo === null) return null;

  // The key cell reads "Bb Ionian": the mode is rolled too, but showing it in
  // its own cell separates two halves of one idea.
  const mode = variation.axes.mode;

  const cells = [
    ...shown.map((axis) => ({
      key: axis.id,
      label: axis.id === 'key' ? 'Key & mode' : axisDefinition(axis.id).label,
      value:
        axis.id === 'key' && mode ? `${axis.display} ${mode.display}` : axis.display,
      fresh: axis.fresh || (axis.id === 'key' && (mode?.fresh ?? false)),
      note: null as string | null,
    })),
    ...(snapshot.currentTempo !== null
      ? [
          {
            key: 'tempo',
            label: 'Tempo',
            value: String(snapshot.currentTempo),
            fresh: false,
            note:
              snapshot.targetTempo !== null && snapshot.targetTempo !== snapshot.currentTempo
                ? `target ${snapshot.targetTempo}`
                : null,
          },
        ]
      : []),
  ];

  return (
    <div
      className="grid border-b border-divider"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
      data-testid="axis-strip"
    >
      {cells.map((cell, index) => (
        <div
          key={cell.key}
          data-testid={`axis-${cell.key}`}
          data-fresh={cell.fresh}
          className={[
            'px-4 py-3',
            index > 0 ? 'border-l border-divider' : '',
            cell.fresh ? 'bg-accent-100 text-accent-800' : '',
          ].join(' ')}
        >
          <p className="kicker">
            {cell.label}
            {cell.fresh && <span className="ml-1 font-bold"> ▲ new</span>}
          </p>
          <p className="text-[19px] font-extrabold">{cell.value}</p>
          {cell.note && <p className="text-[11px] text-ink/55 tabular-nums">{cell.note}</p>}
        </div>
      ))}
    </div>
  );
}
