import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  BASS_4_STRING,
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
} from '@/domain/instrument';
import {
  EIGHTH,
  EIGHTH_TRIPLET,
  QUARTER,
  SIXTEENTH,
  phraseBuilder,
} from '@/domain/phrase';
import { TabStaff } from '../TabStaff';

const p = (string: number, fret: number) => ({ string, fret });

/** jsdom has no scrollIntoView; test/setup.ts installs a spy in its place. */
const scrollSpy = () =>
  // Reaching for the prototype is the point here — that is where the spy is.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  vi.mocked<() => void>(Element.prototype.scrollIntoView);

const FOUR_QUARTERS = phraseBuilder()
  .rhythm(QUARTER)
  .sequence([p(0, 3), p(0, 5), p(1, 3), p(1, 5)])
  .build();

/** A run of `count` notes on the low string, at one rhythm. */
const run = (ticks: number, count: number) =>
  phraseBuilder()
    .rhythm(ticks)
    .sequence(Array.from({ length: count }, (_, i) => p(0, i % 12)))
    .build();

describe('TabStaff', () => {
  it('draws one row per string, highest on top, whatever the instrument', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      const { unmount } = render(<TabStaff phrase={FOUR_QUARTERS} instrument={instrument} />);
      const labels = screen.getAllByTestId(/^tab-string-label-/);
      const strings = instrument.tuning.length;
      expect(labels, instrument.name).toHaveLength(strings);
      // Tab is written with string 1 — the highest — on top, so the model's
      // index order is reversed for display and never in the model.
      expect(labels.map((el) => el.textContent), instrument.name).toEqual(
        Array.from({ length: strings }, (_, i) => String(i + 1)),
      );
      expect(labels[0], instrument.name).toHaveAttribute(
        'data-testid',
        `tab-string-label-${strings - 1}`,
      );
      unmount();
    }
    expect(SEVEN_STRING_GUITAR.tuning).toHaveLength(7);
  });

  it('shows a note’s display text in place of its fret', () => {
    // Note-finding exercises write the note name; the fret would give it away.
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .note(p(3, 11), { display: 'F#' })
      .note(p(3, 5))
      .build();
    render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} />);
    expect(screen.getAllByTestId(/^tab-note-/).map((el) => el.textContent)).toEqual(['F#', '5']);
  });

  it('puts every note in the column its tick falls in, at any rhythm', () => {
    const quarters = render(
      <TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} subdivision={1} />,
    );
    // Quarter notes at subdivision 1: one column per beat, and the note's own
    // string keeps its row.
    expect(screen.getByTestId('tab-note-0-0')).toHaveAttribute('data-fret', '3');
    expect(screen.getByTestId('tab-note-0-1')).toHaveAttribute('data-fret', '5');
    expect(screen.getByTestId('tab-note-1-2')).toHaveAttribute('data-fret', '3');
    expect(screen.getByTestId('tab-note-1-3')).toHaveAttribute('data-fret', '5');
    quarters.unmount();

    // The grid is fine enough for the phrase: nothing collapses into a shared
    // column, whether the phrase is in eighths, triplets or sixteenths.
    for (const [rhythm, count, columnsPerBar] of [
      [EIGHTH, 4, 8],
      [EIGHTH_TRIPLET, 3, 12],
      [SIXTEENTH, 16, 16],
    ] as const) {
      const { unmount } = render(<TabStaff phrase={run(rhythm, count)} instrument={STANDARD_GUITAR} />);
      expect(screen.getAllByTestId(/^tab-note-0-/), String(rhythm)).toHaveLength(count);
      expect(screen.getByTestId('tab-staff')).toHaveAttribute(
        'data-columns',
        String(columnsPerBar),
      );
      unmount();
    }
  });

  it('handles an arbitrary bar count, not just four', () => {
    for (const bars of [1, 2, 3, 7]) {
      const { unmount } = render(
        <TabStaff phrase={run(QUARTER, bars * 4)} instrument={STANDARD_GUITAR} />,
      );
      expect(screen.getAllByTestId(/^bar-label-/), `${bars} bars`).toHaveLength(bars);
      unmount();
    }
  });

  it('labels bars, using a bar’s own label, unless labels are turned off', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([p(0, 1), p(0, 2), p(0, 3), p(0, 4)])
      .labelBar('Bar 2 · land on B')
      .sequence([p(0, 5), p(0, 6), p(0, 7), p(0, 8)])
      .build();
    const { rerender } = render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} />);
    expect(screen.getByTestId('bar-label-0')).toHaveTextContent('Bar 1');
    expect(screen.getByTestId('bar-label-1')).toHaveTextContent('Bar 2 · land on B');

    rerender(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} showBarLabels={false} />);
    expect(screen.queryByTestId(/^bar-labels/)).not.toBeInTheDocument();
  });

  it('shows the playhead only when given a tick', () => {
    const { rerender } = render(<TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} />);
    expect(screen.queryByTestId('playhead')).not.toBeInTheDocument();

    rerender(
      <TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} playheadTick={null} />,
    );
    expect(screen.queryByTestId('playhead')).not.toBeInTheDocument();
  });

  it('puts the playhead in the column and on the line the transport is at', () => {
    const eight = run(QUARTER, 32);
    const { rerender } = render(
      <TabStaff
        phrase={eight}
        instrument={STANDARD_GUITAR}
        barsPerSystem={4}
        playheadTick={QUARTER * 2}
      />,
    );
    expect(screen.getByTestId('playhead')).toHaveAttribute('data-column', '2');
    expect(screen.getByTestId('playhead')).toHaveAttribute('data-system', '0');

    rerender(
      <TabStaff
        phrase={eight}
        instrument={STANDARD_GUITAR}
        barsPerSystem={4}
        playheadTick={QUARTER * 18}
      />,
    );
    const playhead = screen.getByTestId('playhead');
    expect(playhead).toHaveAttribute('data-column', '18');
    expect(playhead).toHaveAttribute('data-system', '1');
  });

  it('wraps the playhead back over the notes on a repeat', () => {
    // A repeating phrase plays past its own length. Without wrapping, the
    // playhead vanished after the first pass while the audio kept going.
    const phrase = phraseBuilder({ repeat: 2 })
      .rhythm(QUARTER)
      .sequence([p(0, 3), p(0, 5), p(1, 3), p(1, 5)])
      .build();

    const { rerender } = render(
      <TabStaff phrase={phrase} instrument={STANDARD_GUITAR} subdivision={1} playheadTick={QUARTER} />,
    );
    expect(screen.getByTestId('playhead')).toHaveAttribute('data-column', '1');

    // One bar later is the second pass, back at the same place on screen.
    rerender(
      <TabStaff
        phrase={phrase}
        instrument={STANDARD_GUITAR}
        subdivision={1}
        playheadTick={QUARTER * 5}
      />,
    );
    expect(screen.getByTestId('playhead')).toHaveAttribute('data-column', '1');
  });

  it('marks the target note so it can be coloured', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .note(p(0, 3), { role: 'root' })
      .note(p(0, 5), { role: 'target' })
      .build();
    render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} subdivision={1} />);
    expect(screen.getByTestId('tab-note-0-0')).toHaveAttribute('data-role', 'root');
    expect(screen.getByTestId('tab-note-0-1')).toHaveAttribute('data-role', 'target');
  });

  it('writes articulation marks where tab writes them', () => {
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .note(p(0, 3))
      .note(p(0, 5), { articulation: 'hammer-on' })
      .note(p(0, 7), { articulation: 'pull-off' })
      .note(p(0, 9), { articulation: 'slide-up' })
      .note(p(0, 9), { articulation: 'vibrato' })
      .build();
    render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} subdivision={2} />);
    expect(screen.getByTestId('articulation-0-1')).toHaveTextContent('h');
    expect(screen.getByTestId('articulation-0-2')).toHaveTextContent('p');
    expect(screen.getByTestId('articulation-0-3')).toHaveTextContent('/');
    expect(screen.getByTestId('articulation-0-4')).toHaveTextContent('~');
    expect(screen.queryByTestId('articulation-0-0')).not.toBeInTheDocument();

    // A move into a note is written before it — 5h7, not 5 7h — and a mark
    // describing the note itself comes after it.
    expect(screen.getByTestId('tab-note-0-1')).toHaveTextContent('h5');
    expect(screen.getByTestId('tab-note-0-4')).toHaveTextContent('9~');
  });

  it('shows pick strokes only when asked', () => {
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .note(p(0, 3), { pickStroke: 'down' })
      .note(p(0, 5), { pickStroke: 'up' })
      .build();

    const { rerender } = render(
      <TabStaff phrase={phrase} instrument={STANDARD_GUITAR} subdivision={2} />,
    );
    expect(screen.getByTestId('tab-note-0-0')).toHaveTextContent('3');
    expect(screen.getByTestId('tab-note-0-0')).not.toHaveTextContent('⊓');

    rerender(
      <TabStaff
        phrase={phrase}
        instrument={STANDARD_GUITAR}
        subdivision={2}
        showPickStrokes
      />,
    );
    expect(screen.getByTestId('tab-note-0-0')).toHaveTextContent('⊓');
    expect(screen.getByTestId('tab-note-0-1')).toHaveTextContent('V');
  });

  it('renders a phrase with no notes', () => {
    const empty = phraseBuilder().rest(QUARTER * 4).build();
    render(<TabStaff phrase={empty} instrument={BASS_4_STRING} />);
    expect(screen.getByTestId('tab-staff')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^tab-note-/)).toHaveLength(0);
  });

  it('breaks long phrases onto lines, more of them the finer the rhythm', () => {
    // Real tab wraps into systems; generated exercise phrases get long enough
    // that one line would run off the page with no way to see the rest. The
    // finer the grid, the fewer bars fit before two-digit frets collide.
    for (const [phrase, systems] of [
      [FOUR_QUARTERS, 1],
      [run(EIGHTH, 48), 2], // 8 columns a bar: three bars a line, six bars
      [run(SIXTEENTH, 64), 4], // 16 columns a bar: one bar a line
    ] as const) {
      const { unmount } = render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} />);
      expect(screen.getByTestId('tab-staff')).toHaveAttribute('data-systems', String(systems));
      unmount();
    }

    render(<TabStaff phrase={run(QUARTER, 32)} instrument={STANDARD_GUITAR} barsPerSystem={4} />);
    expect(screen.getByTestId('tab-staff')).toHaveAttribute('data-systems', '2');
    // Every bar is still labelled across both lines, and a note keeps one
    // identity wherever it wraps to: bar 5 beat 1 is column 16, not column 0.
    expect(screen.getAllByTestId(/^bar-label-/)).toHaveLength(8);
    expect(screen.getByTestId('tab-note-0-16')).toBeInTheDocument();
    expect(screen.getByTestId('tab-note-0-31')).toBeInTheDocument();
  });

  it('scrolls the line being played into view once per line, unless told not to', () => {
    // You cannot scroll with a guitar in your hands. Scrolling on every frame
    // would fight the player, so it only moves when the line changes.
    const scroll = scrollSpy();
    scroll.mockClear();
    const eight = run(QUARTER, 32);

    const { rerender, unmount } = render(
      <TabStaff phrase={eight} instrument={STANDARD_GUITAR} barsPerSystem={4} playheadTick={0} />,
    );
    expect(scroll).toHaveBeenCalledTimes(1);

    // Still on line one: no further scrolling.
    rerender(
      <TabStaff
        phrase={eight}
        instrument={STANDARD_GUITAR}
        barsPerSystem={4}
        playheadTick={QUARTER * 5}
      />,
    );
    expect(scroll).toHaveBeenCalledTimes(1);

    // Onto line two.
    rerender(
      <TabStaff
        phrase={eight}
        instrument={STANDARD_GUITAR}
        barsPerSystem={4}
        playheadTick={QUARTER * 18}
      />,
    );
    expect(scroll).toHaveBeenCalledTimes(2);
    unmount();

    scroll.mockClear();
    render(
      <TabStaff
        phrase={FOUR_QUARTERS}
        instrument={STANDARD_GUITAR}
        playheadTick={0}
        autoScroll={false}
      />,
    );
    expect(scroll).not.toHaveBeenCalled();
  });
});
