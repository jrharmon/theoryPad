import type { DegreeNumber, KeyMode } from '../../music';
import { progressionsFor } from '../../music';
import type { Rng } from '../../variation';
import type { GeneratedBackingSettings, Progression } from './types';

const VAMP: Progression = [{ degree: 1, bars: 1 }];

/**
 * What the backing plays this roll. The rng is seeded from the variation's
 * seed, so the same roll always picks the same progression and a re-roll may
 * pick another. Vamp takes nothing from it.
 */
export function pickProgression(
  settings: GeneratedBackingSettings,
  keyMode: KeyMode,
  rng: Rng,
): Progression {
  const { source } = settings;
  switch (source.kind) {
    case 'vamp':
      return VAMP;
    case 'goTo': {
      const options = progressionsFor(keyMode);
      if (options.length === 0) return VAMP;
      const { degrees } = rng.pick(options);
      return degrees.map((degree) => ({ degree, bars: 1 }));
    }
    case 'custom': {
      const usable = source.progressions.filter((p) => p.length > 0);
      return usable.length > 0 ? rng.pick(usable) : VAMP;
    }
  }
}

export type ParsedProgression =
  { ok: true; progression: Progression } | { ok: false; error: string };

const STEP = /^([1-7])(?:\*(\d+))?$/;

/**
 * A custom progression as typed: degrees separated by spaces, each with an
 * optional `*bars`. `2 5 1*2` is ii for a bar, V for a bar, I for two.
 */
export function parseProgression(text: string): ParsedProgression {
  const tokens = text.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: 'Enter degrees 1–7, like 2 5 1.' };

  const progression: { degree: DegreeNumber; bars: number }[] = [];
  for (const token of tokens) {
    const match = STEP.exec(token);
    if (!match) {
      return {
        ok: false,
        error: `“${token}” isn’t a degree. Use 1–7, with *bars to hold one: 1*2.`,
      };
    }
    const bars = match[2] === undefined ? 1 : Number(match[2]);
    if (bars < 1) return { ok: false, error: `“${token}” holds for no bars. Use *1 or more.` };
    progression.push({ degree: Number(match[1]) as DegreeNumber, bars });
  }
  return { ok: true, progression };
}

/** The typed form of a progression; `parseProgression` reads it back. */
export function formatProgression(progression: Progression): string {
  return progression
    .map(({ degree, bars }) => (bars === 1 ? `${degree}` : `${degree}*${bars}`))
    .join(' ');
}
