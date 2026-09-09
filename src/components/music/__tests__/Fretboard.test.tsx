import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pitchClass } from '@/domain/music';
import {
  BASS_4_STRING,
  SEVEN_STRING_GUITAR,
  STANDARD_GUITAR,
  TEST_INSTRUMENTS,
  scaleOnNeck,
} from '@/domain/instrument';
import { overlayFromScalePositions } from '@/domain/neck';
import { Fretboard } from '../Fretboard';

const D_DORIAN = { tonic: pitchClass('D'), mode: 'dorian' as const };

function overlayFor(instrument = STANDARD_GUITAR, range = { low: 0, high: 12 }) {
  return overlayFromScalePositions(scaleOnNeck(instrument, D_DORIAN, range), {
    targetDegree: { number: 6, alteration: 0, label: '6' },
  });
}

describe('Fretboard', () => {
  it('renders one row per string, however many the instrument has', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      const { unmount } = render(
        <Fretboard instrument={instrument} overlay={overlayFor(instrument)} />,
      );
      const labels = screen.getAllByTestId(/^string-label-/);
      expect(labels, instrument.name).toHaveLength(instrument.tuning.length);
      unmount();
    }
  });

  it('draws the highest string on top and the lowest at the bottom', () => {
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} />);
    const labels = screen.getAllByTestId(/^string-label-/);
    // Guitarist numbering: the first row rendered is string "1", the high e.
    expect(labels.map((el) => el.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    // And that first row is model string 5, the highest-pitched.
    expect(labels[0]).toHaveAttribute('data-testid', 'string-label-5');
    expect(labels[5]).toHaveAttribute('data-testid', 'string-label-0');
  });

  it('inverts correctly for a seven-string too', () => {
    render(<Fretboard instrument={SEVEN_STRING_GUITAR} overlay={overlayFor(SEVEN_STRING_GUITAR)} />);
    const labels = screen.getAllByTestId(/^string-label-/);
    expect(labels.map((el) => el.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(labels[0]).toHaveAttribute('data-testid', 'string-label-6');
  });

  it('places note dots at the right string and fret', () => {
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} />);
    // D dorian on the low E string: F at fret 1, G at 3, A at 5.
    expect(screen.getByTestId('note-0-1')).toBeInTheDocument();
    expect(screen.getByTestId('note-0-3')).toBeInTheDocument();
    expect(screen.getByTestId('note-0-5')).toBeInTheDocument();
    // C# is not in D dorian, so fret 9 on the low E string is empty.
    expect(screen.queryByTestId('note-0-9')).not.toBeInTheDocument();
  });

  it('marks roots, targets and other degrees differently', () => {
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} />);
    // D on the low E string is fret 10 — the root.
    expect(screen.getByTestId('note-0-10')).toHaveAttribute('data-role', 'root');
    // B at fret 7 is the 6th, the session target and dorian's signature note.
    expect(screen.getByTestId('note-0-7')).toHaveAttribute('data-role', 'target');
    // G at fret 3 is neither.
    expect(screen.getByTestId('note-0-3')).toHaveAttribute('data-role', 'chord-tone');
  });

  it('labels dots with scale degrees by default', () => {
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} />);
    expect(screen.getByTestId('note-0-10')).toHaveTextContent('1');
    expect(screen.getByTestId('note-0-7')).toHaveTextContent('6');
    expect(screen.getByTestId('note-0-1')).toHaveTextContent('♭3');
  });

  it('labels dots with note names when asked', () => {
    const overlay = { ...overlayFor(), labelMode: 'note' as const };
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlay} />);
    expect(screen.getByTestId('note-0-10')).toHaveTextContent('D');
    expect(screen.getByTestId('note-0-1')).toHaveTextContent('F');
  });

  it('renders no dot labels in "none" mode', () => {
    const overlay = { ...overlayFor(), labelMode: 'none' as const };
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlay} />);
    expect(screen.getByTestId('note-0-10')).toHaveTextContent('');
  });

  it('renders the requested fret window only', () => {
    render(
      <Fretboard
        instrument={STANDARD_GUITAR}
        overlay={overlayFor(STANDARD_GUITAR, { low: 5, high: 9 })}
        fretRange={{ low: 5, high: 9 }}
      />,
    );
    expect(screen.getByTestId('fret-number-5')).toBeInTheDocument();
    expect(screen.getByTestId('fret-number-9')).toBeInTheDocument();
    expect(screen.queryByTestId('fret-number-4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fret-number-10')).not.toBeInTheDocument();
  });

  it('never renders past the instrument’s fret count', () => {
    render(
      <Fretboard
        instrument={BASS_4_STRING}
        overlay={overlayFor(BASS_4_STRING)}
        fretRange={{ low: 0, high: 30 }}
      />,
    );
    expect(screen.getByTestId(`fret-number-${BASS_4_STRING.fretCount}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`fret-number-${BASS_4_STRING.fretCount + 1}`)).toBeNull();
  });

  it('emphasises the frets of the rolled position', () => {
    const overlay = { ...overlayFor(), emphasisFrets: [7, 8, 9, 10] };
    render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlay} />);
    expect(screen.getByTestId('fret-number-7').className).toContain('text-accent-700');
    expect(screen.getByTestId('fret-number-3').className).not.toContain('text-accent-700');
  });

  it('is not interactive unless a click handler is given', () => {
    const { rerender } = render(
      <Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    rerender(
      <Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} onFretClick={() => {}} />,
    );
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('reports the clicked position in model coordinates', async () => {
    const onFretClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Fretboard
        instrument={STANDARD_GUITAR}
        overlay={overlayFor()}
        onFretClick={onFretClick}
      />,
    );

    // The row labelled "6" is the low E string, model index 0.
    await user.click(screen.getByRole('button', { name: 'String 6, fret 5' }));
    expect(onFretClick).toHaveBeenCalledWith({ string: 0, fret: 5 });

    await user.click(screen.getByRole('button', { name: 'String 1, fret 3' }));
    expect(onFretClick).toHaveBeenLastCalledWith({ string: 5, fret: 3 });
  });

  it('renders larger at the large size', () => {
    const { rerender } = render(
      <Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} size="compact" />,
    );
    const compact = screen.getByTestId('note-0-3').getAttribute('style');
    rerender(<Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} size="large" />);
    const large = screen.getByTestId('note-0-3').getAttribute('style');
    expect(compact).not.toBe(large);
    expect(large).toContain('26px');
  });
});
