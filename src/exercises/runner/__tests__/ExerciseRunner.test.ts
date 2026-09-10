import { describe, expect, it, vi } from 'vitest';
import { pitchClass } from '@/domain/music';
import { STANDARD_GUITAR } from '@/domain/instrument';
import { FakeClock } from '@/domain/time';
import { QUARTER, ticksPerBar } from '@/domain/phrase';
import { modesThroughKey } from '../../modes-through-key/definition';
import type { AnyExerciseDefinition } from '../../types';
import { ExerciseRunner, type RunnerConfig } from '../ExerciseRunner';

const D_DORIAN = { tonic: pitchClass('D'), mode: 'dorian' as const };

/** A tiny exercise, so a rep is one bar rather than twenty-one. */
const tinyExercise: AnyExerciseDefinition = {
  ...modesThroughKey,
  id: 'tiny',
  defaults: { ...modesThroughKey.defaults, params: { variant: 'plain', shapesPerRep: 1, minFret: 1 } },
};

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
    reps: 2,
    countInBars: 0,
    now: () => (time += 1_000),
    ...overrides,
  });
  return { runner, clock };
}

/** Run the current rep to its end. */
function playThrough(runner: ExerciseRunner, clock: FakeClock) {
  const phrase = runner.currentPhrase!;
  clock.advanceTicks(phrase.totalTicks * (phrase.repeat ?? 1) + QUARTER * 8);
}

