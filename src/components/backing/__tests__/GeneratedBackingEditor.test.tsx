import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GeneratedBackingSettings } from '@/domain/backing';
import { pitchClass } from '@/domain/music';
import { GeneratedBackingEditor } from '../GeneratedBackingEditor';

const TWO_FIVE_ONE: GeneratedBackingSettings = {
  source: {
    kind: 'custom',
    progressions: [
      [
        { degree: 2, bars: 1 },
        { degree: 5, bars: 1 },
        { degree: 1, bars: 1 },
      ],
    ],
  },
  style: 'pulse',
  chords: 'sevenths',
};

describe('GeneratedBackingEditor', () => {
  it('saves a custom list only once every line parses, leaving empty lines out', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GeneratedBackingEditor
        initial={TWO_FIVE_ONE}
        chordsIn={{ keyMode: { tonic: pitchClass('C'), mode: 'ionian' } }}
        onChange={onChange}
      />,
    );
    // Spelled in the key as it stands.
    expect(screen.getByText('Dm7 – G7 – Cmaj7')).toBeInTheDocument();

    // A new line starts empty; neither it nor a mistake in it is saved.
    await user.click(screen.getByRole('button', { name: 'Add a progression' }));
    const second = screen.getByLabelText('Progression 2', { exact: true });
    await user.type(second, '8');
    expect(screen.getByText(/isn’t a degree/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // Fixed, both lists go out, as degrees.
    await user.clear(second);
    await user.type(second, '4 5*2');
    expect(screen.getByText('Fmaj7 – G7 ×2')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      ...TWO_FIVE_ONE,
      source: {
        kind: 'custom',
        progressions: [
          [
            { degree: 2, bars: 1 },
            { degree: 5, bars: 1 },
            { degree: 1, bars: 1 },
          ],
          [
            { degree: 4, bars: 1 },
            { degree: 5, bars: 2 },
          ],
        ],
      },
    });
  });
});
