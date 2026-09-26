import type { KeyMode, ModeId, ModeName, ScaleId } from './types';
import { MODE_NAMES, SHAPE_IDS } from './types';

/**
 * The scales, their modes, and their intervals.
 *
 * A scale has one of three kinds of mode:
 *   - `modes`  — Major. Each mode is a different set of notes on the same root.
 *   - `shapes` — the pentatonics and blues. Each shape is the same notes in a
 *                different box on the neck; the root never moves.
 *   - `single` — a scale with one mode, whose id is the scale's own. The Mode
 *                control is hidden for these.
 *
 * Notes are spelled by transposing the tonic by each interval, so a scale of
 * seven intervals uses each letter once. Blues has two 5ths (♭5 and 5), which
 * is why a note is named by its full degree, not its number.
 */

export type ScaleKind = 'modes' | 'shapes' | 'single';

interface ScaleDefinition {
  /** In a menu: "Minor pentatonic". */
  title: string;
  /** After a tonic: "A minor pentatonic", "E Phrygian dominant". */
  name: string;
  kind: ScaleKind;
  modes: readonly ModeId[];
  /** The Major-scale mode whose notes contain this scale's, on the same root. */
  parent: ModeName | null;
  /**
   * The Major-scale mode whose tonic spelling this scale borrows where it can:
   * natural minor's for harmonic and melodic minor, so it reads C♯ melodic
   * minor, not D♭. Null for Major, whose modes spell themselves.
   */
  spelledAs: ModeName | null;
}

export const SCALES: Record<ScaleId, ScaleDefinition> = {
  major: {
    title: 'Major',
    name: 'major',
    kind: 'modes',
    modes: MODE_NAMES,
    parent: null,
    spelledAs: null,
  },
  'minor-pentatonic': {
    title: 'Minor pentatonic',
    name: 'minor pentatonic',
    kind: 'shapes',
    modes: SHAPE_IDS,
    parent: 'aeolian',
    spelledAs: 'aeolian',
  },
  'major-pentatonic': {
    title: 'Major pentatonic',
    name: 'major pentatonic',
    kind: 'shapes',
    modes: SHAPE_IDS,
    parent: 'ionian',
    spelledAs: 'ionian',
  },
  blues: {
    title: 'Blues',
    name: 'blues',
    kind: 'shapes',
    modes: SHAPE_IDS,
    parent: 'aeolian',
    spelledAs: 'aeolian',
  },
  'harmonic-minor': {
    title: 'Harmonic minor',
    name: 'harmonic minor',
    kind: 'single',
    modes: ['harmonic-minor'],
    parent: null,
    spelledAs: 'aeolian',
  },
  'phrygian-dominant': {
    title: 'Phrygian dominant',
    name: 'Phrygian dominant',
    kind: 'single',
    modes: ['phrygian-dominant'],
    parent: null,
    spelledAs: 'phrygian',
  },
  'melodic-minor': {
    title: 'Melodic minor',
    name: 'melodic minor',
    kind: 'single',
    modes: ['melodic-minor'],
    parent: null,
    spelledAs: 'aeolian',
  },
};

const MODE_INTERVALS: Record<ModeName, readonly string[]> = {
  ionian: ['1P', '2M', '3M', '4P', '5P', '6M', '7M'],
  dorian: ['1P', '2M', '3m', '4P', '5P', '6M', '7m'],
  phrygian: ['1P', '2m', '3m', '4P', '5P', '6m', '7m'],
  lydian: ['1P', '2M', '3M', '4A', '5P', '6M', '7M'],
  mixolydian: ['1P', '2M', '3M', '4P', '5P', '6M', '7m'],
  aeolian: ['1P', '2M', '3m', '4P', '5P', '6m', '7m'],
  locrian: ['1P', '2m', '3m', '4P', '5d', '6m', '7m'],
};