describe('ExerciseRunner', () => {
  it('starts idle and does nothing until started', () => {
    const { runner, clock } = makeRunner();
    expect(runner.snapshot.state).toBe('idle');
    clock.start();
    clock.advanceTicks(QUARTER * 100);
    expect(runner.snapshot.state).toBe('idle');
  });

  it('rolls a variation and shows the brief', () => {
    const { runner } = makeRunner();
    runner.start();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.snapshot.variation).not.toBeNull();
    expect(runner.currentInstance?.kind).toBe('played');
  });

  it('never advances off the brief on its own', () => {
    // The player reads the whole rolled variation before anything moves.
    const { runner, clock } = makeRunner();
    runner.start();
    clock.start();
    clock.advanceTicks(QUARTER * 200);
    expect(runner.snapshot.state).toBe('brief');
  });

  it('plays when told to, and ends the rep at the end of the phrase', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    expect(runner.snapshot.state).toBe('playing');

    playThrough(runner, clock);
    // Two reps, so it moves to the next rather than finishing.
    expect(runner.completedReps).toHaveLength(1);
    expect(runner.snapshot.repIndex).toBe(1);
    expect(runner.snapshot.state).toBe('brief');
  });

  it('finishes after the configured number of reps', () => {
    const { runner, clock } = makeRunner({ reps: 3 });
    runner.start();
    for (let i = 0; i < 3; i += 1) {
      runner.begin();
      playThrough(runner, clock);
    }
    expect(runner.snapshot.state).toBe('done');
    expect(runner.completedReps).toHaveLength(3);
    expect(runner.completedReps.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('runs a whole exercise in no time at all', () => {
    // The point of driving everything from an injected clock.
    const { runner, clock } = makeRunner({ reps: 3, definition: modesThroughKey });
    runner.start();
    for (let i = 0; i < 3; i += 1) {
      runner.begin();
      playThrough(runner, clock);
    }
    expect(runner.snapshot.state).toBe('done');
  });

  it('rolls a fresh variation for each rep by default', () => {
    const { runner, clock } = makeRunner({ reps: 3 });
    const seeds: number[] = [];
    runner.start();
    for (let i = 0; i < 3; i += 1) {
      seeds.push(runner.snapshot.variation!.seed);
      runner.begin();
      playThrough(runner, clock);
    }
    expect(new Set(seeds).size).toBe(3);
  });

  it('keeps one variation for every rep when the exercise says so', () => {
    // Speed drills want repetition, not novelty.
    const perExercise = { ...tinyExercise, rerollPolicy: 'per-exercise' as const };
    const { runner, clock } = makeRunner({ definition: perExercise, reps: 3 });
    const seeds: number[] = [];
    runner.start();
    for (let i = 0; i < 3; i += 1) {
      seeds.push(runner.snapshot.variation!.seed);
      runner.begin();
      playThrough(runner, clock);
    }
    expect(new Set(seeds).size).toBe(1);
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
    const { runner, clock } = makeRunner({ countInBars: 2, reps: 1 });
    runner.start();
    runner.begin();
    const phrase = runner.currentPhrase!;
    const countIn = ticksPerBar(phrase.timeSignature) * 2;

    clock.advanceTicks(countIn + phrase.totalTicks - QUARTER);
    expect(runner.snapshot.state).toBe('playing');

    clock.advanceTicks(QUARTER);
    expect(runner.snapshot.state).toBe('done');
  });
});

describe('pause', () => {
  it('freezes everything, and resumes where it stopped', () => {
    const { runner, clock } = makeRunner();
    runner.start();
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
    const { runner, clock } = makeRunner({ freeTime: true, reps: 1 });
    runner.start();
    runner.begin();

    expect(runner.snapshot.state).toBe('playing');
    expect(runner.snapshot.currentTempo).toBeNull();
    expect(clock.state).toBe('stopped');

    clock.advanceTicks(QUARTER * 500);
    expect(runner.snapshot.state).toBe('playing');

    runner.completeRep();
    expect(runner.snapshot.state).toBe('done');
    expect(runner.completedReps[0]!.freeTime).toBe(true);
    expect(runner.completedReps[0]!.tempo).toBeNull();
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
    const { runner, clock } = makeRunner({ reps: 1 });
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

  it('resets to the target on the next rep', () => {
    const { runner, clock } = makeRunner({ reps: 2 });
    runner.start();
    runner.begin();
    runner.setTempo(120);
    playThrough(runner, clock);
    expect(runner.snapshot.currentTempo).toBe(76);
  });

  it('follows a ladder plan when one is set', () => {
    const { runner, clock } = makeRunner({
      reps: 3,
      tempoPlan: { kind: 'ladder', startPct: 0.85, stepBpm: 4, everyReps: 1 },
    });
    const tempos: (number | null)[] = [];
    runner.start();
    for (let i = 0; i < 3; i += 1) {
      tempos.push(runner.snapshot.currentTempo);
      runner.begin();
      playThrough(runner, clock);
    }
    expect(tempos).toEqual([65, 69, 73]);
  });
});

describe('rep records', () => {
  it('captures what was rolled and how it went', () => {
    const { runner, clock } = makeRunner({ reps: 1 });
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

  it('records a skip as skipped, and moves on', () => {
    const { runner } = makeRunner({ reps: 2 });
    runner.start();
    runner.begin();
    runner.skipRep();
    expect(runner.completedReps[0]!.status).toBe('skipped');
    expect(runner.snapshot.repIndex).toBe(1);
  });

  it('records an abandoned rep when the exercise is ended mid-play', () => {
    const { runner, clock } = makeRunner({ reps: 3 });
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER);
    runner.end();

    expect(runner.snapshot.state).toBe('done');
    expect(runner.completedReps).toHaveLength(1);
    expect(runner.completedReps[0]!.status).toBe('abandoned');
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
  it('re-rolls the current rep back to a brief', () => {
    const { runner, clock } = makeRunner();
    runner.start();
    runner.begin();
    clock.advanceTicks(QUARTER * 2);

    runner.reroll();
    expect(runner.snapshot.state).toBe('brief');
    expect(runner.snapshot.phraseTick).toBe(0);
    expect(runner.completedReps).toHaveLength(0);
  });

  it('carries a rep’s values forward, so the next roll knows what changed', () => {
    const { runner, clock } = makeRunner({ reps: 2 });
    runner.start();
    const firstKeys = runner.snapshot.variation!.axes;
    runner.begin();
    playThrough(runner, clock);

    const second = runner.snapshot.variation!;
    for (const axis of Object.values(second.axes)) {
      const before = firstKeys[axis.id];
      if (axis.source !== 'roll' || !before) continue;
      expect(axis.fresh).toBe(axis.key !== before.key);
    }
  });
});

describe('subscription', () => {
  it('notifies on every state change, and unsubscribes cleanly', () => {
    const { runner, clock } = makeRunner({ reps: 1 });
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

  it('leaves nothing scheduled once it is done', () => {
    const { runner, clock } = makeRunner({ reps: 1 });
    runner.start();
    runner.begin();
    playThrough(runner, clock);
    expect(clock.scheduledCount).toBe(0);
  });
});
