import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChordSpan } from '@/domain/backing';
import type { Instrument } from '@/domain/instrument';
import { stringCount, stringLabel } from '@/domain/instrument';
import type { Articulation, Bar, Phrase, TabNote } from '@/domain/phrase';
import { PPQ, requiredSubdivision, ticksPerBar } from '@/domain/phrase';
import { barsPerLine, zoomScale } from './tabLayout';

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
  /**
   * The generated backing's chords, from bar 1: drawn above the tab where each
   * starts, and again, in parentheses, at the start of a line it is still
   * sounding into. The one under the playhead is highlighted.
   */
  chords?: readonly ChordSpan[] | null;
  /**
   * Called with a note's start tick when it is clicked. Given, every written
   * note becomes a target you can move the playhead to; omitted, the tab is
   * read-only.
   */
  onSeek?: (startTick: number) => void;
  showBarLabels?: boolean;
  showPickStrokes?: boolean;
  /** Bars per line. 'auto' keeps a line readable at any subdivision. */
  barsPerSystem?: number | 'auto';
  /**
   * Size steps from the default: positive is bigger (fewer bars fit a line),
   * negative smaller (more fit). With 'auto', bars per line follow the width.
   */
  zoom?: number;
  /**
   * Keep the line being played in view. On by default while a playhead is
   * shown: you cannot scroll with a guitar in your hands.
   */
  autoScroll?: boolean;
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
  chords = null,
  onSeek,
  showBarLabels = true,
  showPickStrokes = false,
  barsPerSystem = 'auto',
  zoom = 0,
  autoScroll = true,
  className,
}: TabStaffProps) {
  const resolution = subdivision ?? requiredSubdivision(phrase);
  const ticksPerColumn = PPQ / resolution;
  const columnsPerBar = ticksPerBar(phrase.timeSignature) / ticksPerColumn;
  const scale = zoomScale(zoom);
  const fretSize = FRET_SIZE[size] * scale;
  const rowHeight = Math.round(ROW_HEIGHT[size] * scale);

  // Bars per line follow the width actually available, so a wide screen or a
  // hidden neck diagram gets more on each line.
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const perSystem =
    barsPerSystem === 'auto'
      ? barsPerLine(columnsPerBar, width === null ? null : width - LABEL_COL[size], fretSize)
      : Math.max(1, barsPerSystem);

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

  // One copy is drawn, and the chords restart at every copy, so the first
  // copy's are the ones to draw.
  const lane = useMemo(
    () => chords?.filter((c) => c.startTick < phrase.totalTicks) ?? null,
    [chords, phrase.totalTicks],
  );
  const currentChord =
    lane && wrappedTick !== null
      ? lane.findIndex(
          (c) => wrappedTick >= c.startTick && wrappedTick < c.startTick + c.durationTicks,
        )
      : -1;

  const systems = chunk(phrase.bars, perSystem);

  const columnsPerSystem = perSystem * columnsPerBar;
  /**
   * Every line is laid out to the same number of columns, so a bar is the same
   * width wherever it falls. A short last line ends early instead of stretching
   * its bars across the page, which read as longer than they were. A phrase
   * that fits on one line has nothing to be consistent with, so it takes the
   * full width as before.
   */
  const slotColumns = Math.min(perSystem, phrase.bars.length || perSystem) * columnsPerBar;
  const activeSystem =
    playheadColumn === null ? null : Math.floor(playheadColumn / columnsPerSystem);

  const lastScrolled = useRef<number | null>(null);

  useEffect(() => {
    if (!autoScroll || activeSystem === null) return;
    // Only on a line change: scrolling every frame would fight the player.
    if (lastScrolled.current === activeSystem) return;
    lastScrolled.current = activeSystem;

    container.current
      ?.querySelector(`[data-testid="tab-system-${activeSystem}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [autoScroll, activeSystem]);

  return (
    <div
      ref={container}
      className={className}
      data-testid="tab-staff"
      data-columns={Math.max(1, Math.ceil(phrase.totalTicks / ticksPerColumn))}
      data-systems={systems.length}
      data-active-system={activeSystem ?? ''}
    >
      {systems.map((bars, systemIndex) => (
        <TabSystem
          key={bars[0]?.index ?? systemIndex}
          systemIndex={systemIndex}
          bars={bars}
          instrument={instrument}
          placed={placed}
          size={size}
          rowHeight={rowHeight}
          fretSize={fretSize}
          ticksPerColumn={ticksPerColumn}
          columnsPerBar={columnsPerBar}
          slotColumns={slotColumns}
          playheadColumn={playheadColumn}
          chords={lane}
          currentChord={currentChord}
          showBarLabels={showBarLabels}
          showPickStrokes={showPickStrokes}
          {...(onSeek ? { onSeek } : {})}
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
  rowHeight: number;
  fretSize: number;
  ticksPerColumn: number;
  columnsPerBar: number;
  /** Columns the line is laid out to — the same on every line, so bars match. */
  slotColumns: number;
  playheadColumn: number | null;
  chords: readonly ChordSpan[] | null;
  /** Index into `chords` of the one under the playhead; -1 for none. */
  currentChord: number;
  showBarLabels: boolean;
  showPickStrokes: boolean;
  onSeek?: (startTick: number) => void;
}

function TabSystem({
  systemIndex,
  bars,
  instrument,
  placed,
  size,
  rowHeight,
  fretSize,
  ticksPerColumn,
  columnsPerBar,
  slotColumns,
  playheadColumn,
  chords,
  currentChord,
  showBarLabels,
  showPickStrokes,
  onSeek,
}: TabSystemProps) {
  const strings = stringCount(instrument);
  const firstColumn = Math.floor((bars[0]?.startTick ?? 0) / ticksPerColumn);
  const columnCount = bars.length * columnsPerBar;

  // Screen rows run highest string first; the model runs lowest first.
  const rows = useMemo(
    () => Array.from({ length: strings }, (_, i) => strings - 1 - i),
    [strings],
  );

  const labelCol = LABEL_COL[size];
  // Laid out to the full line, not to this line's bars: the tracks past the
  // last bar are simply left empty.
  const gridColumns = `${labelCol}px repeat(${slotColumns}, minmax(0, 1fr))`;
  const unused = Math.max(0, slotColumns - columnCount);

  const localPlayhead =
    playheadColumn !== null &&
    playheadColumn >= firstColumn &&
    playheadColumn < firstColumn + columnCount
      ? playheadColumn - firstColumn
      : null;

  return (
    <div
      className={systemIndex > 0 ? 'mt-6' : undefined}
      data-testid={`tab-system-${systemIndex}`}
    >
      {chords && (
        <ChordLane
          systemIndex={systemIndex}
          chords={chords}
          currentChord={localPlayhead === null ? -1 : currentChord}
          startTick={firstColumn * ticksPerColumn}
          endTick={(firstColumn + columnCount) * ticksPerColumn}
          ticksPerColumn={ticksPerColumn}
          gridColumns={gridColumns}
        />
      )}
      <div className="relative">
        {localPlayhead !== null && (
          <div
            data-testid="playhead"
            data-column={playheadColumn}
            data-system={systemIndex}
            aria-hidden
            className="pointer-events-none absolute -top-0.5 -bottom-0.5 rounded-[5px] bg-playhead mix-blend-multiply dark:mix-blend-normal"
            style={{
              // Positioned by CSS against the column count so it tracks the grid
              // at any width, and so playback need not re-render the tree.
              left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${localPlayhead / slotColumns})`,
              width: `calc((100% - ${labelCol}px) / ${slotColumns})`,
            }}
          />
        )}

        {/* A rule at the start and end of every bar, from the top string to
            the bottom one. Column edges, so it never runs through a number. */}
        {Array.from({ length: bars.length + 1 }, (_, k) => (
          <div
            key={`bar-line-${k}`}
            data-testid="bar-line"
            aria-hidden
            className="pointer-events-none absolute w-px bg-tab-bar"
            style={{
              top: rowHeight / 2,
              bottom: rowHeight / 2,
              left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${(k * columnsPerBar) / slotColumns})`,
              ...(k === bars.length ? { transform: 'translateX(-1px)' } : {}),
            }}
          />
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: gridColumns }}>
          {rows.map((stringIndex) => (
            <TabRow
              key={stringIndex}
              instrument={instrument}
              stringIndex={stringIndex}
              firstColumn={firstColumn}
              columnCount={columnCount}
              unusedColumns={unused}
              placed={placed.get(stringIndex) ?? []}
              rowHeight={rowHeight}
              fretSize={fretSize}
              showPickStrokes={showPickStrokes}
              {...(onSeek ? { onSeek } : {})}
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

/**
 * The chords over one line of tab: each symbol above the column its chord
 * starts on, and a chord still sounding from the line before in parentheses at
 * the start. The one being played carries the highlighter — only on the line
 * the playhead is on.
 */
function ChordLane({
  systemIndex,
  chords,
  currentChord,
  startTick,
  endTick,
  ticksPerColumn,
  gridColumns,
}: {
  systemIndex: number;
  chords: readonly ChordSpan[];
  currentChord: number;
  startTick: number;
  endTick: number;
  ticksPerColumn: number;
  gridColumns: string;
}) {
  const labels = chords.flatMap((chord, index) => {
    const end = chord.startTick + chord.durationTicks;
    if (end <= startTick || chord.startTick >= endTick) return [];
    const carried = chord.startTick < startTick;
    const from = Math.max(chord.startTick, startTick);
    const column = Math.floor((from - startTick) / ticksPerColumn);
    const span = Math.max(1, Math.ceil((Math.min(end, endTick) - from) / ticksPerColumn));
    return [{ chord, index, carried, column, span }];
  });

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: gridColumns }}
      className="pb-1"
      data-testid={`chord-lane-${systemIndex}`}
    >
      {labels.map(({ chord, index, carried, column, span }) => (
        <span
          key={index}
          className="min-w-0 truncate"
          style={{ gridRow: 1, gridColumn: `${column + 2} / span ${span}` }}
        >
          <span
            data-testid="chord-symbol"
            data-current={index === currentChord}
            className={`num rounded-[5px] px-1 text-caption font-semibold text-ink ${
              index === currentChord ? 'bg-playhead' : ''
            }`}
          >
            {carried ? `(${chord.symbol})` : chord.symbol}
          </span>
        </span>
      ))}
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
        'font-semibold text-accent-text',
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
        'num flex items-baseline whitespace-nowrap bg-paper px-[1px] leading-none [font-weight:var(--tab-digit-weight)]',
        note.role === 'target' ? 'text-accent-text' : 'text-tab-digit',
      ].join(' ')}
      style={{ fontSize: fretSize }}
    >
      {showPickStrokes && note.pickStroke && (
        <span
          data-testid={`pick-stroke-${stringIndex}-${column}`}
          className="mr-[1px] self-start text-[0.62em] font-semibold text-accent-text"
        >
          {note.pickStroke === 'down' ? '⊓' : 'V'}
        </span>
      )}
      {mark?.leading && glyph}
      {/* The root is circled, the way tab has always circled it. Only the fret
          number goes inside: a pick stroke or an articulation mark describes
          how you play the note, not which note it is. Padding is in em so the
          ring holds its shape at every zoom step. */}
      {note.role === 'root' ? (
        <span
          data-testid={`tab-root-ring-${stringIndex}-${column}`}
          className="rounded-full border border-tab-digit/45 px-[0.34em] py-[0.1em]"
        >
          {note.display ?? note.fret}
        </span>
      ) : (
        (note.display ?? note.fret)
      )}
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
  /** Tracks left over at the end of a short last line. */
  unusedColumns: number;
  placed: Placed[];
  rowHeight: number;
  fretSize: number;
  showPickStrokes: boolean;
  onSeek?: (startTick: number) => void;
}

function TabRow({
  instrument,
  stringIndex,
  firstColumn,
  columnCount,
  unusedColumns,
  placed,
  rowHeight,
  fretSize,
  showPickStrokes,
  onSeek,
}: TabRowProps) {
  const byColumn = new Map(placed.map((p) => [p.column, p.note]));

  /**
   * The string line is a row background rather than a border, and fret numbers
   * carry the page background so they visually break it. That is the detail
   * that makes this read as tab rather than a table of numbers.
   */
  const lineBackground = {
    backgroundImage:
      'linear-gradient(to bottom, transparent calc(50% - 0.5px), var(--color-tab-line) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px))',
  };

  return (
    <>
      <div
        className="num grid place-items-center bg-paper text-caption text-ink-faint"
        style={{ height: rowHeight, ...lineBackground }}
        data-testid={`tab-string-label-${stringIndex}`}
      >
        <span className="bg-paper px-1">{stringLabel(instrument, stringIndex)}</span>
      </div>

      {Array.from({ length: columnCount }, (_, offset) => {
        // Test ids and the playhead use absolute columns, so a note keeps the
        // same identity wherever it lands once the phrase wraps onto systems.
        const column = firstColumn + offset;
        const note = byColumn.get(column);
        const chip = note && (
          <NoteChip
            stringIndex={stringIndex}
            column={column}
            note={note}
            fretSize={fretSize}
            showPickStrokes={showPickStrokes}
          />
        );
        const cell = { height: rowHeight, ...lineBackground };
        // The whole cell is the target, not the digit: a fret number is a few
        // pixels wide and this is clicked with a guitar in your hands.
        return note && onSeek ? (
          <button
            key={column}
            type="button"
            // Out of the tab order on purpose: a phrase runs to hundreds of
            // notes, and tabbing through all of them to reach the transport
            // would be worse than the shortcut is worth. Everything this does
            // is on a hotkey already; the click is the pointer's way in.
            tabIndex={-1}
            className="grid cursor-pointer place-items-center hover:bg-ink/5"
            style={cell}
            onClick={() => onSeek(note.startTick)}
            aria-label={`Play from fret ${note.fret} on ${stringLabel(instrument, stringIndex)}`}
          >
            {chip}
          </button>
        ) : (
          <div key={column} className="grid place-items-center" style={cell}>
            {chip}
          </div>
        );
      })}

      {/* A short last line ends here: the tracks past its last bar are held
          open so the strings below still start in the label column, and they
          carry no string line, so the staff stops with the music. */}
      {unusedColumns > 0 && (
        <div
          aria-hidden
          data-testid={`tab-line-end-${stringIndex}`}
          style={{ height: rowHeight, gridColumn: `span ${unusedColumns}` }}
        />
      )}
    </>
  );
}
