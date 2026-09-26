import type { Degree } from '@/domain/music';
import type { ScaleNotePosition } from '@/domain/instrument';
import type { NoteRole } from '@/domain/phrase';

/**
 * What a note is doing, so the tab and the neck diagram can colour it.
 * The target degree is what the player is being asked to land on, matched by
 * its full degree: blues has a ♭5 and a 5, and only one is the target.
 */
export function roleFor(position: ScaleNotePosition, targetDegree?: Degree): NoteRole {
  if (position.isRoot) return 'root';
  if (
    targetDegree !== undefined &&
    position.degree.number === targetDegree.number &&
    position.degree.alteration === targetDegree.alteration
  ) {
    return 'target';
  }
  return 'none';
}

/** Note options for a scale position — role plus its degree as an annotation. */
export function noteOptionsFor(
  position: ScaleNotePosition,
  targetDegree?: Degree,
): { role: NoteRole; annotation: string } {
  return {
    role: roleFor(position, targetDegree),
    annotation: position.degree.label,
  };
}
