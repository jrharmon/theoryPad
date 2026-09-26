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
  // The full degree, not its number: blues has a ♭5 and a 5.
  if (
    targetDegree &&
    p.degree.number === targetDegree.number &&
    p.degree.alteration === targetDegree.alteration
  )
    return 'target';
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

export type FretRange = { low: number; high: number };

/** Frets the side panel's neck shows at once: enough for a shape, big enough to read. */
export const NECK_WINDOW_FRETS = 7;
/** How far an arrow moves the window: less than its width, so a little stays in view. */
export const NECK_WINDOW_STEP = 5;

/**
 * The frets to open a small neck on: `size` frets inside `range`, starting a
 * fret below `lowest` (the lowest fret the phrase opens with), the way the
 * full range keeps a fret either side. A range that fits is returned whole.
 */
export function openingFretWindow(
  range: FretRange,
  lowest: number,
  size: number = NECK_WINDOW_FRETS,
): FretRange {
  if (range.high - range.low + 1 <= size) return range;
  const low = Math.min(range.high - size + 1, Math.max(range.low, lowest - 1));
  return { low, high: low + size - 1 };
}

/**
 * The window moved one step lower (-1) or higher (+1), stopping at the ends
 * of `range` rather than running past the notes.
 */
export function stepFretWindow(
  window: FretRange,
  range: FretRange,
  direction: -1 | 1,
  step: number = NECK_WINDOW_STEP,
): FretRange {
  const size = window.high - window.low + 1;
  const low = Math.min(
    range.high - size + 1,
    Math.max(range.low, window.low + direction * step),
  );
  return { low, high: low + size - 1 };
}
