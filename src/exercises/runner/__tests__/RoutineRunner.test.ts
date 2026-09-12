import { describe, expect, it, vi } from 'vitest';
import { STANDARD_GUITAR } from '@/domain/instrument';
import { FakeClock } from '@/domain/time';
import { QUARTER, ticksPerBar } from '@/domain/phrase';
import { modesThroughKey } from '../../modes-through-key/definition';
import { intervalSequences } from '../../interval-sequences/definition';
import type { AnyExerciseDefinition } from '../../types';
import { RoutineRunner, type RoutineRunItem, type RoutineRunnerConfig } from '../RoutineRunner';

const BAR = ticksPerBar({ beats: 4, unit: 4 });

/** Short items, so a pass is a bar or two rather than twenty-one. */
const tiny: AnyExerciseDefinition = {
  ...modesThroughKey,
  id: 'tiny',
  defaults: { ...modesThroughKey.defaults, params: { variant: 'plain', shapesPerRep: 1, minFret: 1 } },
};

function item(id: string, overrides: Partial<RoutineRunItem> = {}): RoutineRunItem {
  return {
    id,
    exerciseId: `exercise-${id}`,
    definition: tiny,
    reps: 1,
    params: { variant: 'plain', shapesPerRep: 1, minFret: 1 },
    tempo: { targetTempo: 80, maxTempo: null },
    axisPolicies: {},
    heldAxisValues: {},
    ...overrides,
  };
}

function makeRoutine(items: RoutineRunItem[], overrides: Partial<RoutineRunnerConfig> = {}) {
  const clock = new FakeClock(120);
  let time = 1_000;
  const routine = new RoutineRunner({
    clock,
    instrument: STANDARD_GUITAR,
    sessionId: 'session-1',
    items,
    countInBars: 0,
    now: () => (time += 1_000),
    ...overrides,
  });
  routine.open();
  return { routine, clock };
}

/** Exactly the rest of the current pass, count-in included. */
function playPass(routine: RoutineRunner, clock: FakeClock) {
  const runner = routine.current!;
  const phrase = runner.currentPhrase!;
  clock.advanceTicks(runner.snapshot.countInRemaining + phrase.totalTicks - runner.snapshot.phraseTick);
}

