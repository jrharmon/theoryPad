import type { DegreeNumber, KeyMode } from '@/domain/music';
import { degreeOf } from '@/domain/music';
import type { Instrument, ScaleNotePosition } from '@/domain/instrument';
import { noteAt, pitchClassAt, scaleOnNeck, spellInKey } from '@/domain/instrument';
import type { NeckOverlay } from '@/domain/neck';
import type { Phrase } from '@/domain/phrase';
import { roleFor } from './roles';

export interface OverlayOptions {
  targetDegree?: DegreeNumber;
  emphasisFrets?: number[];
  labelMode?: NeckOverlay['labelMode'];
}

function overlayFrom(
  positions: ScaleNotePosition[],
  options: OverlayOptions,
): NeckOverlay {
  const { targetDegree, emphasisFrets, labelMode = 'degree' } = options;
  return {
    labelMode,
    ...(emphasisFrets ? { emphasisFrets } : {}),
    notes: positions.map((p) => ({
      position: { string: p.string, fret: p.fret },
      degree: p.degree,
      role: roleFor(p, targetDegree),
    })),
  };
}

/** The neck diagram for a set of positions — usually the shape being played. */
export function overlayFromPositions(
  positions: ScaleNotePosition[],
  options: OverlayOptions = {},
): NeckOverlay {
  return overlayFrom(positions, options);
}

/**
 * The neck diagram derived from a phrase.
 *
 * A phrase carries string and fret but not degree, so the key is used to work
 * out what each note is — which is what lets the diagram colour roots and the
 * target degree without the generator having to say so twice.
 */
export function overlayFromPhrase(
  phrase: Phrase,
  keyMode: KeyMode,
  instrument: Instrument,
  options: OverlayOptions = {},
): NeckOverlay {
  const seen = new Set<string>();
  const positions: ScaleNotePosition[] = [];

  for (const note of phrase.notes) {
    const id = `${note.string}:${note.fret}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const sounding = spellInKey(keyMode, pitchClassAt(instrument, note));
    const degree = degreeOf(keyMode, sounding);
    if (!degree) continue;

    positions.push({
      string: note.string,
      fret: note.fret,
      pitchClass: sounding,
      note: noteAt(instrument, note),
      degree,
      isRoot: degree.number === 1,
    });
  }

  return overlayFrom(positions, options);
}

/** The whole mode across a stretch of neck — the fretboard explorer's view. */
export function overlayFullScale(
  keyMode: KeyMode,
  instrument: Instrument,
  range: { low: number; high: number } = { low: 0, high: 12 },
  options: OverlayOptions = {},
): NeckOverlay {
  return overlayFrom(scaleOnNeck(instrument, keyMode, range), options);
}
