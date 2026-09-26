import { describe, expect, it, vi } from 'vitest';
import { pitchClass } from '@/domain/music';
import { STANDARD_GUITAR } from '@/domain/instrument';
import { FakeClock } from '@/domain/time';
import { QUARTER, ticksPerBar } from '@/domain/phrase';
import { modesThroughKey } from '../../modes-through-key/definition';
import { diatonicDrill } from '../../diatonic-drill/definition';
import type { AnyExerciseDefinition } from '../../types';
import { ExerciseRunner, type RunnerConfig } from '../ExerciseRunner';

const D_DORIAN = { tonic: pitchClass('D'), scale: 'major' as const, mode: 'dorian' as const };

/** A tiny exercise, so a rep is one bar rather than twenty-one. */
const tinyExercise: AnyExerciseDefinition = { ...modesThroughKey, id: 'tiny' };

function makeRunner(overrides: Partial<RunnerConfig> = {}) {
  const clock = new FakeClock(120);
  let time = 1_000;
  const runner = new ExerciseRunner({
    clock,
    definition: tinyExercise,
    exerciseId: 'exercise-1',
    instrument: STANDARD_GUITAR,
    sessionId: 'session-1',
    sessionKeyMode: D_DORIAN,
    params: { variant: 'plain', shapesPerRep: 1, minFret: 1 },
    tempo: { targetTempo: 76, maxTempo: null },
    countInBars: 0,
    now: () => (time += 1_000),
    ...overrides,
  });
  return { runner, clock };
}

/** Run the current pass to its end, and a little past it. */
function playThrough(runner: ExerciseRunner, clock: FakeClock) {
  const phrase = runner.currentPhrase!;
  clock.advanceTicks(phrase.totalTicks * (phrase.repeat ?? 1) + QUARTER * 8);
}

/** Exactly one pass, count-in included — for loops, where overshooting plays into the next. */
function playPass(runner: ExerciseRunner, clock: FakeClock) {
  const phrase = runner.currentPhrase!;
  clock.advanceTicks(
    runner.snapshot.countInRemaining + phrase.totalTicks * (phrase.repeat ?? 1),
  );
}

