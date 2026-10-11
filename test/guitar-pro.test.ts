import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TabNote } from '@/domain/phrase';
import { EIGHTH, EIGHTH_TRIPLET, QUARTER, SIXTEENTH } from '@/domain/phrase';
import type { GpScore } from '@/domain/phrase/import';
import { importPhrase, playableTracks } from '@/domain/phrase/import';
import { readGuitarPro } from '@/import/guitar-pro';

/**
 * The player's own files, made for these tests (doc 16 §10). In test/ because
 * it reads the filesystem.
 */
const fixture = (name: string) =>
  readGuitarPro(new Uint8Array(readFileSync(`test/fixtures/guitar-pro/${name}.gp`)));

/** The whole file, first playable track. */
function importAll(score: GpScore) {
  const lastBar = score.masterBars.length - 1;
  const [track = 0] = playableTracks(score, 0, lastBar);
  const result = importPhrase(score, { track, firstBar: 0, lastBar });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

const at = (notes: TabNote[], tick: number) => notes.filter((n) => n.startTick === tick);
const marks = (n: TabNote | undefined) => n?.techniques ?? [];

describe('reading Guitar Pro files', () => {
  it('places every rhythm on its tick: dots, triplets, a sextuplet, chords and a tie', async () => {
    const { phrase, dropped, tuning } = importAll(await fixture('fixture1_rhythm'));
    const bar = (n: number) => (n - 1) * 4 * QUARTER;
    expect(tuning).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(phrase.writtenTempo).toBe(120);
    expect(phrase.bars).toHaveLength(7);

    // A dotted eighth and a sixteenth.
    expect(at(phrase.notes, bar(4))[0]!.durationTicks).toBe(EIGHTH + SIXTEENTH);
    expect(at(phrase.notes, bar(4) + EIGHTH + SIXTEENTH)).toHaveLength(1);
    // A two- and a three-note chord, open strings included.
    expect(at(phrase.notes, bar(5))).toHaveLength(2);
    expect(at(phrase.notes, bar(5) + 2 * QUARTER).map((n) => n.fret)).toEqual([2, 2, 1]);
    // Eighth triplets, sixteenth triplets and a sextuplet land exactly.
    expect(at(phrase.notes, bar(6) + EIGHTH_TRIPLET)).toHaveLength(1);
    expect(at(phrase.notes, bar(6) + QUARTER + 80)).toHaveLength(1);
    // The tie across the bar line continues the note before it.
    const tied = phrase.notes.filter((n) => n.tied);
    expect(tied).toHaveLength(1);
    expect(tied[0]!.startTick).toBe(bar(7));
    // Free text isn't shown, and is said to be left out.
    expect(dropped).toEqual(['text on 6 beats']);
  });

  it('turns slurs, slides, marks, harmonics, graces and bends into techniques', async () => {
    const legato = importAll(await fixture('fixture2_legato_slides')).phrase.notes;
    expect(legato.slice(0, 4).map(marks)).toEqual([[], ['hammer-on'], [], ['pull-off']]);
    expect(legato.flatMap(marks)).toEqual(
      expect.arrayContaining([
        'legato-slide-up',
        'legato-slide-down',
        'slide-up',
        'slide-in-below',
        'slide-in-above',
        'slide-out-up',
        'slide-out-down',
      ]),
    );

    const written = importAll(await fixture('fixture3_marks')).phrase.notes;
    expect(written.flatMap(marks)).toEqual(
      expect.arrayContaining([
        'palm-mute',
        'let-ring',
        'ghost',
        'dead',
        'accent',
        'staccato',
        'vibrato',
        'tap',
      ]),
    );
    expect(written.flatMap((n) => (n.harmonic ? [n.harmonic] : []))).toEqual([
      { kind: 'natural' },
      { kind: 'natural' },
      { kind: 'natural' },
      { kind: 'pinch', fret: 12 },
    ]);

    // Half, full and 1½; a bend and release; a pre-bend.
    const bends = importAll(await fixture('fixture4_bends')).phrase.notes.flatMap((n) =>
      n.bend ? [n.bend.points.map((p) => p.tones)] : [],
    );
    expect(bends.slice(0, 3).map((tones) => Math.max(...tones))).toEqual([0.5, 1, 1.5]);
    expect(bends[3]).toEqual([0, 1, 1, 0]);
    expect(bends[4]![0]).toBe(1);

    // A grace before the beat and one on it, each at its beat's tick; one
    // slides into its note. Then alternate picking.
    const grace = importAll(await fixture('fixture5_grace_picking')).phrase.notes;
    expect(at(grace, 0).map((n) => n.grace ?? 'main')).toEqual(['before-beat', 'main']);
    expect(at(grace, QUARTER)[0]!.grace).toBe('on-beat');
    expect(marks(at(grace, 2 * QUARTER)[1])).toEqual(['legato-slide-up']);
    expect(grace.slice(-4).map((n) => n.pickStroke)).toEqual(['down', 'up', 'down', 'up']);
  });

  it('writes out repeats and endings, and ignores a tempo change', async () => {
    const score = await fixture('fixture6_structure');
    const whole = importAll(score);
    expect(whole.phrase.bars).toHaveLength(20);
    expect(whole.phrase.bars.map((b) => b.label ?? '')).toEqual([
      'A Intro',
      '',
      '',
      '',
      'B',
      '',
      '',
      '',
      'Multi-Ending',
      '',
      '',
      'Multi-Ending · ×2',
      '',
      '',
      '3X Repeats',
      '',
      '3X Repeats · ×2',
      '',
      '3X Repeats · ×3',
      '',
    ]);
    expect(whole.phrase.writtenTempo).toBe(120);
    expect(whole.dropped).toEqual(['tempo change to 100 at bar 5 ignored']);
    expect(whole.name).toBe('A Intro');

    const intro = importPhrase(score, { track: 0, firstBar: 0, lastBar: 3 });
    expect(intro.ok && intro.value.dropped).toEqual([]);
    // From bar 5 on, the tempo there is the written one.
    const second = importPhrase(score, { track: 0, firstBar: 4, lastBar: 7 });
    expect(second.ok && second.value.phrase.writtenTempo).toBe(100);
  });

  it('offers only tracks with notes and strings, each in its own tuning', async () => {
    const score = await fixture('fixture7_tracks');
    expect(score.tracks.map((t) => t.capo)).toEqual([0, 0, 2, 0]);
    expect(score.tracks[3]!.tuning).toEqual([]); // drums
    expect(playableTracks(score, 0, 1)).toEqual([0, 1]);

    const seven = importPhrase(score, { track: 1, firstBar: 0, lastBar: 1 });
    expect(seven.ok && seven.value.tuning).toEqual(['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it('takes the key and a compound meter from the file', async () => {
    const { keyMode, phrase } = importAll(await fixture('fixture8_compound'));
    expect(keyMode).toEqual({ tonic: 'B', scale: 'major', mode: 'aeolian' });
    expect(phrase.timeSignature).toEqual({ beats: 6, unit: 8 });
    expect(phrase.totalTicks).toBe(4 * 6 * EIGHTH);
  });
});
