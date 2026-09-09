import { useMemo } from 'react';
import type { Instrument } from '@/domain/instrument';
import { stringCount, stringLabel } from '@/domain/instrument';
import type { Articulation, Phrase, TabNote } from '@/domain/phrase';
import { PPQ, requiredSubdivision, ticksPerBar } from '@/domain/phrase';

export interface TabStaffProps {
  phrase: Phrase;
  instrument: Instrument;
  size?: 'compact' | 'large';
  /**
   * Render resolution as a divisor of a quarter note. Defaults to whatever the
   * phrase needs, so triplets get a grid that can hold them.
   */
  subdivision?: number;
  /** Current transport position; null hides the playhead. */
  playheadTick?: number | null;
  showBarLabels?: boolean;
  showPickStrokes?: boolean;
  className?: string;
}

const ROW_HEIGHT = { compact: 19, large: 30 } as const;
const FRET_SIZE = { compact: 12, large: 19 } as const;
const LABEL_COL = { compact: 28, large: 34 } as const;

/** Glyphs shown between notes; only articulations with a written mark appear. */
const ARTICULATION_GLYPH: Partial<Record<Articulation, string>> = {
  'hammer-on': 'h',
  'pull-off': 'p',
  'slide-up': '/',
  'slide-down': '\\',
  'slide-into': '/',
  bend: 'b',
  'bend-release': 'r',
  vibrato: '~',
  'palm-mute': 'PM',
};

interface Placed {
  note: TabNote;
  column: number;
}

export function TabStaff({
  phrase,
  instrument,
  size = 'compact',
  subdivision,
  playheadTick = null,
  showBarLabels = true,
  showPickStrokes = false,
  className,
}: TabStaffProps) {
  const strings = stringCount(instrument);
  const resolution = subdivision ?? requiredSubdivision(phrase);
  const ticksPerColumn = PPQ / resolution;
  const columnCount = Math.max(1, Math.ceil(phrase.totalTicks / ticksPerColumn));
  const columnsPerBar = ticksPerBar(phrase.timeSignature) / ticksPerColumn;

  // Screen rows run highest string first; the model runs lowest first.
  const rows = useMemo(
    () => Array.from({ length: strings }, (_, i) => strings - 1 - i),
    [strings],
  );

  const placed = useMemo(() => {
    const map = new Map<number, Placed[]>();
    for (const note of phrase.notes) {
      const column = Math.floor(note.startTick / ticksPerColumn);
      map.set(note.string, [...(map.get(note.string) ?? []), { note, column }]);
    }
    return map;
  }, [phrase.notes, ticksPerColumn]);

  const rowHeight = ROW_HEIGHT[size];
  const fretSize = FRET_SIZE[size];
  const gridColumns = `${LABEL_COL[size]}px repeat(${columnCount}, minmax(0, 1fr))`;

  const playheadColumn =
    playheadTick === null ? null : Math.floor(playheadTick / ticksPerColumn);

  return (
    <div className={className} data-testid="tab-staff" data-columns={columnCount}>
      <div className="relative">
        {playheadColumn !== null && playheadColumn >= 0 && playheadColumn < columnCount && (
          <div
            data-testid="playhead"
            data-column={playheadColumn}
            aria-hidden
            className="pointer-events-none absolute -top-1 -bottom-1 bg-accent/20"
            style={{
              // Positioned as a fraction of the note area, so it tracks the grid
              // at any width. Driven by a CSS value rather than React state, so
              // playback does not re-render the tree.
              left: `calc(${LABEL_COL[size]}px + (100% - ${LABEL_COL[size]}px) * ${
                playheadColumn / columnCount
              })`,
              width: `calc((100% - ${LABEL_COL[size]}px) / ${columnCount})`,
            }}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: gridColumns }}>
          {rows.map((stringIndex) => (
            <TabRow
              key={stringIndex}
              instrument={instrument}
              stringIndex={stringIndex}
              columnCount={columnCount}
              placed={placed.get(stringIndex) ?? []}
              rowHeight={rowHeight}
              fretSize={fretSize}
              showPickStrokes={showPickStrokes}
            />
          ))}
        </div>
      </div>

      {showBarLabels && phrase.bars.length > 0 && (
        <div
          style={{ display: 'grid', gridTemplateColumns: gridColumns }}
          className="pt-1"
          data-testid="bar-labels"
        >
          <span />
          {phrase.bars.map((bar) => (
            <span
              key={bar.index}
              data-testid={`bar-label-${bar.index}`}
              className="kicker truncate"
              style={{ gridColumn: `span ${columnsPerBar}` }}
            >
              {bar.label ?? `Bar ${bar.index + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface TabRowProps {
  instrument: Instrument;
  stringIndex: number;
  columnCount: number;
  placed: Placed[];
  rowHeight: number;
  fretSize: number;
  showPickStrokes: boolean;
}

function TabRow({
  instrument,
  stringIndex,
  columnCount,
  placed,
  rowHeight,
  fretSize,
  showPickStrokes,
}: TabRowProps) {
  const byColumn = new Map(placed.map((p) => [p.column, p.note]));

  /**
   * The string line is a row background rather than a border, and fret numbers
   * carry the page background so they visually break it. That is the detail
   * that makes this read as tab rather than a table of numbers.
   */
  const lineBackground = {
    backgroundImage:
      'linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(32,30,29,.42) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
  };

  return (
    <>
      <div
        className="grid place-items-center bg-bg text-[11px] text-ink/50"
        style={{ height: rowHeight, ...lineBackground }}
        data-testid={`tab-string-label-${stringIndex}`}
      >
        <span className="bg-bg px-1">{stringLabel(instrument, stringIndex)}</span>
      </div>

      {Array.from({ length: columnCount }, (_, column) => {
        const note = byColumn.get(column);
        return (
          <div
            key={column}
            className="grid place-items-center"
            style={{ height: rowHeight, ...lineBackground }}
          >
            {note && (
              <span
                data-testid={`tab-note-${stringIndex}-${column}`}
                data-fret={note.fret}
                data-role={note.role ?? 'none'}
                className={[
                  'bg-bg px-[1px] font-extrabold tabular-nums leading-none',
                  note.role === 'target' ? 'text-accent-700' : 'text-ink',
                ].join(' ')}
                style={{ fontSize: fretSize }}
              >
                {showPickStrokes && note.pickStroke && (
                  <span className="mr-[1px] align-super text-[0.6em] font-normal text-ink/50">
                    {note.pickStroke === 'down' ? '⊓' : 'V'}
                  </span>
                )}
                {note.fret}
                {note.articulation && ARTICULATION_GLYPH[note.articulation] && (
                  <span
                    data-testid={`articulation-${stringIndex}-${column}`}
                    className="ml-[1px] text-[0.7em] font-normal text-ink/60"
                  >
                    {ARTICULATION_GLYPH[note.articulation]}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
