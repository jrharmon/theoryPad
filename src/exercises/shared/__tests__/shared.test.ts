import { describe, expect, it } from 'vitest';
import { pitchClass } from '@/domain/music';
import { STANDARD_GUITAR, SEVEN_STRING_GUITAR, midiAt } from '@/domain/instrument';
import { QUARTER, phraseBuilder } from '@/domain/phrase';
import { rollVariation } from '@/domain/variation';
import { applyDirection, scaleRun, shapeRuns } from '../scaleRun';
import { noteOptionsFor, roleFor, signatureDegreeNumber } from '../roles';
import { overlayFromPhrase, overlayFromPositions, overlayFullScale } from '../overlay';
import { axisDisplay, keyModeLabel, ordinal, orderedHighlights, repsAndTempo } from '../brief';

const D_DORIAN = { tonic: pitchClass('D'), mode: 'dorian' as const };

describe('applyDirection', () => {
  const items = [1, 2, 3, 4];

  it('runs each way, turning without repeating the turning note', () => {
    expect(applyDirection(items, 'ascending')).toEqual([1, 2, 3, 4]);
    expect(applyDirection(items, 'descending')).toEqual([4, 3, 2, 1]);
    // 1 2 3 4 3 2 1, not 1 2 3 4 4 3 2 1 — a run should not stutter where it
    // changes direction.
    expect(applyDirection(items, 'up-down')).toEqual([1, 2, 3, 4, 3, 2, 1]);
    expect(applyDirection(items, 'down-up')).toEqual([4, 3, 2, 1, 2, 3, 4]);

    expect(applyDirection([1], 'up-down')).toEqual([1]);
    expect(applyDirection([], 'up-down')).toEqual([]);
    // The caller's array is never reordered under it.
    expect(items).toEqual([1, 2, 3, 4]);
  });
});

describe('scaleRun', () => {
  it('ascends in pitch', () => {
    const run = scaleRun({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
      minFret: 5,
    });
    for (let i = 1; i < run.length; i += 1) {
      expect(midiAt(STANDARD_GUITAR, run[i]!)).toBeGreaterThan(
        midiAt(STANDARD_GUITAR, run[i - 1]!),
      );
    }
  });

  it('turns around exactly once for up-down', () => {
    const run = scaleRun({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'up-down',
      minFret: 5,
    });
    let turns = 0;
    for (let i = 1; i < run.length; i += 1) {
      if (midiAt(STANDARD_GUITAR, run[i]!) < midiAt(STANDARD_GUITAR, run[i - 1]!)) {
        turns += 1;
        // Everything after the turn descends.
        for (let j = i + 1; j < run.length; j += 1) {
          expect(midiAt(STANDARD_GUITAR, run[j]!)).toBeLessThan(
            midiAt(STANDARD_GUITAR, run[j - 1]!),
          );
        }
        break;
      }
    }
    expect(turns).toBe(1);
  });

  it('respects a string subset', () => {
    const run = scaleRun({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
      minFret: 5,
      strings: [3, 4, 5],
    });
    expect(new Set(run.map((p) => p.string))).toEqual(new Set([3, 4, 5]));
  });
});

describe('shapeRuns', () => {
  it('gives seven shapes ascending the neck', () => {
    const runs = shapeRuns({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
    });
    expect(runs).toHaveLength(7);
    for (let i = 1; i < runs.length; i += 1) {
      expect(runs[i]!.startFret).toBeGreaterThan(runs[i - 1]!.startFret);
    }
  });

  it('applies the direction within each shape', () => {
    const up = shapeRuns({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
    });
    const down = shapeRuns({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'descending',
    });
    expect(down[0]!.positions).toEqual([...up[0]!.positions].reverse());
  });

  it('limits to a count', () => {
    const runs = shapeRuns({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
      count: 3,
    });
    expect(runs).toHaveLength(3);
  });

  it('works on a seven-string', () => {
    const runs = shapeRuns({
      instrument: SEVEN_STRING_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
    });
    expect(runs[0]!.positions).toHaveLength(21);
  });
});

describe('roles', () => {
  const positions = scaleRun({
    instrument: STANDARD_GUITAR,
    keyMode: D_DORIAN,
    direction: 'ascending',
    minFret: 5,
  });

  it('marks roots, targets and everything else', () => {
    const root = positions.find((p) => p.isRoot)!;
    const sixth = positions.find((p) => p.degree.number === 6)!;
    const other = positions.find((p) => p.degree.number === 2)!;

    expect(roleFor(root, 6)).toBe('root');
    expect(roleFor(sixth, 6)).toBe('target');
    expect(roleFor(other, 6)).toBe('none');
  });

  it('prefers root over target when they are the same note', () => {
    const root = positions.find((p) => p.isRoot)!;
    expect(roleFor(root, 1)).toBe('root');
  });

  it('annotates with the degree label', () => {
    const flatThird = positions.find((p) => p.degree.label === '♭3')!;
    expect(noteOptionsFor(flatThird, 6)).toEqual({ role: 'none', annotation: '♭3' });
  });

  it('knows each mode’s signature degree', () => {
    expect(signatureDegreeNumber(D_DORIAN)).toBe(6);
    expect(signatureDegreeNumber({ tonic: pitchClass('E'), mode: 'phrygian' })).toBe(2);
    expect(signatureDegreeNumber({ tonic: pitchClass('F'), mode: 'lydian' })).toBe(4);
  });
});