describe('ExerciseRunner', () => {
  it('times the whole run, not the pass, and Stop puts the clock back', () => {
    const { runner, clock } = makeRunner({ countInBars: 1, passes: 2 });
    runner.start();
    const phrase = runner.currentPhrase!;
    const pass = phrase.totalTicks * (phrase.repeat ?? 1);
    const countIn = ticksPerBar(phrase.timeSignature);

    // Nothing played yet, and the count-in is not playing either.
    expect(runner.snapshot.runTicks).toBe(0);
    runner.begin();
    clock.advanceTicks(countIn - QUARTER);
    expect(runner.snapshot).toMatchObject({ state: 'count-in', runTicks: 0 });

    clock.advanceTicks(QUARTER + QUARTER * 2);
    expect(runner.snapshot.runTicks).toBe(QUARTER * 2);

    // The second pass runs straight on, so the run keeps counting through it
    // rather than starting again with the phrase.
    clock.advanceTicks(pass);
    expect(runner.snapshot).toMatchObject({ state: 'playing', phraseTick: QUARTER * 2 });
    expect(runner.snapshot.runTicks).toBe(pass + QUARTER * 2);

    runner.stop();
    expect(runner.snapshot).toMatchObject({ state: 'brief', runTicks: 0 });
  });

  it('moves the playhead to a clicked note, playing or paused, and still ends the pass there', () => {
    const { runner, clock } = makeRunner({ countInBars: 1 });
    runner.start();
    const phrase = runner.currentPhrase!;
    const countIn = ticksPerBar(phrase.timeSignature);
    runner.begin();

    // Not during the count-in: a click does not skip it.
    runner.seekTo(QUARTER * 4);
    expect(runner.snapshot).toMatchObject({ state: 'count-in', phraseTick: 0 });

    clock.advanceTicks(countIn + QUARTER * 6);
    expect(runner.snapshot.phraseTick).toBe(QUARTER * 6);

    // Back to a note already played; the pass carries on from there.
    runner.seekTo(QUARTER * 2);
    expect(runner.snapshot).toMatchObject({ state: 'playing', phraseTick: QUARTER * 2 });
    expect(runner.completedReps).toHaveLength(0);

    // Paused, it waits where it was put.
    runner.pause();
    runner.seekTo(QUARTER);
    expect(runner.snapshot).toMatchObject({ state: 'paused', phraseTick: QUARTER });
    runner.resume();

    // Past the end lands on the last tick of the phrase, not on the end of it,
    // so the pass is played out rather than finished by the click.
    runner.seekTo(phrase.totalTicks * 4);
    expect(runner.completedReps).toHaveLength(0);
    expect(runner.snapshot.phraseTick).toBe(phrase.totalTicks - 1);
    clock.advanceTicks(QUARTER * 4);
    expect(runner.completedReps).toHaveLength(1);
  });

  it('waits at the brief, plays when told to, and comes back ready', () => {
    const { runner, clock } = makeRunner();
    // Idle until started, and the player reads the whole rolled variation
    // before anything moves: a running clock alone changes nothing.
    expect(runner.snapshot.state).toBe('idle');
    clock.start();
    clock.advanceTicks(QUARTER * 100);
    expect(runner.snapshot.state).toBe('idle');

    runner.start();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.snapshot.variation).not.toBeNull();
    expect(runner.currentInstance?.kind).toBe('played');
    clock.advanceTicks(QUARTER * 200);
    expect(runner.snapshot.state).toBe('brief');

    runner.begin();
    expect(runner.snapshot.state).toBe('playing');

    playThrough(runner, clock);
    expect(runner.completedReps).toHaveLength(1);
    expect(runner.snapshot.passesPlayed).toBe(1);
    // Standalone practice has no end: it is ready to play the same thing again.
    expect(runner.snapshot.state).toBe('brief');
  });

  it('never re-rolls on its own, however often it is played', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    const seed = runner.snapshot.variation!.seed;
    for (let i = 0; i < 3; i += 1) {
      runner.begin();
      playThrough(runner, clock);
    }
    expect(runner.completedReps.map((r) => r.seed)).toEqual([seed, seed, seed]);
    expect(runner.completedReps.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('loops the same material until told to stop, then finishes the pass', () => {
    const { runner, clock } = makeRunner({ loop: true });
    runner.start();
    runner.begin();
    for (let i = 0; i < 3; i += 1) playPass(runner, clock);
    expect(runner.snapshot.state).toBe('playing');
    expect(runner.completedReps).toHaveLength(3);

    runner.setLoop(false);
    playPass(runner, clock);
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.completedReps).toHaveLength(4);
    expect(new Set(runner.completedReps.map((r) => r.seed)).size).toBe(1);
  });

  it('keeps the clock running between looped passes, so the beat never slips', () => {
    const { runner, clock } = makeRunner({ loop: true });
    runner.start();
    runner.begin();
    const length = runner.currentPhrase!.totalTicks;
    playPass(runner, clock);
    clock.advanceTicks(QUARTER);
    expect(clock.ticks).toBe(length + QUARTER);
    expect(runner.snapshot.phraseTick).toBe(QUARTER);
  });

  it('plays a routine item’s passes back to back, counting them, then finishes', () => {
    const { runner, clock } = makeRunner({ passes: 3, endWhenFinished: true });
    runner.start();
    runner.begin();
    // What the transport reads out: the pass under way is passesThisRun + 1.
    expect(runner.snapshot.passesThisRun).toBe(0);
    for (let i = 0; i < 3; i += 1) {
      playPass(runner, clock);
      expect(runner.snapshot.passesThisRun).toBe(i + 1);
    }
    expect(runner.snapshot.passes).toBe(3);
    expect(runner.snapshot.state).toBe('done');
    expect(runner.completedReps).toHaveLength(3);
  });

  it('is deterministic in the session and exercise ids', () => {
    const first = makeRunner();
    first.runner.start();
    const second = makeRunner();
    second.runner.start();
    expect(second.runner.snapshot.variation!.seed).toBe(first.runner.snapshot.variation!.seed);
  });
});

