import { describe, expect, it } from 'vitest';
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

const FOUR_QUARTERS = phraseBuilder()
  .rhythm(QUARTER)
  .sequence([p(0, 3), p(0, 5), p(1, 3), p(1, 5)])
  .build();

describe('TabStaff', () => {
  it('renders one row per string, however many the instrument has', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      const { unmount } = render(<TabStaff phrase={FOUR_QUARTERS} instrument={instrument} />);
      expect(screen.getAllByTestId(/^tab-string-label-/), instrument.name).toHaveLength(
        instrument.tuning.length,
      );
      unmount();
    }
  });

  it('draws the highest string on top, matching how tab is written', () => {
    render(<TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} />);
    const labels = screen.getAllByTestId(/^tab-string-label-/);
    expect(labels.map((el) => el.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(labels[0]).toHaveAttribute('data-testid', 'tab-string-label-5');
    expect(labels[5]).toHaveAttribute('data-testid', 'tab-string-label-0');
  });

  it('inverts correctly on a seven-string', () => {
    render(<TabStaff phrase={FOUR_QUARTERS} instrument={SEVEN_STRING_GUITAR} />);
    const labels = screen.getAllByTestId(/^tab-string-label-/);
    expect(labels).toHaveLength(7);
    expect(labels[0]).toHaveAttribute('data-testid', 'tab-string-label-6');
  });

  it('places notes in the column their tick falls in', () => {
    render(<TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} subdivision={1} />);
    // Quarter notes at subdivision 1: one column per beat.
    expect(screen.getByTestId('tab-note-0-0')).toHaveAttribute('data-fret', '3');
    expect(screen.getByTestId('tab-note-0-1')).toHaveAttribute('data-fret', '5');
    expect(screen.getByTestId('tab-note-1-2')).toHaveAttribute('data-fret', '3');
    expect(screen.getByTestId('tab-note-1-3')).toHaveAttribute('data-fret', '5');
  });

  it('spaces columns by the phrase’s subdivision', () => {
    const eighths = phraseBuilder()
      .rhythm(EIGHTH)
      .sequence([p(0, 3), p(0, 5), p(0, 7), p(0, 8)])
      .build();
    render(<TabStaff phrase={eighths} instrument={STANDARD_GUITAR} />);
    // Eighths need a resolution of 2, so a 4/4 bar is eight columns.
    expect(screen.getByTestId('tab-staff')).toHaveAttribute('data-columns', '8');
    expect(screen.getByTestId('tab-note-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('tab-note-0-1')).toBeInTheDocument();
  });

  it('chooses a grid fine enough for triplets rather than dropping them', () => {
    const triplets = phraseBuilder()
      .rhythm(EIGHTH_TRIPLET)
      .sequence([p(0, 3), p(0, 5), p(0, 7)])
      .build();
    render(<TabStaff phrase={triplets} instrument={STANDARD_GUITAR} />);
    // Every note is rendered; none silently collapses into the same column.
    expect(screen.getByTestId('tab-note-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('tab-note-0-1')).toBeInTheDocument();
    expect(screen.getByTestId('tab-note-0-2')).toBeInTheDocument();
  });

  it('renders every note of a sixteenth-note run', () => {
    const positions = Array.from({ length: 16 }, (_, i) => p(0, i % 12));
    const run = phraseBuilder().rhythm(SIXTEENTH).sequence(positions).build();
    render(<TabStaff phrase={run} instrument={STANDARD_GUITAR} />);
    expect(screen.getAllByTestId(/^tab-note-0-/)).toHaveLength(16);
  });

  it('handles an arbitrary bar count, not just four', () => {
    for (const bars of [1, 2, 3, 7]) {
      const phrase = phraseBuilder()
        .rhythm(QUARTER)
        .sequence(Array.from({ length: bars * 4 }, (_, i) => p(0, i % 12)))
        .build();
      const { unmount } = render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} />);
      expect(screen.getAllByTestId(/^bar-label-/), `${bars} bars`).toHaveLength(bars);
      unmount();
    }
  });

  it('uses a bar’s own label when it has one', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([p(0, 1), p(0, 2), p(0, 3), p(0, 4)])
      .labelBar('Bar 2 · land on B')
      .sequence([p(0, 5), p(0, 6), p(0, 7), p(0, 8)])
      .build();
    render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} />);
    expect(screen.getByTestId('bar-label-0')).toHaveTextContent('Bar 1');
    expect(screen.getByTestId('bar-label-1')).toHaveTextContent('Bar 2 · land on B');
  });

  it('hides bar labels when asked', () => {
    render(
      <TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} showBarLabels={false} />,
    );
    expect(screen.queryByTestId('bar-labels')).not.toBeInTheDocument();
  });

  it('hides the playhead by default', () => {
    render(<TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} />);
    expect(screen.queryByTestId('playhead')).not.toBeInTheDocument();
  });

  it('puts the playhead in the column matching the transport tick', () => {
    const { rerender } = render(
      <TabStaff
        phrase={FOUR_QUARTERS}
        instrument={STANDARD_GUITAR}
        subdivision={1}
        playheadTick={0}
      />,
    );
    expect(screen.getByTestId('playhead')).toHaveAttribute('data-column', '0');

    rerender(
      <TabStaff
        phrase={FOUR_QUARTERS}
        instrument={STANDARD_GUITAR}
        subdivision={1}
        playheadTick={QUARTER * 2}
      />,
    );
    expect(screen.getByTestId('playhead')).toHaveAttribute('data-column', '2');
  });

  it('hides the playhead once the transport runs past the phrase', () => {
    render(
      <TabStaff
        phrase={FOUR_QUARTERS}
        instrument={STANDARD_GUITAR}
        subdivision={1}
        playheadTick={QUARTER * 99}
      />,
    );
    expect(screen.queryByTestId('playhead')).not.toBeInTheDocument();
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

  it('shows articulation marks', () => {
    const phrase = phraseBuilder()
      .rhythm(EIGHTH)
      .note(p(0, 3))
      .note(p(0, 5), { articulation: 'hammer-on' })
      .note(p(0, 7), { articulation: 'pull-off' })
      .note(p(0, 9), { articulation: 'slide-up' })
      .build();
    render(<TabStaff phrase={phrase} instrument={STANDARD_GUITAR} subdivision={2} />);
    expect(screen.getByTestId('articulation-0-1')).toHaveTextContent('h');
    expect(screen.getByTestId('articulation-0-2')).toHaveTextContent('p');
    expect(screen.getByTestId('articulation-0-3')).toHaveTextContent('/');
    expect(screen.queryByTestId('articulation-0-0')).not.toBeInTheDocument();
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

  it('renders bigger at the large size', () => {
    const { rerender } = render(
      <TabStaff phrase={FOUR_QUARTERS} instrument={STANDARD_GUITAR} subdivision={1} />,
    );
    const compact = screen.getByTestId('tab-note-0-0').getAttribute('style');
    rerender(
      <TabStaff
        phrase={FOUR_QUARTERS}
        instrument={STANDARD_GUITAR}
        subdivision={1}
        size="large"
      />,
    );
    expect(screen.getByTestId('tab-note-0-0').getAttribute('style')).not.toBe(compact);
  });
});
