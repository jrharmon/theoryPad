import { useState } from 'react';
import { NewExercise } from './NewExercise';
import { WrittenImport } from './WrittenImport';
import { writtenSettings, type WrittenChoice } from './written';

/**
 * The new-exercise page, with each blueprint's own part of it: a written
 * exercise reads its notes from a file first, and starts at the tempo it was
 * written at.
 */
export function NewExerciseRoute() {
  const [written, setWritten] = useState<WrittenChoice | null>(null);
  return (
    <NewExercise
      setup={(definitionId) =>
        definitionId === 'phrase'
          ? {
              content: <WrittenImport onChange={setWritten} />,
              overrides: written
                ? {
                    ...writtenSettings(written),
                    tempo: {
                      targetTempo: written.imported.phrase.writtenTempo ?? 100,
                      maxTempo: null,
                    },
                  }
                : null,
              ...(written ? { suggestedName: written.imported.name } : {}),
            }
          : null
      }
    />
  );
}
