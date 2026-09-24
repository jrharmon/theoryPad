import type { CompPattern } from './compTab';
import type { GeneratedBackingSettings } from './types';
import { compTab } from './compTab';

/**
 * How the generated backing's piano and bass play, written as tab. Edit a
 * line and it is heard on the next load; add a `compTab({ … })` to COMPS and
 * it appears as a style in the generated-backing settings.
 *
 *   PN piano, the whole chord:   g  ghost (soft)     x  hit     X  accent
 *   BS bass, one chord tone:     1 3 5 7    o  the root an octave up
 *   both:                        =  keep ringing     -  silence
 *
 * The samples fade within a few seconds, so a chord that should last is
 * struck again rather than held. The bass plays every note at one level.
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

const PULSE = compTab({
  id: 'pulse',
  name: 'Pulse',
  detail: 'Even eighths, the beats louder, over a root-and-fifth bass.',
  signature: '4/4',
  //    1   2   3   4
  tab: `
    PN |X=g=x=g=X=g=x=g=|
    BS |1===1===5===1===|
  `,
});

const STRUM = compTab({
  id: 'strum',
  name: 'Strum',
  detail: 'A pop strum that skips beat 3 and pushes its upbeat, over a 3-3-2 bass.',
  signature: '4/4',
  //    1   2   3   4
  tab: `
    PN |X=g=x=g=--x=x=gg|
    BS |1=====1=5=====5=|
  `,
});

const SWING = compTab({
  id: 'swing',
  name: 'Swing',
  detail: 'Every beat and its swung upbeat, 2 and 4 accented, over a walking 1–3–5–3.',
  signature: '4/4',
  //    1  2  3  4
  tab: `
    PN |x=gX=gx=gX=g|
    BS |1==3==5==3==|
  `,
});

export const COMPS: readonly CompPattern[] = [PULSE, STRUM, SWING];

/** The pattern saved under `id`, or the first one if it has gone. */
export function compById(id: string): CompPattern {
  return COMPS.find((c) => c.id === id) ?? COMPS[0]!;
}

/** What the generated backing plays when neither the exercise nor its definition says. */
export const DEFAULT_GENERATED_BACKING: GeneratedBackingSettings = {
  source: { kind: 'vamp' },
  style: COMPS[0]!.id,
  chords: 'sevenths',
};
