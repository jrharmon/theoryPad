import type { DegreeNumber, KeyMode } from '@/domain/music';
import { signatureDegree } from '@/domain/music';
import type { ScaleNotePosition } from '@/domain/instrument';
import type { NoteRole } from '@/domain/phrase';

/**
 * What a note is doing, so the tab and the neck diagram can colour it.
 * The target degree is what the player is being asked to land on.
 */
export function roleFor(
  position: ScaleNotePosition,
  targetDegree?: DegreeNumber,
): NoteRole {
  if (position.isRoot) return 'root';
  if (targetDegree !== undefined && position.degree.number === targetDegree) return 'target';
  return 'none';
}

/** Note options for a scale position — role plus its degree as an annotation. */
export function noteOptionsFor(
  position: ScaleNotePosition,
  targetDegree?: DegreeNumber,
): { role: NoteRole; annotation: string } {
  return {
    role: roleFor(position, targetDegree),
    annotation: position.degree.label,
  };
}

/** The degree that makes the mode sound like itself. */
export function signatureDegreeNumber(keyMode: KeyMode): DegreeNumber {
  return signatureDegree(keyMode).number;
}
