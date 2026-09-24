import type { CompPattern } from './compTab';
import { compTab } from './compTab';

/**
 * How the generated backing's piano and bass play, written as tab. Edit a
 * line and it is heard on the next load; add a `compTab({ … })` to COMPS and
 * it appears as a style in the generated-backing settings.
 *
 *   PN piano, the whole chord:   x  hit     X  accent
 *   BS bass, one chord tone:     1 3 5 7    o  the root an octave up
 *   both:                        =  keep ringing     -  silence
 *
 * A line per instrument, `|` between bars; both lines have the same bars, and
 * within a bar the same number of cells. In 4/4, 16 cells to a bar are
 * sixteenths, 12 are eighth triplets (swing), 8 are eighths. The pattern
 * loops from the pass's bar 1 over whatever chord is sounding; when the chord
 * changes, a ringing note moves to the new chord. With triads on, a 7 in the
 * bass plays the root an octave up.
 *
 * Keep `id` once it has shipped: settings save it. The first pattern is the
 * default.
 */

const PAD = compTab({
  id: 'pad',
  name: 'Pad',
  detail: 'The chord held for the bar over its root.',
  signature: '4/4',
  //    1   2   3   4
  tab: `
    PN |X===============|
    BS |1===============|
  `,
});

const STRAIGHT = compTab({
  id: 'straight',
  name: 'Straight',
  detail: 'Chords on the beats, the bass on root and fifth.',
  signature: '4/4',
  //    1   2   3   4
  tab: `
    PN |X==-x==-X==-x==-|
    BS |1===5===1===5===|
  `,
});

const SWING = compTab({
  id: 'swing',
  name: 'Swing',
  detail: 'A Charleston comp over a walking 1–3–5–3.',
  signature: '4/4',
  //    1  2  3  4
  tab: `
    PN |X=---x====--|
    BS |1==3==5==3==|
  `,
});

export const COMPS: readonly CompPattern[] = [PAD, STRAIGHT, SWING];

/** The pattern saved under `id`, or the first one if it has gone. */
export function compById(id: string): CompPattern {
  return COMPS.find((c) => c.id === id) ?? COMPS[0]!;
}