describe('RoutineRunner', () => {
  it('rolls everything up front, sharing one key and mode', () => {
    const { routine } = makeRoutine([item('a'), item('b'), item('c', { definition: intervalSequences, params: undefined })]);
    const { phase, items, keyMode } = routine.snapshot;
    expect(phase).toBe('overview');
    expect(items).toHaveLength(3);
    for (const it of items) {
      expect(it.instance).not.toBeNull();
      expect(it.variation!.axes.key!.key).toBe(keyMode.tonic);
      expect(it.variation!.axes.mode!.key).toBe(keyMode.mode);
    }
  });

  it('rolls two items copied from one exercise independently', () => {
    const { routine } = makeRoutine([item('a', { exerciseId: 'same' }), item('b', { exerciseId: 'same' })]);
    const [a, b] = routine.snapshot.items;
    expect(a!.variation!.seed).not.toBe(b!.variation!.seed);
  });

  it('plays through every item without being touched', () => {
    const onRepEnd = vi.fn();
    const { routine, clock } = makeRoutine(
      [item('a', { reps: 2 }), item('b'), item('c')],
      { onRepEnd },
    );
    routine.play();

    playPass(routine, clock);
    playPass(routine, clock);
    expect(routine.snapshot.index).toBe(1);
    // The next item counts in on the running clock — that is the only gap.
    expect(routine.current!.snapshot.state).toBe('count-in');

    playPass(routine, clock);
    playPass(routine, clock);
    expect(routine.snapshot.phase).toBe('done');
    expect(clock.state).toBe('stopped');

    const reps = onRepEnd.mock.calls.map((c) => c[0] as { routineItemId: string; exerciseId: string; status: string });
    expect(reps.map((r) => r.routineItemId)).toEqual(['a', 'a', 'b', 'c']);
    // Logged against the exercise each item was copied from.
    expect(reps[0]!.exerciseId).toBe('exercise-a');
    expect(reps.every((r) => r.status === 'completed')).toBe(true);
  });

  it('counts in a full bar between items even with count-in off, at the next item’s tempo', () => {
    const onRepStart = vi.fn();
    const { routine, clock } = makeRoutine(
      [item('a'), item('b', { tempo: { targetTempo: 100, maxTempo: null } })],
      { onRepStart },
    );
    routine.play();
    playPass(routine, clock);

    expect(clock.bpm).toBe(100);
    const next = onRepStart.mock.calls[1]![0] as { continuation: boolean; countInFrom: number; countInTicks: number };
    expect(next.continuation).toBe(true);
    expect(next.countInTicks - next.countInFrom).toBe(BAR);
  });

  it('skips to the next item, counting it in if something was playing', () => {
    const onRepEnd = vi.fn();
    const { routine, clock } = makeRoutine([item('a'), item('b')], { onRepEnd });
    routine.play();
    clock.advanceTicks(QUARTER);
    routine.skip();

    expect(onRepEnd.mock.calls[0]![0]).toMatchObject({ status: 'skipped', routineItemId: 'a' });
    expect(routine.snapshot.index).toBe(1);
    expect(routine.current!.snapshot.state).toBe('count-in');
  });

  it('skipping while nothing plays leaves the next item waiting', () => {
    const { routine } = makeRoutine([item('a'), item('b')]);
    routine.play();
    routine.rerollCurrent(); // stops, back to ready
    routine.skip();
    expect(routine.snapshot.index).toBe(1);
    expect(routine.current!.snapshot.state).toBe('brief');
  });

  it('stays on the current item while looping, and moves on when it stops', () => {
    const { routine, clock } = makeRoutine([item('a'), item('b')], { loop: true });
    routine.play();
    for (let i = 0; i < 3; i += 1) playPass(routine, clock);
    expect(routine.snapshot.index).toBe(0);

    routine.setLoop(false);
    playPass(routine, clock);
    expect(routine.snapshot.index).toBe(1);
  });

  it('re-rolls everything on the overview, key and mode included', () => {
    const { routine } = makeRoutine([item('a'), item('b')]);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      seen.add(`${routine.snapshot.keyMode.tonic} ${routine.snapshot.keyMode.mode}`);
      routine.rerollAll();
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('re-rolls one item without touching the routine’s key', () => {
    const { routine } = makeRoutine([item('a'), item('b')]);
    const key = routine.snapshot.keyMode.tonic;
    const before = routine.snapshot.items[1]!.variation!.seed;
    routine.rerollItem(1);
    expect(routine.snapshot.items[1]!.variation!.seed).not.toBe(before);
    expect(routine.snapshot.items[1]!.variation!.axes.key!.key).toBe(key);
    expect(routine.snapshot.keyMode.tonic).toBe(key);
  });

  it('honours the routine’s key policy', () => {
    const { routine } = makeRoutine([item('a')], {
      sessionAxisPolicies: { key: { mode: 'fixed', value: 'G' }, mode: { mode: 'fixed', value: 'dorian' } },
    });
    expect(routine.snapshot.keyMode).toMatchObject({ tonic: 'G', mode: 'dorian' });
  });

  it('logs an abandoned pass when left, and does not start the next item', () => {
    const onRepEnd = vi.fn();
    const { routine, clock } = makeRoutine([item('a'), item('b')], { onRepEnd });
    routine.play();
    clock.advanceTicks(QUARTER);
    routine.end();
    expect(onRepEnd.mock.calls.map((c) => (c[0] as { status: string }).status)).toEqual(['abandoned']);
    expect(routine.snapshot.index).toBe(0);
    expect(clock.state).toBe('stopped');
  });
});
