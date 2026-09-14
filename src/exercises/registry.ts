import type { AnyExerciseDefinition } from './types';
import { modesThroughKey } from './modes-through-key/definition';
import { intervalSequences } from './interval-sequences/definition';
import { oneNotePerString } from './one-note-per-string/definition';
import { positionShifting } from './position-shifting/definition';
import { diatonicDrill } from './diatonic-drill/definition';
import { circleOfFifths } from './circle-of-fifths/definition';
import { freeImprovTarget } from './free-improv-target/definition';

/**
 * Every exercise the app knows about.
 *
 * Registration is explicit rather than auto-discovered by import.meta.glob:
 * a glob hides the list, breaks tree-shaking, and makes it harder to see what
 * exists. A test asserts nothing under src/exercises is left unregistered.
 */
export const EXERCISE_DEFINITIONS: readonly AnyExerciseDefinition[] = [
  modesThroughKey,
  intervalSequences,
  oneNotePerString,
  positionShifting,
  diatonicDrill,
  circleOfFifths,
  freeImprovTarget,
];

const BY_ID = new Map(EXERCISE_DEFINITIONS.map((d) => [d.id, d]));

export function exerciseDefinition(id: string): AnyExerciseDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown exercise definition: ${id}`);
  return found;
}

export function findExerciseDefinition(id: string): AnyExerciseDefinition | undefined {
  return BY_ID.get(id);
}

/** Every tag actually in use, for the library's filter. */
export function allExerciseTags(): string[] {
  const tags = new Set<string>();
  for (const definition of EXERCISE_DEFINITIONS) {
    for (const tag of definition.tags) tags.add(tag);
  }
  return [...tags].sort();
}
