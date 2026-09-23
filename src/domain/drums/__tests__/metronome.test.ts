import { describe, expect, it } from 'vitest';
import { FOUR_FOUR, SIX_EIGHT, THREE_FOUR } from '@/domain/phrase';
import { drumPatternFor, metronomeSounds } from '..';

describe('metronome voices', () => {
  it('play their own beat where it fits, Simple where it does not, and no beat for the click', () => {
    expect(drumPatternFor('drums-upbeat', FOUR_FOUR)?.id).toBe('upbeat');
    expect(drumPatternFor('drums-upbeat', THREE_FOUR)?.id).toBe('simple');
    expect(drumPatternFor('drums-heavy', SIX_EIGHT)?.id).toBe('simple');
    expect(drumPatternFor('drums-simple', SIX_EIGHT)?.id).toBe('simple');
    // A beat that has been retired, like Soft.
    expect(drumPatternFor('drums-soft', FOUR_FOUR)?.id).toBe('simple');
    expect(drumPatternFor('click', FOUR_FOUR)).toBeNull();
    expect(drumPatternFor('off', FOUR_FOUR)).toBeNull();
  });

  it('download only what they can play', () => {
    expect(metronomeSounds('off')).toEqual([]);
    expect(metronomeSounds('click')).toEqual(['stick']);
    // Heavy's own drums, Simple's ride for the fallback, the open hat to count in.
    expect(metronomeSounds('drums-heavy').sort()).toEqual(
      ['crash', 'hat-closed', 'hat-open', 'kick', 'ride', 'snare'].sort(),
    );
    expect(metronomeSounds('drums-simple')).not.toContain('stick');
  });
});