describe('overlays', () => {
  it('builds one from positions, marking roles', () => {
    const positions = scaleRun({
      instrument: STANDARD_GUITAR,
      keyMode: D_DORIAN,
      direction: 'ascending',
      minFret: 5,
    });
    const overlay = overlayFromPositions(positions, {
      targetDegree: 6,
      emphasisFrets: [5, 6, 7],
    });
    expect(overlay.notes.length).toBe(positions.length);
    expect(overlay.notes.some((n) => n.role === 'root')).toBe(true);
    expect(overlay.notes.some((n) => n.role === 'target')).toBe(true);
    expect(overlay.emphasisFrets).toEqual([5, 6, 7]);
  });

  it('derives one from a phrase, using the key to work out degrees', () => {
    // A phrase carries string and fret but not degree, so the key supplies it.
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([
        { string: 0, fret: 10 }, // D, the root
        { string: 0, fret: 7 }, // B, the 6th
      ])
      .build();

    const overlay = overlayFromPhrase(phrase, D_DORIAN, STANDARD_GUITAR, { targetDegree: 6 });
    expect(overlay.notes).toHaveLength(2);
    expect(overlay.notes[0]!.role).toBe('root');
    expect(overlay.notes[1]!.role).toBe('target');
  });

  it('draws each position once even when a phrase repeats it', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([
        { string: 0, fret: 10 },
        { string: 0, fret: 10 },
        { string: 0, fret: 10 },
      ])
      .build();
    expect(overlayFromPhrase(phrase, D_DORIAN, STANDARD_GUITAR).notes).toHaveLength(1);
  });

  it('skips notes that are outside the key', () => {
    const phrase = phraseBuilder()
      .rhythm(QUARTER)
      .sequence([
        { string: 0, fret: 10 }, // D
        { string: 0, fret: 9 }, // C#, not in D dorian
      ])
      .build();
    expect(overlayFromPhrase(phrase, D_DORIAN, STANDARD_GUITAR).notes).toHaveLength(1);
  });

  it('builds the whole scale across a range', () => {
    const overlay = overlayFullScale(D_DORIAN, STANDARD_GUITAR, { low: 0, high: 5 });
    for (const note of overlay.notes) {
      expect(note.position.fret).toBeLessThanOrEqual(5);
    }
    expect(overlay.notes.length).toBeGreaterThan(20);
  });
});

describe('brief helpers', () => {
  it('write a brief in words, not values', () => {
    expect(keyModeLabel(D_DORIAN)).toBe('D Dorian');
    expect(keyModeLabel({ tonic: pitchClass('Bb'), mode: 'mixolydian' })).toBe('Bb Mixolydian');
    expect(repsAndTempo(1, 76)).toBe('One pass at 76 bpm');
    expect(repsAndTempo(2, 76)).toBe('Two passes at 76 bpm');
    expect(repsAndTempo(3, null)).toBe('3 passes, in free time');
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
    ]);
  });

  it('reads an axis, with a fallback', () => {
    const variation = rollVariation({
      axes: ['direction'],
      seed: 1,
      instrument: STANDARD_GUITAR,
      policies: { direction: { mode: 'fixed', value: 'ascending' } },
    });
    expect(axisDisplay(variation, 'direction')).toBe('Ascending');
    expect(axisDisplay(variation, 'neckPosition', 'anywhere')).toBe('anywhere');
  });

  it('brings freshly rolled axes to the front of the strip', () => {
    const variation = rollVariation({
      axes: ['direction', 'neckPosition'],
      seed: 4,
      instrument: STANDARD_GUITAR,
      held: { direction: 'ascending', neckPosition: '3' },
    });
    const ordered = orderedHighlights(variation, ['direction', 'neckPosition']);
    const fresh = ordered.filter((id) => variation.axes[id]!.fresh);
    expect(ordered.slice(0, fresh.length)).toEqual(fresh);
  });

  it('drops axes the exercise did not roll', () => {
    const variation = rollVariation({
      axes: ['direction'],
      seed: 1,
      instrument: STANDARD_GUITAR,
    });
    expect(orderedHighlights(variation, ['direction', 'stringSet'])).toEqual(['direction']);
  });
});