describe('count-in', () => {
  it('counts in before the phrase, and the playhead only starts after it', () => {
    const { runner, clock } = makeRunner({ countInBars: 1 });
    runner.start();
    runner.begin();

    expect(runner.snapshot.state).toBe('count-in');
    expect(runner.snapshot.countInRemaining).toBe(ticksPerBar({ beats: 4, unit: 4 }));
    expect(runner.snapshot.phraseTick).toBe(0);

    clock.advanceTicks(QUARTER * 2);
    expect(runner.snapshot.state).toBe('count-in');
    expect(runner.snapshot.phraseTick).toBe(0);

    clock.advanceTicks(QUARTER * 2);
    expect(runner.snapshot.state).toBe('playing');
    expect(runner.snapshot.countInRemaining).toBe(0);

    clock.advanceTicks(QUARTER);
    expect(runner.snapshot.phraseTick).toBe(QUARTER);
  });

  it('skips straight to playing when there is no count-in', () => {
    const { runner } = makeRunner({ countInBars: 0 });
    runner.start();
    runner.begin();
    expect(runner.snapshot.state).toBe('playing');
  });

  it('gives the phrase its full length after the count-in', () => {
    const { runner, clock } = makeRunner({ countInBars: 2 });
    runner.start();
    runner.begin();
    const phrase = runner.currentPhrase!;
    const countIn = ticksPerBar(phrase.timeSignature) * 2;

    clock.advanceTicks(countIn + phrase.totalTicks - QUARTER);
    expect(runner.snapshot.state).toBe('playing');

    clock.advanceTicks(QUARTER);
    expect(runner.snapshot.state).toBe('brief');
  });

  it('counts in for half a bar, on the beat', () => {
    const { runner, clock } = makeRunner({ countInBars: 0.5 });
    runner.start();
    runner.begin();
    expect(runner.snapshot.countInRemaining).toBe(QUARTER * 2);
    clock.advanceTicks(QUARTER * 2);
    expect(runner.snapshot.state).toBe('playing');
  });
});

describe('stop', () => {
  it('goes back to the top with the same variation, logging the pass as abandoned', () => {
    const { runner, clock } = makeRunner({ countInBars: 1 });
    runner.start();
    const seed = runner.snapshot.variation!.seed;
    runner.begin();
    clock.advanceTicks(QUARTER * 6);
    runner.stop();

    expect(runner.snapshot.state).toBe('brief');
    expect(runner.snapshot.variation!.seed).toBe(seed);
    expect(runner.completedReps.map((r) => r.status)).toEqual(['abandoned']);
    // Nothing left scheduled: the pass does not finish on its own later.
    clock.advanceTicks(QUARTER * 400);
    expect(runner.completedReps).toHaveLength(1);

    // And Play starts from the top again, counted in.
    runner.begin();
    expect(runner.snapshot.state).toBe('count-in');
    expect(runner.snapshot.phraseTick).toBe(0);
  });

  it('logs nothing when stopped inside the count-in', () => {
    const { runner, clock } = makeRunner({ countInBars: 1 });
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.stop();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.pause();
    runner.stop();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.completedReps).toHaveLength(0);
    expect(runner.snapshot.passesPlayed).toBe(0);
  });

  it('stops from pause too, and does nothing from the brief', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.stop();
    expect(runner.completedReps).toHaveLength(0);
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.pause();
    runner.stop();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.completedReps).toHaveLength(1);
  });
});

