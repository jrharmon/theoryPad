import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChordSpan } from '@/domain/backing';
import type { Instrument } from '@/domain/instrument';
import { stringCount, stringLabel } from '@/domain/instrument';
import type { Phrase, TabNote, TupletGroup } from '@/domain/phrase';
import { tupletGroups } from '@/domain/phrase';
import type { BarLayout } from './tabLayout';
import { columnAt, layOutBars, packLines, tickAtColumn, zoomScale } from './tabLayout';
import type { BeatMark, MarkSpan } from './tabMarks';
import { beatMarks, noteMarks, pickStrokeMarks, techniqueSpans } from './tabMarks';

export interface TabStaffProps {
  phrase: Phrase;
  instrument: Instrument;
  size?: 'compact' | 'large';
  /**
   * Render resolution as a divisor of a quarter note, for every bar. Left
   * out, each bar gets the grid its own notes need, so triplets get a grid
   * that can hold them without spreading out every other bar.
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
 * A fret number sits at the left of its column, just after the beat line, the
 * way tab writes it: its column starts at the note's tick, so a number in the
 * middle of a wide column read as late. These are fractions of the fret size.
 */
const DIGIT_INSET = 0.2;
/** Where a single digit's centre falls, from the column's left edge. */
const DIGIT_CENTRE = DIGIT_INSET + 0.32;

/** What one string shows in one column. */
interface Placed {
  /** Absolute column index across the whole phrase. */
  column: number;
  note?: TabNote;
  /** Grace notes take no column: they are written small, in front of their beat's note. */
  graces: TabNote[];
}

/** The runs drawn once over their notes, with the words tab writes for them. */
const SPANNED = [
  { technique: 'let-ring', label: 'let ring' },
  { technique: 'palm-mute', label: 'P.M.' },
] as const;

/** Split `items` into runs of the given lengths. */
function split<T>(items: readonly T[], lengths: readonly number[]): T[][] {
  let at = 0;
  return lengths.map((n) => items.slice(at, (at += n)));
}

/**
 * Columns into a line's local ones. `start` is the line's first absolute
 * column; an end tick rounds up, so a span covers the column its last tick is in.
 */
interface LineColumns {
  start: number;
  /** The column a tick starts in. */
  at: (tick: number) => number;
  /** One past the column a span ending at this tick ends in. */
  end: (tick: number) => number;
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
  const scale = zoomScale(zoom);
  const fretSize = FRET_SIZE[size] * scale;
  const rowHeight = Math.round(ROW_HEIGHT[size] * scale);
  const layouts = useMemo(() => layOutBars(phrase, subdivision), [phrase, subdivision]);
  const totalColumns = layouts.reduce((sum, b) => sum + b.columns, 0);

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

  const lineLengths =
    barsPerSystem === 'auto'
      ? packLines(
          layouts.map((b) => b.columns),
          width === null ? null : width - LABEL_COL[size],
          fretSize,
        )
      : Array.from({ length: Math.ceil(layouts.length / Math.max(1, barsPerSystem)) }, (_, i) =>
          Math.min(Math.max(1, barsPerSystem), layouts.length - i * Math.max(1, barsPerSystem)),
        );
  const systems = split(layouts, lineLengths);

  const placed = useMemo(() => {
    const map = new Map<number, Map<number, Placed>>();
    for (const note of phrase.notes) {
      const column = columnAt(layouts, note.startTick);
      const row = map.get(note.string) ?? new Map<number, Placed>();
      const cell = row.get(column) ?? { column, graces: [] };
      if (note.grace) cell.graces.push(note);
      else cell.note = note;
      row.set(column, cell);
      map.set(note.string, row);
    }
    return map;
  }, [phrase.notes, layouts]);

