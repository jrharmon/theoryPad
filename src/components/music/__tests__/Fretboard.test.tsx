import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  it('renders one row per string, highest on top, whatever the instrument', () => {
    for (const instrument of TEST_INSTRUMENTS) {
      const { unmount } = render(
        <Fretboard instrument={instrument} overlay={overlayFor(instrument)} />,
      );
      const labels = screen.getAllByTestId(/^string-label-/);
      const strings = instrument.tuning.length;
      expect(labels, instrument.name).toHaveLength(strings);
      // Guitarist numbering: the first row rendered is string "1", the highest
      // pitched — which is the model's last index.
      expect(labels.map((el) => el.textContent), instrument.name).toEqual(
        Array.from({ length: strings }, (_, i) => String(i + 1)),
      );
      expect(labels[0], instrument.name).toHaveAttribute(
        'data-testid',
        `string-label-${strings - 1}`,
      );
      unmount();
    }
    expect(SEVEN_STRING_GUITAR.tuning).toHaveLength(7);
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

  it('labels dots with degrees, note names or nothing', () => {
    const { rerender } = render(<Fretboard instrument={STANDARD_GUITAR} overlay={overlayFor()} />);
    expect(screen.getByTestId('note-0-10')).toHaveTextContent('1');
    expect(screen.getByTestId('note-0-7')).toHaveTextContent('6');
    expect(screen.getByTestId('note-0-1')).toHaveTextContent('♭3');

    rerender(
      <Fretboard
        instrument={STANDARD_GUITAR}
        overlay={{ ...overlayFor(), labelMode: 'note' as const }}
      />,
    );
    expect(screen.getByTestId('note-0-10')).toHaveTextContent('D');
    expect(screen.getByTestId('note-0-1')).toHaveTextContent('F');

    rerender(
      <Fretboard
        instrument={STANDARD_GUITAR}
        overlay={{ ...overlayFor(), labelMode: 'none' as const }}
      />,
    );
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
    cleanup();

    // And never past the end of the neck, however wide the window.
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

});
