import { useMemo } from 'react';
import type { FretPosition, Instrument } from '@/domain/instrument';
import {
  isDoubleMarkerFret,
  isMarkerFret,
  pitchClassAt,
  stringCount,
  stringLabel,
} from '@/domain/instrument';
import type { NeckLabelMode, NeckOverlay } from '@/domain/neck';
import type { NoteRole } from '@/domain/phrase';

export interface FretboardProps {
  instrument: Instrument;
  overlay: NeckOverlay;
  fretRange?: { low: number; high: number };
  size?: 'compact' | 'large';
  onFretClick?: (position: FretPosition) => void;
  className?: string;
}

const ROW_HEIGHT = { compact: 26, large: 38 } as const;
const DOT_SIZE = { compact: 19, large: 26 } as const;
const LABEL_COL = { compact: 26, large: 34 } as const;

/** Note dots are the one round thing in the design — they are markers, not UI surfaces. */
const ROLE_CLASS: Record<NoteRole, string> = {
  root: 'bg-neutral-800 text-bg',
  target: 'bg-accent text-bg',
  'chord-tone': 'bg-neutral-300 text-ink',
  passing: 'bg-neutral-200 text-ink/70',
  none: 'bg-neutral-200 text-ink/70',
};

function labelFor(
  note: NeckOverlay['notes'][number],
  mode: NeckLabelMode,
  instrument: Instrument,
): string {
  if (note.label !== undefined) return note.label;
  switch (mode) {
    case 'degree':
      return note.degree.label;
    case 'note':
      return pitchClassAt(instrument, note.position);
    case 'finger':
      return '';
    case 'none':
      return '';
  }
}

export function Fretboard({
  instrument,
  overlay,
  fretRange,
  size = 'compact',
  onFretClick,
  className,
}: FretboardProps) {
  const strings = stringCount(instrument);
  const low = fretRange?.low ?? 0;
  const high = Math.min(fretRange?.high ?? 12, instrument.fretCount);
  const frets = useMemo(
    () => Array.from({ length: high - low + 1 }, (_, i) => low + i),
    [low, high],
  );

  const labelMode = overlay.labelMode ?? 'degree';
  const emphasis = new Set(overlay.emphasisFrets ?? []);

  // Screen rows run highest string first; the model runs lowest first. This
  // inversion happens here and in TabStaff, nowhere else.
  const rows = useMemo(
    () => Array.from({ length: strings }, (_, i) => strings - 1 - i),
    [strings],
  );

  const byPosition = useMemo(() => {
    const map = new Map<string, NeckOverlay['notes'][number]>();
    for (const note of overlay.notes) {
      map.set(`${note.position.string}:${note.position.fret}`, note);
    }
    return map;
  }, [overlay.notes]);

  const rowHeight = ROW_HEIGHT[size];
  const dotSize = DOT_SIZE[size];
  const gridColumns = `${LABEL_COL[size]}px repeat(${frets.length}, minmax(0, 1fr))`;

  return (
    <div className={className} data-testid="fretboard">
      <div
        className="border-t-2 border-b-2 border-divider"
        style={{ display: 'grid', gridTemplateColumns: gridColumns }}
        role="grid"
        aria-label={`${instrument.name} fretboard, frets ${low} to ${high}`}
      >
        {rows.map((stringIndex) => (
          <FretboardRow
            key={stringIndex}
            instrument={instrument}
            stringIndex={stringIndex}
            frets={frets}
            rowHeight={rowHeight}
            dotSize={dotSize}
            labelMode={labelMode}
            byPosition={byPosition}
            size={size}
            {...(onFretClick ? { onFretClick } : {})}
          />
        ))}
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: gridColumns }}
        aria-hidden
        className="pt-1"
      >
        <span />
        {frets.map((fret) => (
          <span
            key={fret}
            data-testid={`fret-number-${fret}`}
            className={[
              'text-center text-[10px] tabular-nums',
              emphasis.has(fret) ? 'font-semibold text-accent-700' : 'text-ink/50',
            ].join(' ')}
          >
            {fret}
          </span>
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  instrument: Instrument;
  stringIndex: number;
  frets: number[];
  rowHeight: number;
  dotSize: number;
  labelMode: NeckLabelMode;
  byPosition: Map<string, NeckOverlay['notes'][number]>;
  size: 'compact' | 'large';
  onFretClick?: (position: FretPosition) => void;
}

function FretboardRow({
  instrument,
  stringIndex,
  frets,
  rowHeight,
  dotSize,
  labelMode,
  byPosition,
  onFretClick,
}: RowProps) {
  return (
    <>
      <div
        className="grid place-items-center text-[10px] text-ink/55"
        style={{ height: rowHeight }}
        data-testid={`string-label-${stringIndex}`}
      >
        {stringLabel(instrument, stringIndex)}
      </div>

      {frets.map((fret) => {
        const note = byPosition.get(`${stringIndex}:${fret}`);
        const isNut = fret === 0;
        const cell = (
          <>
            {/* The string line is drawn as a row background, not a border. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink/40"
            />
            {isMarkerFret(fret) && !note && (
              <span
                aria-hidden
                className={[
                  'pointer-events-none absolute size-1.5 rounded-full bg-ink/15',
                  isDoubleMarkerFret(fret) ? 'opacity-100' : 'opacity-70',
                ].join(' ')}
              />
            )}
            {note && (
              <span
                data-testid={`note-${stringIndex}-${fret}`}
                data-role={note.role}
                className={[
                  'relative grid place-items-center rounded-full font-extrabold',
                  ROLE_CLASS[note.role],
                ].join(' ')}
                style={{ width: dotSize, height: dotSize, fontSize: dotSize * 0.42 }}
              >
                {labelFor(note, labelMode, instrument)}
              </span>
            )}
          </>
        );

        const style = {
          height: rowHeight,
          borderLeftWidth: isNut ? 2 : 1,
        };

        return onFretClick ? (
          <button
            key={fret}
            type="button"
            onClick={() => onFretClick({ string: stringIndex, fret })}
            aria-label={`String ${stringLabel(instrument, stringIndex)}, fret ${fret}`}
            className="relative grid place-items-center border-l border-ink/30 hover:bg-ink/5"
            style={style}
          >
            {cell}
          </button>
        ) : (
          <div
            key={fret}
            className="relative grid place-items-center border-l border-ink/30"
            style={style}
          >
            {cell}
          </div>
        );
      })}
    </>
  );
}
