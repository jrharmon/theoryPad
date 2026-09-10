import { useMemo } from 'react';
import type { Instrument } from '@/domain/instrument';
import { stringCount, stringLabel } from '@/domain/instrument';
import type { Articulation, Bar, Phrase, TabNote } from '@/domain/phrase';
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
  /** Bars per line. 'auto' keeps a line readable at any subdivision. */
  barsPerSystem?: number | 'auto';
  className?: string;
}

const ROW_HEIGHT = { compact: 19, large: 30 } as const;
const FRET_SIZE = { compact: 12, large: 19 } as const;
const LABEL_COL = { compact: 28, large: 34 } as const;

/**
 * Written articulation marks.
 *
 * `leading` marks connect this note to the one before it, so they are written
 * in front of the fret number — tab writes 5h7, not 5 7h. `trailing` marks
 * describe the note itself and follow it.
 */
const ARTICULATION_MARK: Partial<Record<Articulation, { glyph: string; leading: boolean }>> = {
  'hammer-on': { glyph: 'h', leading: true },
  'pull-off': { glyph: 'p', leading: true },
  'slide-up': { glyph: '/', leading: true },
  'slide-down': { glyph: '\\', leading: true },
  'slide-into': { glyph: '/', leading: true },
  bend: { glyph: 'b', leading: false },
  'bend-release': { glyph: 'r', leading: false },
  vibrato: { glyph: '~', leading: false },
  'palm-mute': { glyph: 'PM', leading: false },
  ghost: { glyph: '( )', leading: false },
  staccato: { glyph: '.', leading: false },
};

interface Placed {
  note: TabNote;
  /** Absolute column index across the whole phrase. */
  column: number;
}

/**
 * How many bars go on one line.
 *
 * Real tab breaks into systems rather than running one long line off the page,
 * and generated exercise phrases get long — seven modes across the neck is
 * dozens of bars. Four bars is the conventional line, but at fine subdivisions
 * that is far too many columns to read, so the default adapts to keep a line
 * near 32 columns.
 */
