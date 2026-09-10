import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Repo-level invariants about the exercise registry. It lives in test/ rather
 * than src/ because it reads the filesystem, and src has no Node types on
 * purpose — app code must not reach for fs.
 */
import { EXERCISE_DEFINITIONS, allExerciseTags, exerciseDefinition } from '@/exercises/registry';
import { KNOWN_TAGS } from '@/exercises/types';

const EXERCISES_DIR = join(process.cwd(), 'src/exercises');
const MANIFEST = join(process.cwd(), 'src/exercises/exercise-ids.json');
const NOT_AN_EXERCISE = new Set(['shared', '__tests__']);

function exerciseDirectories(): string[] {
  return readdirSync(EXERCISES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_AN_EXERCISE.has(entry.name))
    .map((entry) => entry.name);
}

describe('the registry', () => {
  it('registers every exercise directory', () => {
    // Registration is explicit rather than globbed, so this is what stops a new
    // exercise from silently never appearing.
    const registered = new Set(EXERCISE_DEFINITIONS.map((d) => d.id));
    for (const directory of exerciseDirectories()) {
      expect(registered.has(directory), `${directory} is not in registry.ts`).toBe(true);
    }
  });

  it('names each definition after its directory', () => {
    const directories = new Set(exerciseDirectories());
    for (const definition of EXERCISE_DEFINITIONS) {
      expect(directories.has(definition.id), `no directory for ${definition.id}`).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = EXERCISE_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never drops or renames an id', () => {
    // Exercise ids are written into every rep, forever. Renaming one orphans
    // the history behind it, so the set may grow but must never lose a member.
    const current = EXERCISE_DEFINITIONS.map((d) => d.id).sort();

    if (!existsSync(MANIFEST)) {
      writeFileSync(MANIFEST, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }

    const known = JSON.parse(readFileSync(MANIFEST, 'utf8')) as string[];
    for (const id of known) {
      expect(current, `"${id}" was removed or renamed; rep history references it`).toContain(id);
    }

    if (current.length !== known.length) {
      writeFileSync(MANIFEST, `${JSON.stringify(current, null, 2)}\n`);
    }
  });

  it('uses only known tags', () => {
    const known = new Set<string>(KNOWN_TAGS);
    for (const definition of EXERCISE_DEFINITIONS) {
      expect(definition.tags.length).toBeGreaterThan(0);
      for (const tag of definition.tags) {
        expect(known.has(tag), `${definition.id} uses unknown tag "${tag}"`).toBe(true);
      }
    }
  });

  it('declares defaults consistent with its kind', () => {
    for (const definition of EXERCISE_DEFINITIONS) {
      expect(definition.defaults.reps).toBeGreaterThan(0);
      if (definition.kind === 'theory') {
        expect(definition.defaults.targetTempo, definition.id).toBeNull();
      }
    }
  });

  it('validates its own default params', () => {
    for (const definition of EXERCISE_DEFINITIONS) {
      if (!definition.params) continue;
      const result = definition.params.safeParse(definition.defaults.params ?? {});
      expect(result.success, `${definition.id} default params are invalid`).toBe(true);
    }
  });

  it('looks up by id and refuses an unknown one', () => {
    expect(exerciseDefinition('modes-through-key').name).toBe('Seven modes through a key');
    expect(() => exerciseDefinition('nope')).toThrow(/Unknown exercise/);
  });

  it('reports the tags in use, sorted and deduplicated', () => {
    const tags = allExerciseTags();
    expect(tags).toEqual([...tags].sort());
    expect(new Set(tags).size).toBe(tags.length);
  });
});