  const above = useMemo(() => beatMarks(phrase.notes), [phrase.notes]);
  const strokes = useMemo(
    () => (showPickStrokes ? pickStrokeMarks(phrase.notes) : []),
    [phrase.notes, showPickStrokes],
  );
  const spans = useMemo(
    () =>
      SPANNED.map(({ technique, label }) => ({
        label,
        spans: techniqueSpans(phrase.notes, technique),
      })).filter((lane) => lane.spans.length > 0),
    [phrase.notes],
  );

  /**
   * A repeating phrase plays past its own length, so the raw transport tick
   * runs off the end of what is drawn. Wrapping it back keeps the playhead on
   * the notes during every pass instead of vanishing after the first.
   */
  const wrappedTick =
    playheadTick === null || phrase.totalTicks <= 0
      ? null
      : ((playheadTick % phrase.totalTicks) + phrase.totalTicks) % phrase.totalTicks;
  const playheadColumn = wrappedTick === null ? null : columnAt(layouts, wrappedTick);

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

  const tuplets = useMemo(() => tupletGroups(phrase), [phrase]);

  /**
   * A full line fills the width. The last line is laid out to the widest line
   * before it, so it ends early instead of stretching its bars across the
   * page, which read as longer than they were. A phrase that fits on one line
   * has nothing to be consistent with, so it takes the full width.
   */
  const lineColumns = systems.map((bars) => bars.reduce((sum, b) => sum + b.columns, 0));
  const widest = Math.max(0, ...lineColumns.slice(0, -1));
  const slotColumns = lineColumns.map((columns, i) =>
    i === lineColumns.length - 1 ? Math.max(columns, widest) : columns,
  );
  const activeSystem =
    playheadColumn === null
      ? null
      : systems.findIndex((bars) => {
          const first = bars[0];
          const last = bars[bars.length - 1];
          return (
            first !== undefined &&
            last !== undefined &&
            playheadColumn >= first.firstColumn &&
            playheadColumn < last.firstColumn + last.columns
          );
        });

  const lastScrolled = useRef<number | null>(null);