function resolveBarsPerSystem(
  barsPerSystem: number | 'auto',
  columnsPerBar: number,
): number {
  if (barsPerSystem !== 'auto') return Math.max(1, barsPerSystem);
  return Math.min(4, Math.max(1, Math.floor(32 / Math.max(1, columnsPerBar))));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function TabStaff({
  phrase,
  instrument,
  size = 'compact',
  subdivision,
  playheadTick = null,
  showBarLabels = true,
  showPickStrokes = false,
  barsPerSystem = 'auto',
  className,
}: TabStaffProps) {
  const resolution = subdivision ?? requiredSubdivision(phrase);
  const ticksPerColumn = PPQ / resolution;
  const columnsPerBar = ticksPerBar(phrase.timeSignature) / ticksPerColumn;
  const perSystem = resolveBarsPerSystem(barsPerSystem, columnsPerBar);

  const placed = useMemo(() => {
    const map = new Map<number, Placed[]>();
    for (const note of phrase.notes) {
      const column = Math.floor(note.startTick / ticksPerColumn);
      map.set(note.string, [...(map.get(note.string) ?? []), { note, column }]);
    }
    return map;
  }, [phrase.notes, ticksPerColumn]);

  /**
   * A repeating phrase plays past its own length, so the raw transport tick
   * runs off the end of what is drawn. Wrapping it back keeps the playhead on
   * the notes during every pass instead of vanishing after the first.
   */
  const wrappedTick =
    playheadTick === null || phrase.totalTicks <= 0
      ? null
      : ((playheadTick % phrase.totalTicks) + phrase.totalTicks) % phrase.totalTicks;
  const playheadColumn = wrappedTick === null ? null : Math.floor(wrappedTick / ticksPerColumn);

  const systems = chunk(phrase.bars, perSystem);

  return (
    <div
      className={className}
      data-testid="tab-staff"
      data-columns={Math.max(1, Math.ceil(phrase.totalTicks / ticksPerColumn))}
      data-systems={systems.length}
    >
      {systems.map((bars, systemIndex) => (
        <TabSystem
          key={bars[0]?.index ?? systemIndex}
          systemIndex={systemIndex}
          bars={bars}
          instrument={instrument}
          placed={placed}
          size={size}
          ticksPerColumn={ticksPerColumn}
          columnsPerBar={columnsPerBar}
          playheadColumn={playheadColumn}
          showBarLabels={showBarLabels}
          showPickStrokes={showPickStrokes}
        />
      ))}
    </div>
  );
}

interface TabSystemProps {
  systemIndex: number;
  bars: Bar[];
  instrument: Instrument;
  placed: Map<number, Placed[]>;
  size: 'compact' | 'large';
  ticksPerColumn: number;
  columnsPerBar: number;
  playheadColumn: number | null;
  showBarLabels: boolean;
  showPickStrokes: boolean;
}

function TabSystem({
  systemIndex,
  bars,
  instrument,
  placed,
  size,
  ticksPerColumn,
  columnsPerBar,
  playheadColumn,
  showBarLabels,
  showPickStrokes,
}: TabSystemProps) {
  const strings = stringCount(instrument);
  const firstColumn = Math.floor((bars[0]?.startTick ?? 0) / ticksPerColumn);
  const columnCount = bars.length * columnsPerBar;

  // Screen rows run highest string first; the model runs lowest first.
  const rows = useMemo(
    () => Array.from({ length: strings }, (_, i) => strings - 1 - i),
    [strings],
  );

  const rowHeight = ROW_HEIGHT[size];
  const fretSize = FRET_SIZE[size];
  const labelCol = LABEL_COL[size];
  const gridColumns = `${labelCol}px repeat(${columnCount}, minmax(0, 1fr))`;

  const localPlayhead =
    playheadColumn !== null &&
    playheadColumn >= firstColumn &&
    playheadColumn < firstColumn + columnCount
      ? playheadColumn - firstColumn
      : null;

  return (
    <div className={systemIndex > 0 ? 'mt-6' : undefined} data-testid={`tab-system-${systemIndex}`}>
      <div className="relative">
        {localPlayhead !== null && (
          <div
            data-testid="playhead"
            data-column={playheadColumn}
            data-system={systemIndex}
            aria-hidden
            className="pointer-events-none absolute -top-1 -bottom-1 bg-accent/20"
            style={{
              // Positioned by CSS against the column count so it tracks the grid
              // at any width, and so playback need not re-render the tree.
              left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${localPlayhead / columnCount})`,
              width: `calc((100% - ${labelCol}px) / ${columnCount})`,
            }}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: gridColumns }}>
          {rows.map((stringIndex) => (
            <TabRow
              key={stringIndex}
              instrument={instrument}
              stringIndex={stringIndex}
              firstColumn={firstColumn}
              columnCount={columnCount}
              placed={placed.get(stringIndex) ?? []}
              rowHeight={rowHeight}
              fretSize={fretSize}
              showPickStrokes={showPickStrokes}
            />
          ))}
        </div>
      </div>

      {showBarLabels && bars.length > 0 && (
        <div
          style={{ display: 'grid', gridTemplateColumns: gridColumns }}
          className="pt-1"
          data-testid={`bar-labels-${systemIndex}`}
        >
          <span />
          {bars.map((bar) => (
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

function NoteChip({
  stringIndex,
  column,
  note,
  fretSize,
  showPickStrokes,
}: {
  stringIndex: number;
  column: number;
  note: TabNote;
  fretSize: number;
  showPickStrokes: boolean;
}) {
  const mark = note.articulation ? ARTICULATION_MARK[note.articulation] : undefined;
  const glyph = mark && (
    <span
      data-testid={`articulation-${stringIndex}-${column}`}
      className={[
        mark.leading ? 'mr-[1px]' : 'ml-[1px]',
        'font-semibold text-accent-700',
      ].join(' ')}
      style={{ fontSize: fretSize * 0.72 }}
    >
      {mark.glyph}
    </span>
  );

  return (
    <span
      data-testid={`tab-note-${stringIndex}-${column}`}
      data-fret={note.fret}
      data-role={note.role ?? 'none'}
      data-articulation={note.articulation ?? ''}
      className={[
        'flex items-baseline whitespace-nowrap bg-bg px-[1px] font-extrabold tabular-nums leading-none',
        note.role === 'target' ? 'text-accent-700' : 'text-ink',
      ].join(' ')}
      style={{ fontSize: fretSize }}
    >
      {showPickStrokes && note.pickStroke && (
        <span
          data-testid={`pick-stroke-${stringIndex}-${column}`}
          className="mr-[1px] self-start text-[0.62em] font-semibold text-accent-700"
        >
          {note.pickStroke === 'down' ? '⊓' : 'V'}
        </span>
      )}
      {mark?.leading && glyph}
      {note.fret}
      {mark && !mark.leading && glyph}
    </span>
  );
}

interface TabRowProps {
  instrument: Instrument;
  stringIndex: number;
  /** Absolute column index this system starts at. */
  firstColumn: number;
  columnCount: number;
  placed: Placed[];
  rowHeight: number;
  fretSize: number;
  showPickStrokes: boolean;
}

function TabRow({
  instrument,
  stringIndex,
  firstColumn,
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

      {Array.from({ length: columnCount }, (_, offset) => {
        // Test ids and the playhead use absolute columns, so a note keeps the
        // same identity wherever it lands once the phrase wraps onto systems.
        const column = firstColumn + offset;
        const note = byColumn.get(column);
        return (
          <div
            key={column}
            className="grid place-items-center"
            style={{ height: rowHeight, ...lineBackground }}
          >
            {note && (
              <NoteChip
                stringIndex={stringIndex}
                column={column}
                note={note}
                fretSize={fretSize}
                showPickStrokes={showPickStrokes}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
