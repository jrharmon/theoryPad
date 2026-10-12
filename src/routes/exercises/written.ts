import type { KeyMode } from '@/domain/music';
import type { ImportedPhrase } from '@/domain/phrase/import';
import type { Exercise } from '@/data/entities';
import type { NewExercise } from '@/data/repositories/types';
import { tuningName } from '@/domain/instrument';
import type { PhraseSource } from '@/exercises/phrase/definition';
import { WRITTEN_PARAMS } from '@/exercises/phrase/definition';

/** What the import settles on: the notes, where they came from, and the key. */
export interface WrittenChoice {
  imported: ImportedPhrase;
  source: PhraseSource;
  keyMode: KeyMode;
}

/**
 * What a written exercise takes from its import. The notes and where they
 * came from are locked, so a routine item always reads the exercise's own;
 * they aren't settings, so no lock shows. The key is fixed and locked like
 * any locked axis, and can be changed on the exercise page.
 */
export function writtenSettings(choice: WrittenChoice): Partial<NewExercise> {
  const { imported, source, keyMode } = choice;
  return {
    params: { phrase: imported.phrase, source },
    tuning: { strings: imported.tuning, capo: imported.capo },
    axisPolicies: {
      scale: { mode: 'fixed', value: 'major' },
      mode: { mode: 'fixed', value: keyMode.mode },
      key: { mode: 'fixed', value: keyMode.tonic },
    },
    locked: { params: [...WRITTEN_PARAMS], axes: ['scale', 'mode', 'key'] },
  };
}

/**
 * Where a written exercise's notes came from, for its page: "Riff.gp · Lead ·
 * bars 5–12 · Drop C, capo 2". Null for any other exercise.
 */
export function writtenSource(exercise: Exercise): string | null {
  if (exercise.definitionId !== 'phrase') return null;
  const source = (exercise.params as { source?: PhraseSource } | undefined)?.source;
  if (!source) return 'No notes yet.';
  const bars =
    source.firstBar === source.lastBar
      ? `bar ${source.firstBar}`
      : `bars ${source.firstBar}–${source.lastBar}`;
  const tuning = exercise.tuning
    ? `${tuningName(exercise.tuning.strings)}${exercise.tuning.capo > 0 ? `, capo ${exercise.tuning.capo}` : ''}`
    : null;
  return [source.file, source.track, bars, tuning].filter(Boolean).join(' · ');
}