  useEffect(() => {
    if (!autoScroll || activeSystem === null || activeSystem < 0) return;
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
      data-columns={Math.max(1, totalColumns)}
      data-systems={systems.length}
      data-active-system={activeSystem === null || activeSystem < 0 ? '' : activeSystem}
    >
      {systems.map((bars, systemIndex) => (
        <TabSystem
          key={bars[0]?.bar.index ?? systemIndex}
          systemIndex={systemIndex}
          bars={bars}
          layouts={layouts}
          instrument={instrument}
          placed={placed}
          size={size}
          rowHeight={rowHeight}
          fretSize={fretSize}
          slotColumns={slotColumns[systemIndex] ?? 1}
          playheadColumn={playheadColumn}
          chords={lane}
          currentChord={currentChord}
          tuplets={tuplets}
          above={above}
          strokes={strokes}
          spans={spans}
          showBarLabels={showBarLabels}
          {...(onSeek ? { onSeek } : {})}
        />
      ))}
    </div>
  );
}

interface TabSystemProps {
  systemIndex: number;
  /** This line's bars. */
  bars: BarLayout[];
  /** Every bar in the phrase, for turning ticks into columns. */
  layouts: readonly BarLayout[];
  instrument: Instrument;
  placed: Map<number, Map<number, Placed>>;
  size: 'compact' | 'large';
  rowHeight: number;
  fretSize: number;
  /** Columns the line is laid out to: its own, or the widest line's on the last line. */
  slotColumns: number;
  playheadColumn: number | null;
  chords: readonly ChordSpan[] | null;
  /** Index into `chords` of the one under the playhead; -1 for none. */
  currentChord: number;
  tuplets: readonly TupletGroup[];
  above: readonly BeatMark[];
  /** Pick strokes, when shown: their own row above the staff, like palm mute. */
  strokes: readonly BeatMark[];
  spans: readonly { label: string; spans: readonly MarkSpan[] }[];
  showBarLabels: boolean;
  onSeek?: (startTick: number) => void;
}

function TabSystem({
  systemIndex,
  bars,
  layouts,
  instrument,
  placed,
  size,
  rowHeight,
  fretSize,
  slotColumns,
  playheadColumn,
  chords,
  currentChord,
  tuplets,
  above,
  strokes,
  spans,
  showBarLabels,
  onSeek,
}: TabSystemProps) {
  const strings = stringCount(instrument);
  const firstColumn = bars[0]?.firstColumn ?? 0;
  const columnCount = bars.reduce((sum, b) => sum + b.columns, 0);
  const startTick = bars[0]?.startTick ?? 0;
  const endTick = bars[bars.length - 1]?.endTick ?? 0;

  const tickAt = (column: number) => tickAtColumn(layouts, column);
  const columns: LineColumns = {
    start: firstColumn,
    at: (tick) => columnAt(layouts, tick) - firstColumn,
    end: (tick) =>
      tick <= startTick ? 0 : columnAt(layouts, Math.min(tick, endTick) - 1) + 1 - firstColumn,
  };

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
  /** Where a local column edge sits, as CSS. */
  const edge = (column: number) =>
    `calc(${labelCol}px + (100% - ${labelCol}px) * ${column / slotColumns})`;

  const localPlayhead =
    playheadColumn !== null &&
    playheadColumn >= firstColumn &&
    playheadColumn < firstColumn + columnCount
      ? playheadColumn - firstColumn
      : null;

  const barEdges = bars.map((b) => b.firstColumn - firstColumn);
  const beatEdges = bars.flatMap((b) =>
    Array.from(
      { length: Math.ceil(b.columns / b.columnsPerBeat) },
      (_, j) => j * b.columnsPerBeat,
    )
      .filter((c) => c > 0 && c < b.columns && Number.isInteger(c))
      .map((c) => b.firstColumn - firstColumn + c),
  );
  const range = {
    startTick,
    endTick,
    columns,
    gridColumns,
    inset: fretSize * DIGIT_INSET,
    digitCentre: fretSize * DIGIT_CENTRE,
  };

  return (
    <div
      className={systemIndex > 0 ? 'mt-6' : undefined}
      data-testid={`tab-system-${systemIndex}`}
    >
      {bars.some((b) => b.bar.heading) && (
        <div
          style={{ display: 'grid', gridTemplateColumns: gridColumns }}
          className="pb-1"
          data-testid={`bar-headings-${systemIndex}`}
        >
          {bars.map((b) => (
            <span
              key={b.bar.index}
              data-testid={b.bar.heading ? `bar-heading-${b.bar.index}` : undefined}
              // Read first, so it is the boldest thing over the tab.
              className="truncate text-body font-bold text-ink"
              {...(b.bar.heading ? { title: b.bar.heading } : {})}
              style={{
                gridRow: 1,
                gridColumn: `${b.firstColumn - firstColumn + 2} / span ${b.columns}`,
              }}
            >
              {b.bar.heading}
            </span>
          ))}
        </div>
      )}
      {chords && (
        <ChordLane
          systemIndex={systemIndex}
          chords={chords}
          currentChord={localPlayhead === null ? -1 : currentChord}
          {...range}
        />
      )}
      <MarkLane systemIndex={systemIndex} marks={above} {...range} />
      <MarkLane systemIndex={systemIndex} marks={strokes} kind="pick-stroke" {...range} />
      {spans.map((lane) => (
        <SpanLane
          key={lane.label}
          systemIndex={systemIndex}
          label={lane.label}
          spans={lane.spans}
          {...range}
        />
      ))}
      <TupletLane systemIndex={systemIndex} tuplets={tuplets} {...range} />
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
              left: edge(localPlayhead),
              width: `calc((100% - ${labelCol}px) / ${slotColumns})`,
            }}
          />
        )}

        {/* A rule at the start and end of every bar, from the top string to
            the bottom one. Column edges, so it never runs through a number. */}
        {[...barEdges, columnCount].map((column, k) => (
          <div
            key={`bar-line-${k}`}
            data-testid="bar-line"
            aria-hidden
            className="pointer-events-none absolute w-[2px] bg-tab-bar"
            style={{
              top: rowHeight / 2,
              bottom: rowHeight / 2,
              left: edge(column),
              ...(k === bars.length ? { transform: 'translateX(-2px)' } : {}),
            }}
          />
        ))}

        {/* A fainter rule between the beats of a bar, so the count can be read
            off the tab: the notes carry no durations of their own. */}
        {beatEdges.map((column) => (
          <div
            key={`beat-line-${column}`}
            data-testid="beat-line"
            aria-hidden
            className="pointer-events-none absolute w-px bg-tab-beat"
            style={{ top: rowHeight / 2, bottom: rowHeight / 2, left: edge(column) }}
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
              placed={placed.get(stringIndex) ?? EMPTY_ROW}
              rowHeight={rowHeight}
              fretSize={fretSize}
              tickAt={tickAt}
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
          {bars.map(({ bar, firstColumn: first, columns: span }) => (
            // The number alone, in its own type, so it never reads as part of
            // the bar's own words — "Fret 5 · shape 2".
            <span
              key={bar.index}
              data-testid={`bar-label-${bar.index}`}
              className="truncate"
              style={{ gridRow: 1, gridColumn: `${first - firstColumn + 2} / span ${span}` }}
            >
              <span className="num text-meta font-extrabold">{bar.index + 1}</span>
              {bar.label !== undefined && <span className="kicker ml-2">{bar.label}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface LaneRange {
  systemIndex: number;
  startTick: number;
  endTick: number;
  columns: LineColumns;
  gridColumns: string;
  /** Pixels from a column's left edge to where its fret number starts. */
  inset: number;
  /** Pixels from a column's left edge to a single digit's centre. */
  digitCentre: number;
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
  columns,
  gridColumns,
}: LaneRange & { chords: readonly ChordSpan[]; currentChord: number }) {
  const labels = chords.flatMap((chord, index) => {
    const end = chord.startTick + chord.durationTicks;
    if (end <= startTick || chord.startTick >= endTick) return [];
    const carried = chord.startTick < startTick;
    const from = Math.max(chord.startTick, startTick);
    const column = columns.at(from);
    const span = Math.max(1, columns.end(end) - column);
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

/**
 * A bracket with its number — 3, 5, 6 — over each tuplet, the way notation
 * marks them. It runs from the first note's column to the last one's, so it
 * sits over the notes rather than the whole stretch. Only a line with tuplets
 * on it gets the lane.
 */
function TupletLane({
  systemIndex,
  tuplets,
  startTick,
  endTick,
  columns,
  gridColumns,
  digitCentre,
}: LaneRange & { tuplets: readonly TupletGroup[] }) {
  const here = tuplets.filter((t) => t.startTick >= startTick && t.startTick < endTick);
  if (here.length === 0) return null;

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: gridColumns }}
      className="pb-1"
      data-testid={`triplet-lane-${systemIndex}`}
    >
      {here.map((group) => {
        const first = columns.at(group.startTick);
        const span = Math.max(1, columns.end(group.startTick + group.durationTicks) - first);
        // From over the first note's digit to over the last one's: the last
        // note's column, as a fraction of the bracket's span, plus a digit.
        const lastTick =
          group.startTick + ((group.count - 1) * group.durationTicks) / group.count;
        const last = (columns.at(Math.round(lastTick)) - first) / span;
        return (
          <span
            key={`${group.startTick}:${group.count}`}
            data-testid="triplet-bracket"
            data-start-tick={group.startTick}
            data-count={group.count}
            aria-label={group.count === 3 ? 'Triplet' : `Tuplet of ${group.count}`}
            className="relative h-4"
            style={{ gridRow: 1, gridColumn: `${first + 2} / span ${span}` }}
          >
            <span
              aria-hidden
              className="absolute bottom-0 h-1.5 border-x border-t border-ink-muted"
              style={{
                left: digitCentre,
                right: `calc(${(1 - last) * 100}% - ${digitCentre}px)`,
              }}
            />
            <span
              aria-hidden
              className="num absolute -bottom-0.5 -translate-x-1/2 bg-paper px-1 text-body-sm leading-none font-semibold text-ink-muted italic"
              style={{ left: `calc(${(last / 2) * 100}% + ${digitCentre}px)` }}
            >
              {group.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const EMPTY_ROW = new Map<number, Placed>();

/**
 * The marks above the staff — an accent, a tap, a harmonic's kind, a bend's
 * amount — each over its note's column. Only a line with any gets the lane.
 */
function MarkLane({
  systemIndex,
  marks,
  startTick,
  endTick,
  columns,
  gridColumns,
  inset,
  kind = 'beat-mark',
}: LaneRange & { marks: readonly BeatMark[]; kind?: 'beat-mark' | 'pick-stroke' }) {
  const here = marks.filter((m) => m.startTick >= startTick && m.startTick < endTick);
  if (here.length === 0) return null;

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: gridColumns }}
      className="pb-0.5"
      data-testid={`${kind === 'beat-mark' ? 'mark' : kind}-lane-${systemIndex}`}
    >
      {here.map((mark) => (
        <span
          key={mark.startTick}
          data-testid={kind}
          data-start-tick={mark.startTick}
          // Over its note's fret number and free to run past the column: "full ½"
          // is wider than a sixteenth's column, and nothing else shares the lane.
          className="num flex justify-start text-caption font-semibold whitespace-nowrap text-accent-text"
          style={{
            gridRow: 1,
            gridColumn: `${columns.at(mark.startTick) + 2} / span 1`,
            paddingLeft: inset,
          }}
        >
          {mark.text}
        </span>
      ))}
    </div>
  );
}

/**
 * "P.M. - - -" or "let ring - - -" over a run of notes, drawn once instead of
 * on every note. A run carried over from the line before starts the line
 * again, label and all.
 */
function SpanLane({
  systemIndex,
  label,
  spans,
  startTick,
  endTick,
  columns,
  gridColumns,
}: LaneRange & { label: string; spans: readonly MarkSpan[] }) {
  const here = spans.flatMap((span) => {
    if (span.endTick <= startTick || span.startTick >= endTick) return [];
    const from = Math.max(span.startTick, startTick);
    const column = columns.at(from);
    const width = Math.max(1, columns.end(span.endTick) - column);
    return [{ key: span.startTick, column, width, ends: span.endTick <= endTick }];
  });
  if (here.length === 0) return null;

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: gridColumns }}
      className="pb-0.5"
      data-testid={`span-lane-${systemIndex}`}
    >
      {here.map(({ key, column, width, ends }) => (
        <span
          key={key}
          data-testid="mark-span"
          data-label={label}
          className="flex min-w-0 items-center gap-1 text-caption font-semibold whitespace-nowrap text-accent-text"
          style={{ gridRow: 1, gridColumn: `${column + 2} / span ${width}` }}
        >
          {label}
          <span
            aria-hidden
            className="h-0 min-w-2 flex-1 border-t border-dashed border-current"
          />
          {ends && <span aria-hidden className="h-2 w-0 border-l border-current" />}
        </span>
      ))}
    </div>
  );
}

function NoteChip({
  stringIndex,
  column,
  note,
  graces,
  fretSize,
}: {
  stringIndex: number;
  column: number;
  note: TabNote | undefined;
  graces: readonly TabNote[];
  fretSize: number;
}) {
  const marks = note && noteMarks(note);
  const glyph = (text: string, place: 'leading' | 'trailing') =>
    text && (
      <span
        data-testid={`${place}-${stringIndex}-${column}`}
        className={[
          place === 'leading' ? 'mr-[1px]' : 'ml-[1px]',
          'font-semibold text-accent-text',
        ].join(' ')}
        style={{ fontSize: fretSize * 0.72 }}
      >
        {text}
      </span>
    );

  // A tied note is the one before it still sounding: written small and muted
  // in parentheses, so a held note across a bar line doesn't read as silence.
  if (note?.tied) {
    return (
      <span
        data-testid={`tab-note-${stringIndex}-${column}`}
        data-fret={note.fret}
        data-tied
        className="num bg-paper px-[1px] leading-none font-semibold whitespace-nowrap text-ink-muted"
        style={{ fontSize: fretSize * 0.72 }}
      >
        ({note.display ?? note.fret})
      </span>
    );
  }

  const digit = marks && (marks.ghost ? `(${marks.digit})` : marks.digit);

  return (
    <span
      data-testid={`tab-note-${stringIndex}-${column}`}
      {...(note
        ? {
            'data-fret': note.fret,
            'data-role': note.role ?? 'none',
            'data-techniques': (note.techniques ?? []).join(' '),
          }
        : {})}
      className={[
        'num flex items-baseline whitespace-nowrap bg-paper px-[1px] leading-none [font-weight:var(--tab-digit-weight)]',
        note?.role === 'target' ? 'text-accent-text' : 'text-tab-digit',
      ].join(' ')}
      style={{ fontSize: fretSize }}
    >
      {graces.map((grace, i) => (
        <span
          key={i}
          data-testid={`grace-${stringIndex}-${column}`}
          className="mr-[1px] text-[0.62em]"
        >
          {noteMarks(grace).digit}
        </span>
      ))}
      {marks && glyph(marks.leading, 'leading')}
      {/* The root is circled, the way tab has always circled it. Only the fret
          number goes inside: a pick stroke or a technique describes how you
          play the note, not which note it is. Padding is in em so the ring
          holds its shape at every zoom step. */}
      {note?.role === 'root' ? (
        <span
          data-testid={`tab-root-ring-${stringIndex}-${column}`}
          className="rounded-full border border-tab-root px-[0.34em] py-[0.1em]"
        >
          {digit}
        </span>
      ) : (
        digit
      )}
      {marks && glyph(marks.trailing, 'trailing')}
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
  placed: Map<number, Placed>;
  rowHeight: number;
  fretSize: number;
  /** Where an absolute column starts, in ticks. */
  tickAt: (column: number) => number;
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
  tickAt,
  onSeek,
}: TabRowProps) {
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
        const here = placed.get(column);
        const note = here?.note;
        // An empty cell plays from where its column starts: the beat you clicked.
        const seekTick = note?.startTick ?? here?.graces[0]?.startTick ?? tickAt(column);
        const chip = here && (
          <NoteChip
            stringIndex={stringIndex}
            column={column}
            note={note}
            graces={here.graces}
            fretSize={fretSize}
          />
        );
        const cell = {
          height: rowHeight,
          paddingLeft: fretSize * DIGIT_INSET,
          ...lineBackground,
        };
        // The whole cell is the target, not the digit: a fret number is a few
        // pixels wide and this is clicked with a guitar in your hands.
        const sounding = note ?? here?.graces[0];
        return onSeek ? (
          <button
            key={column}
            type="button"
            // Out of the tab order on purpose: a phrase runs to hundreds of
            // notes, and tabbing through all of them to reach the transport
            // would be worse than the shortcut is worth. Everything this does
            // is on a hotkey already; the click is the pointer's way in.
            tabIndex={-1}
            className="grid cursor-pointer items-center justify-items-start hover:bg-ink/5"
            style={cell}
            onClick={() => onSeek(seekTick)}
            aria-label={
              sounding
                ? `Play from fret ${sounding.fret} on ${stringLabel(instrument, stringIndex)}`
                : 'Play from here'
            }
          >
            {chip}
          </button>
        ) : (
          <div key={column} className="grid items-center justify-items-start" style={cell}>
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