const SCALE_INTERVALS: Record<Exclude<ScaleId, 'major'>, readonly string[]> = {
  'minor-pentatonic': ['1P', '3m', '4P', '5P', '7m'],
  'major-pentatonic': ['1P', '2M', '3M', '5P', '6M'],
  blues: ['1P', '3m', '4P', '5d', '5P', '7m'],
  'harmonic-minor': ['1P', '2M', '3m', '4P', '5P', '6m', '7M'],
  'phrygian-dominant': ['1P', '2m', '3M', '4P', '5P', '6m', '7m'],
  // One form up and down, as jazz players use it; the classical form descends
  // as natural minor.
  'melodic-minor': ['1P', '2M', '3m', '4P', '5P', '6M', '7M'],
};

/** The scale's modes (or shapes), in order. */
export function modesOf(scale: ScaleId): readonly ModeId[] {
  return SCALES[scale].modes;
}

export function scaleKind(scale: ScaleId): ScaleKind {
  return SCALES[scale].kind;
}

/** Is `mode` one of `scale`'s? Stored and rolled pairs are checked with this. */
export function isModeOf(scale: ScaleId, mode: string): mode is ModeId {
  return (SCALES[scale].modes as readonly string[]).includes(mode);
}

/** Intervals above the tonic, one per scale step. A shape doesn't change them. */
export function scaleIntervals(km: Pick<KeyMode, 'scale' | 'mode'>): readonly string[] {
  if (km.scale === 'major') return MODE_INTERVALS[km.mode as ModeName];
  return SCALE_INTERVALS[km.scale];
}

/**
 * The Major-scale mode that contains this scale's notes on the same root:
 * the mode itself for Major, Aeolian for minor pentatonic and blues, Ionian for
 * major pentatonic. Null for a scale that isn't inside any mode of major
 * (harmonic minor, Phrygian dominant, melodic minor) — those are used as
 * themselves.
 */
export function parentMode(km: KeyMode): KeyMode | null {
  if (km.scale === 'major') return km;
  const parent = SCALES[km.scale].parent;
  return parent === null ? null : { tonic: km.tonic, scale: 'major', mode: parent };
}

/** Does the scale have chords of its own? Pentatonics borrow their parent's. */
export function hasOwnChords(scale: ScaleId): boolean {
  return SCALES[scale].kind !== 'shapes';
}

/** The key whose chords go with this scale: its own, or its parent mode's. */
export function harmonyOf(km: KeyMode): KeyMode {
  return hasOwnChords(km.scale) ? km : parentMode(km)!;
}

export function scaleTitle(scale: ScaleId): string {
  return SCALES[scale].title;
}

/** "dorian" → "Dorian", "shape-2" → "Shape 2", "harmonic-minor" → "Harmonic minor". */
export function modeTitle(mode: ModeId): string {
  if (mode.startsWith('shape-')) return `Shape ${mode.slice('shape-'.length)}`;
  if (mode in SCALES) return SCALES[mode as ScaleId].title;
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** "D Dorian", "A minor pentatonic, shape 2", "E Phrygian dominant". */
export function keyModeName(km: KeyMode): string {
  const scale = SCALES[km.scale];
  switch (scale.kind) {
    case 'modes':
      return `${km.tonic} ${modeTitle(km.mode)}`;
    case 'shapes':
      return `${km.tonic} ${scale.name}, ${modeTitle(km.mode).toLowerCase()}`;
    case 'single':
      return `${km.tonic} ${scale.name}`;
  }
}

/**
 * What the written character, and the signature degree, belong to: the mode
 * for Major, where each mode is different notes; the scale for everything else,
 * where a shape changes only the box.
 */
export type CharacterId = ModeName | Exclude<ScaleId, 'major'>;

export function characterId(km: Pick<KeyMode, 'scale' | 'mode'>): CharacterId {
  return km.scale === 'major' ? (km.mode as ModeName) : km.scale;
}

/** 'shape-3' → 3; null for anything that isn't a pentatonic shape. */
export function shapeNumber(mode: ModeId): number | null {
  return mode.startsWith('shape-') ? Number(mode.slice('shape-'.length)) : null;
}