describe('pause', () => {
  it('freezes everything, and resumes where it stopped', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    // Nothing to freeze at the brief.
    runner.pause();
    expect(runner.snapshot.state).toBe('brief');
    runner.begin();
    clock.advanceTicks(QUARTER * 2);

    runner.pause();
    const at = runner.snapshot.phraseTick;
    clock.advanceTicks(QUARTER * 100);

    expect(runner.snapshot.state).toBe('paused');
    expect(runner.snapshot.phraseTick).toBe(at);
    expect(runner.completedReps).toHaveLength(0);

    runner.resume();
    clock.advanceTicks(QUARTER);
    expect(runner.snapshot.state).toBe('playing');
    expect(runner.snapshot.phraseTick).toBe(at + QUARTER);
  });

  it('comes back to the count-in when paused during it', () => {
    const { runner, clock } = makeRunner({ countInBars: 1 });
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.pause();
    runner.resume();
    expect(runner.snapshot.state).toBe('count-in');
  });

  it('ignores pause outside of playing', () => {
    const { runner } = makeRunner();
    runner.start();
    runner.pause();
    expect(runner.snapshot.state).toBe('brief');
  });
});

describe('free time', () => {
  it('never starts the clock, and waits for the player', () => {
    const { runner, clock } = makeRunner({ freeTime: true });
    runner.start();
    runner.begin();

    expect(runner.snapshot.state).toBe('playing');
    expect(runner.snapshot.currentTempo).toBeNull();
    expect(clock.state).toBe('stopped');

    clock.advanceTicks(QUARTER * 500);
    expect(runner.snapshot.state).toBe('playing');

    runner.completeRep();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.completedReps[0]!.freeTime).toBe(true);
    expect(runner.completedReps[0]!.tempo).toBeNull();
  });

  it('plays every rep a routine item asks for, one per Done', () => {
    // Free time has no clock to end a pass, so each rep waits for the player.
    const { runner } = makeRunner({ freeTime: true, passes: 3, endWhenFinished: true });
    runner.start();
    runner.begin();
    runner.completeRep();
    expect(runner.snapshot.state).toBe('playing');
    runner.completeRep();
    expect(runner.snapshot.state).toBe('playing');
    runner.completeRep();
    expect(runner.snapshot.state).toBe('done');
    expect(runner.completedReps).toHaveLength(3);
  });

  it('is forced on for an exercise with no pulse', () => {
    const freeOnly = { ...tinyExercise, timing: 'free' as const };
    const { runner } = makeRunner({ definition: freeOnly, freeTime: false });
    runner.start();
    expect(runner.snapshot.freeTime).toBe(true);
  });

  it('is refused for an exercise that needs a click', () => {
    const metered = { ...tinyExercise, timing: 'metronome' as const };
    const { runner } = makeRunner({ definition: metered, freeTime: true });
    runner.start();
    expect(runner.snapshot.freeTime).toBe(false);
    expect(runner.snapshot.currentTempo).toBe(76);
  });
});

describe('tempo', () => {
  it('starts at the configured target', () => {
    const { runner } = makeRunner();
    runner.start();
    expect(runner.snapshot.currentTempo).toBe(76);
  });

  it('moves the working tempo without touching the target', () => {
    // The whole point of the tempo model: raising the configured tempo is
    // always a separate, explicit action.
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();

    runner.setTempo(96);
    expect(runner.snapshot.currentTempo).toBe(96);
    expect(runner.snapshot.targetTempo).toBe(76);
    expect(clock.bpm).toBe(96);

    runner.nudgeTempo(-6);
    expect(runner.snapshot.currentTempo).toBe(90);
    expect(runner.snapshot.targetTempo).toBe(76);
  });

  it('logs the tempo actually used, not the target', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    runner.setTempo(92);
    playThrough(runner, clock);
    expect(runner.completedReps[0]!.tempo).toBe(92);
  });

  it('clamps to sane bounds', () => {
    const { runner } = makeRunner();
    runner.start();
    runner.setTempo(5);
    expect(runner.snapshot.currentTempo).toBe(30);
    runner.setTempo(9999);
    expect(runner.snapshot.currentTempo).toBe(300);
  });

  it('keeps the working tempo from pass to pass, and through a re-roll', () => {
    // You are working at a tempo; playing again or asking for new material
    // should not throw it away.
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    runner.setTempo(120);
    playThrough(runner, clock);
    expect(runner.snapshot.currentTempo).toBe(120);
    runner.reroll();
    expect(runner.snapshot.currentTempo).toBe(120);
  });
});

