import type { Degree } from '@/domain/music';
import type { FretPosition, Instrument, ScaleNotePosition } from '@/domain/instrument';
import type { NoteRole } from '@/domain/phrase';

/**
 * What a neck diagram should draw. Kept in the domain rather than the component
 * so exercises can build one without touching React, and so it is testable.
 */
export interface NeckOverlayNote {
  position: FretPosition;
  degree: Degree;
  role: NoteRole;
  /** Overrides the label derived from `labelMode`. */
  label?: string;
}

export type NeckLabelMode = 'degree' | 'note' | 'finger' | 'none';

export interface NeckOverlay {
  notes: NeckOverlayNote[];
  /** Frets to emphasise in the fret-number row — the rolled position. */
  emphasisFrets?: number[];
  labelMode?: NeckLabelMode;
}

export interface OverlayOptions {
  /** The degree to mark as the session's target. */
  targetDegree?: Degree;
  labelMode?: NeckLabelMode;
  emphasisFrets?: number[];
}

/** Build an overlay from scale positions, marking roots and the target degree. */
export function overlayFromScalePositions(
  positions: ScaleNotePosition[],
  options: OverlayOptions = {},
): NeckOverlay {
  const { targetDegree, labelMode = 'degree', emphasisFrets } = options;

  return {
    labelMode,
    ...(emphasisFrets ? { emphasisFrets } : {}),
    notes: positions.map((p) => ({
      position: { string: p.string, fret: p.fret },
      degree: p.degree,
      role: roleFor(p, targetDegree),
      ...(labelMode === 'note' ? { label: p.pitchClass } : {}),
    })),
  };
}

function roleFor(p: ScaleNotePosition, targetDegree?: Degree): NoteRole {
  if (p.isRoot) return 'root';
  if (targetDegree && p.degree.number === targetDegree.number) return 'target';
  return 'chord-tone';
}

/**
 * The frets an overlay uses, and one either side — a shape at the 7th fret has
 * no business drawing the nut. Open strings keep the nut in view.
 */
export function overlayFretRange(
  overlay: NeckOverlay,
  instrument: Instrument,
): { low: number; high: number } {
  const { fretCount } = instrument;
  const frets = overlay.notes.map((n) => n.position.fret);
  if (frets.length === 0) return { low: 0, high: Math.min(12, fretCount) };
  return {
    low: Math.max(0, Math.min(...frets) - 1),
    high: Math.min(fretCount, Math.max(...frets) + 1),
  };
}