describe('rep records', () => {
  it('captures what was rolled and how it went', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    const variation = runner.snapshot.variation!;
    runner.begin();
    playThrough(runner, clock);

    const rep = runner.completedReps[0]!;
    expect(rep).toMatchObject({
      exerciseId: 'exercise-1',
      definitionId: 'tiny',
      index: 0,
      status: 'completed',
      seed: variation.seed,
    });
    expect(rep.axes.key).toBeDefined();
    expect(rep.endedAt).toBeGreaterThan(rep.startedAt);
  });

  it('counts every note a finished pass played, by string and fret', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    const phrase = runner.currentPhrase!;
    runner.begin();
    playThrough(runner, clock);

    const frets = runner.completedReps[0]!.frets!;
    expect(frets.strings).toBe(runner.snapshot.instrument.tuning.length);
    const played = Object.values(frets.counts).reduce((a, b) => a + b, 0);
    expect(played).toBe(phrase.notes.filter((n) => !n.tied).length * (phrase.repeat ?? 1));
  });

  it('records an abandoned pass when the exercise is left mid-play', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.end();

    expect(runner.snapshot.state).toBe('done');
    expect(runner.completedReps).toHaveLength(1);
    expect(runner.completedReps[0]!.status).toBe('abandoned');
    // Not every note was played, so none of them count.
    expect(runner.completedReps[0]!.frets).toBeUndefined();
  });

  it('records nothing when ended from the brief', () => {
    const { runner } = makeRunner();
    runner.start();
    runner.end();
    expect(runner.completedReps).toHaveLength(0);
    expect(runner.snapshot.state).toBe('done');
  });
});

describe('re-roll and hold', () => {
  it('re-rolls back to ready, logging the pass it cut short', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER * 2);

    runner.reroll();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.completedReps.map((r) => r.status)).toEqual(['abandoned']);
  });

  it('actually produces a different variation', () => {
    // The seed is (session, exercise, rep), so without counting attempts a
    // re-roll regenerated exactly what was there and the button did nothing.
    const { runner } = makeRunner();
    runner.start();
    const seeds = [runner.snapshot.variation!.seed];
    for (let i = 0; i < 5; i += 1) {
      runner.reroll();
      seeds.push(runner.snapshot.variation!.seed);
    }
    expect(new Set(seeds).size).toBe(6);
  });

  it('releases a held axis, because a re-roll is asking for something new', () => {
    const { runner } = makeRunner({
      definition: { ...tinyExercise, axes: ['direction'] },
      axisPolicies: { direction: { mode: 'hold' } },
      heldAxisValues: { direction: 'descending' },
    });

    runner.start();
    expect(runner.snapshot.variation!.axes.direction!.key).toBe('descending');
    expect(runner.snapshot.variation!.axes.direction!.source).toBe('hold');

    // A hold that can never be released is a trap, so re-rolling breaks it.
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      runner.reroll();
      seen.add(runner.snapshot.variation!.axes.direction!.key);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('highlights what a re-roll changed', () => {
    const { runner } = makeRunner();
    runner.start();
    const before = runner.snapshot.variation!;
    runner.reroll();
    const after = runner.snapshot.variation!;
    for (const axis of Object.values(after.axes)) {
      if (axis.source !== 'roll') continue;
      expect(axis.fresh, axis.id).toBe(axis.key !== before.axes[axis.id]!.key);
    }
  });
});

describe('reconfigure', () => {
  it('rolls again only the axis whose policy changed', () => {
    const { runner } = makeRunner();
    runner.start();
    const before = runner.snapshot.variation!;

    runner.reconfigure({ axisPolicies: { key: { mode: 'fixed', value: 'G' } } });
    const after = runner.snapshot.variation!;
    expect(after.axes.key!.key).toBe('G');
    for (const id of ['mode', 'direction', 'rhythmPattern'] as const) {
      expect(after.axes[id]!.key, id).toBe(before.axes[id]!.key);
      // Kept, and shown as it was — not suddenly "fixed".
      expect(after.axes[id]!.source, id).toBe(before.axes[id]!.source);
    }
    expect(runner.currentInstance!.brief.headline).toContain('G ');
  });

  it('regenerates with new params and keeps the variation', () => {
    const { runner } = makeRunner();
    runner.start();
    const seed = runner.snapshot.variation!.seed;
    const notesBefore = (runner.currentPhrase?.notes ?? []).length;
    runner.reconfigure({ params: { variant: 'plain', shapesPerRep: 2, minFret: 1 } });
    expect(runner.snapshot.variation!.seed).toBe(seed);
    expect(runner.currentPhrase!.notes.length).toBeGreaterThan(notesBefore);
  });

  it('moves the working tempo when the target changes', () => {
    const { runner } = makeRunner();
    runner.start();
    runner.reconfigure({ tempo: { targetTempo: 100, maxTempo: null } });
    expect(runner.snapshot.currentTempo).toBe(100);
  });

  it('stops anything playing, logging the unfinished pass, and waits', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.reconfigure({ tempo: { targetTempo: 90, maxTempo: null } });
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.completedReps[0]!.status).toBe('abandoned');
  });
});

describe('key and mode', () => {
  it('generates in the key the exercise rolled, not the session fallback', () => {
    // The exercise declares key and mode axes, so what it rolls wins. Passing
    // the session key here produced a brief that named one key while the axis
    // strip showed another.
    const { runner } = makeRunner();
    runner.start();
    const rolled = runner.snapshot.variation!;
    expect(runner.snapshot.keyMode.tonic).toBe(rolled.axes.key!.key);
    expect(runner.snapshot.keyMode.mode).toBe(rolled.axes.mode!.key);
    expect(runner.currentInstance!.brief.headline).toContain(rolled.axes.key!.display);
  });

  it('falls back to the session key when the exercise rolls none', () => {
    const noKey = { ...tinyExercise, axes: ['direction'] as never };
    const { runner } = makeRunner({ definition: noKey });
    runner.start();
    expect(runner.snapshot.keyMode).toEqual(D_DORIAN);
  });
});

describe('lifecycle hooks', () => {
  it('announces a rep before the clock starts, so sound can be arranged', () => {
    const onRepStart = vi.fn();
    const { runner } = makeRunner({ countInBars: 1, onRepStart });
    runner.start();
    runner.begin();

    expect(onRepStart).toHaveBeenCalledTimes(1);
    const info = onRepStart.mock.calls[0]![0] as { countInTicks: number; tempo: number | null };
    // The phrase has to be scheduled after the count-in, not at zero.
    expect(info.countInTicks).toBe(ticksPerBar({ beats: 4, unit: 4 }));
    expect(info.tempo).toBe(76);
  });

  it('reports free time so the caller knows not to start a metronome', () => {
    const onRepStart = vi.fn();
    const { runner } = makeRunner({ freeTime: true, onRepStart });
    runner.start();
    runner.begin();
    expect(onRepStart.mock.calls[0]![0]).toMatchObject({ freeTime: true, tempo: null });
  });

  it('hands each pass over as it ends, so it can be persisted', () => {
    const onRepEnd = vi.fn();
    const { runner, clock } = makeRunner({ onRepEnd });
    runner.start();
    runner.begin();
    playThrough(runner, clock);
    expect(onRepEnd).toHaveBeenCalledTimes(1);
    expect(onRepEnd.mock.calls[0]![0]).toMatchObject({ index: 0, status: 'completed' });

    runner.begin();
    playThrough(runner, clock);
    expect(onRepEnd).toHaveBeenCalledTimes(2);
  });

  it('reports an abandoned pass too', () => {
    const onRepEnd = vi.fn();
    const { runner, clock } = makeRunner({ onRepEnd });
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.end();
    expect(onRepEnd.mock.calls[0]![0]).toMatchObject({ status: 'abandoned' });
  });

  it('counts in before the first pass of a loop only, and says the next is a continuation', () => {
    const onRepStart = vi.fn();
    const { runner, clock } = makeRunner({ loop: true, countInBars: 1, onRepStart });
    runner.start();
    runner.begin();
    playPass(runner, clock);

    const [first, second] = onRepStart.mock.calls.map(
      (c) => c[0] as { continuation: boolean; countInTicks: number },
    );
    const bar = ticksPerBar({ beats: 4, unit: 4 });
    expect(first).toMatchObject({ continuation: false, countInTicks: bar });
    // Straight on from where the first pass ended.
    expect(second).toMatchObject({
      continuation: true,
      countInTicks: bar + runner.currentPhrase!.totalTicks,
    });
  });
});

describe('subscription', () => {
  it('notifies on every state change, and unsubscribes cleanly', () => {
    const { runner, clock } = makeRunner();
    const listener = vi.fn();
    const off = runner.subscribe(listener);

    runner.start();
    runner.begin();
    expect(listener).toHaveBeenCalled();

    const before = listener.mock.calls.length;
    off();
    playThrough(runner, clock);
    expect(listener.mock.calls.length).toBe(before);
  });

  it('leaves nothing scheduled once a pass is over', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    playThrough(runner, clock);
    expect(clock.scheduledCount).toBe(0);
  });
});

describe('theory', () => {
  const theory = (overrides: Partial<RunnerConfig> = {}) =>
    makeRunner({
      definition: diatonicDrill,
      params: diatonicDrill.params!.parse({}),
      tempo: { targetTempo: null, maxTempo: null },
      ...overrides,
    });
  const answers = (n: number, right: number) =>
    Array.from({ length: n }, (_, i) => ({ subject: 'D Dorian', correct: i < right }));

  it('runs a set with no clock and no tempo', () => {
    const { runner, clock } = theory();
    runner.start();
    expect(runner.snapshot.currentTempo).toBeNull();
    runner.begin();
    expect(runner.snapshot.state).toBe('playing');
    expect(clock.state).toBe('stopped');
    // Nothing to pause.
    runner.pause();
    expect(runner.snapshot.state).toBe('playing');
  });

  it('logs a submitted set with its score and what each question was about', () => {
    const onRepEnd = vi.fn();
    const { runner } = theory({ onRepEnd });
    runner.start();
    runner.begin();
    runner.submitSet({ answers: answers(8, 6) });

    expect(onRepEnd.mock.calls[0]![0]).toMatchObject({
      status: 'completed',
      score: { correct: 6, total: 8 },
      answers: expect.arrayContaining([{ subject: 'D Dorian', correct: false }]) as unknown,
    });
    expect(runner.snapshot.lastSet).toMatchObject({ correct: 6, total: 8 });
    expect(runner.snapshot.state).toBe('brief');
  });

  it('has fresh questions for the next set, in the same key', () => {
    const { runner } = theory();
    runner.start();
    const before = runner.currentInstance;
    const key = runner.snapshot.variation!.axes.key!.key;
    runner.begin();
    runner.submitSet({ answers: answers(8, 8) });
    expect(JSON.stringify(runner.currentInstance)).not.toBe(JSON.stringify(before));
    expect(runner.snapshot.variation!.axes.key!.key).toBe(key);
  });

  it('hands the drill its leanings, every set', () => {
    // Loaded from recent answers but never passed on, the weights once did nothing.
    const generate = vi.fn((context: Parameters<typeof diatonicDrill.generate>[0]) =>
      diatonicDrill.generate(context),
    );
    const subjectWeights = { 'key:Eb': 3 };
    const { runner } = theory({ definition: { ...diatonicDrill, generate }, subjectWeights });
    runner.start();
    runner.begin();
    runner.submitSet({ answers: answers(8, 8) });
    expect(generate).toHaveBeenCalledTimes(2);
    for (const [context] of generate.mock.calls)
      expect(context.subjectWeights).toEqual(subjectWeights);
  });

  it('plays a routine’s passes as consecutive sets, then finishes, ignoring loop', () => {
    const { runner } = theory({ passes: 2, endWhenFinished: true, loop: true });
    runner.start();
    runner.begin();
    runner.submitSet({ answers: answers(8, 8) });
    expect(runner.snapshot.state).toBe('playing');
    runner.submitSet({ answers: answers(8, 8) });
    expect(runner.snapshot.state).toBe('done');
  });
});
