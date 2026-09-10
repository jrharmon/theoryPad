import type { Chroma, DegreeNumber, ModeName, PitchClass } from '@/domain/music';
import { MODE_NAMES, chroma, pitchClass, preferredTonic, signatureDegree } from '@/domain/music';
import type { NeckPosition, StringSet } from '@/domain/instrument';
import { defaultStringSets } from '@/domain/instrument';
import type { RhythmPattern } from '@/domain/phrase';
import { RHYTHM_PATTERNS, rhythmById } from '@/domain/phrase';
import type { AxisContext, AxisDefinition, AxisId } from './types';

export type Direction = 'ascending' | 'descending' | 'up-down' | 'down-up';
export type ShapeSystem = '3nps' | 'positional';

/** Positions the roller offers. Deliberately the ones a player thinks in. */
const NECK_POSITIONS: NeckPosition[] = [
  { fret: 0, span: 4 },
  { fret: 3, span: 4 },
  { fret: 5, span: 4 },
  { fret: 7, span: 4 },
  { fret: 10, span: 4 },
  { fret: 12, span: 4 },
];

const DIRECTIONS: Direction[] = ['ascending', 'descending', 'up-down', 'down-up'];

const DIRECTION_LABEL: Record<Direction, string> = {
  ascending: 'Ascending',
  descending: 'Descending',
  'up-down': 'Up then down',
  'down-up': 'Down then up',
};

function positionName(position: NeckPosition): string {
  if (position.fret === 0) return 'Open position';
  const suffix =
    position.fret % 10 === 1 && position.fret !== 11
      ? 'st'
      : position.fret % 10 === 2 && position.fret !== 12
        ? 'nd'
        : position.fret % 10 === 3 && position.fret !== 13
          ? 'rd'
          : 'th';
  return `${position.fret}${suffix} position`;
}

const modeAxis: AxisDefinition<ModeName> = {
  id: 'mode',
  scope: 'session',
  label: 'Mode',
  candidates: () => [...MODE_NAMES],
  key: (mode) => mode,
  format: (mode) => mode.charAt(0).toUpperCase() + mode.slice(1),
  parse: (key) => (MODE_NAMES.includes(key as ModeName) ? (key as ModeName) : null),
};

/**
 * The key axis rolls a pitch, and the spelling follows from the mode — Db
 * phrygian is written C#. So it depends on `mode` being resolved first, which
 * is why session axes roll in a defined order.
 */
const keyAxis: AxisDefinition<PitchClass> = {
  id: 'key',
  scope: 'session',
  label: 'Key',
  candidates: (context) => {
    const mode = (context.resolved.mode ?? 'ionian') as ModeName;
    return Array.from({ length: 12 }, (_, i) => preferredTonic(i as Chroma, mode));
  },
  key: (tonic) => tonic,
  format: (tonic) => tonic,
  parse: (key, context) => {
    if (!/^[A-G](#|b)?$/.test(key)) return null;
    // Respell into the rolled mode so a stored C# reads as Db where it should.
    const mode = (context.resolved.mode ?? 'ionian') as ModeName;
    return preferredTonic(chroma(pitchClass(key)), mode);
  },
};

const neckPositionAxis: AxisDefinition<NeckPosition> = {
  id: 'neckPosition',
  scope: 'exercise',
  label: 'Position',
  candidates: (context) =>
    NECK_POSITIONS.filter((p) => p.fret + p.span <= context.instrument.fretCount),
  key: (position) => String(position.fret),
  format: positionName,
  parse: (key) => NECK_POSITIONS.find((p) => String(p.fret) === key) ?? null,
};

const stringSetAxis: AxisDefinition<StringSet> = {
  id: 'stringSet',
  scope: 'exercise',
  label: 'String set',
  candidates: (context) => defaultStringSets(context.instrument),
  key: (set) => set.id,
  format: (set) => set.name,
  parse: (key, context) => defaultStringSets(context.instrument).find((s) => s.id === key) ?? null,
};

/**
 * Weighted toward the mode's signature degree — the note that makes the mode
 * sound like itself is the most useful thing to be asked to land on.
 */
const targetScaleDegreeAxis: AxisDefinition<DegreeNumber> = {
  id: 'targetScaleDegree',
  scope: 'exercise',
  label: 'Land on',
  candidates: () => [1, 2, 3, 4, 5, 6, 7],
  key: (degree) => String(degree),
  format: (degree) => String(degree),
  parse: (key) => {
    const n = Number(key);
    return n >= 1 && n <= 7 ? (n as DegreeNumber) : null;
  },
};

const rhythmPatternAxis: AxisDefinition<RhythmPattern> = {
  id: 'rhythmPattern',
  scope: 'exercise',
  label: 'Rhythm',
  candidates: () => [...RHYTHM_PATTERNS],
  key: (pattern) => pattern.id,
  format: (pattern) => pattern.name,
  parse: (key) => {
    try {
      return rhythmById(key);
    } catch {
      return null;
    }
  },
};

const directionAxis: AxisDefinition<Direction> = {
  id: 'direction',
  scope: 'exercise',
  label: 'Direction',
  candidates: () => DIRECTIONS,
  key: (direction) => direction,
  format: (direction) => DIRECTION_LABEL[direction],
  parse: (key) => (DIRECTIONS.includes(key as Direction) ? (key as Direction) : null),
};

/**
 * Only three-note-per-string ships in v1. CAGED shapes are conventional
 * fingerings rather than derivable and arrive as tables in milestone 8, so the
 * axis exists with one candidate rather than offering something that throws.
 */
const shapeSystemAxis: AxisDefinition<ShapeSystem> = {
  id: 'shapeSystem',
  scope: 'exercise',
  label: 'Shapes',
  candidates: () => ['3nps'],
  key: (system) => system,
  format: (system) => (system === '3nps' ? 'Three notes per string' : 'Positional'),
  parse: (key) => (key === '3nps' || key === 'positional' ? key : null),
};

const DEFINITIONS = [
  modeAxis,
  keyAxis,
  neckPositionAxis,
  stringSetAxis,
  targetScaleDegreeAxis,
  rhythmPatternAxis,
  directionAxis,
  shapeSystemAxis,
] as const;

const BY_ID = new Map<AxisId, AxisDefinition>(
  DEFINITIONS.map((d) => [d.id, d as AxisDefinition]),
);

export function axisDefinition(id: AxisId): AxisDefinition {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown axis: ${id}`);
  return found;
}

export function allAxisDefinitions(): readonly AxisDefinition[] {
  return DEFINITIONS;
}

/**
 * Session axes in resolution order. `mode` comes before `key` because the
 * spelling of the tonic depends on the mode.
 */
export const SESSION_AXIS_ORDER: AxisId[] = ['mode', 'key'];

export function isSessionAxis(id: AxisId): boolean {
  return axisDefinition(id).scope === 'session';
}

/**
 * A musical preference applied on top of the coverage bias.
 *
 * The only one so far: the mode's signature degree is the note that makes the
 * mode audible, so it is the most useful thing to be told to land on, and gets
 * asked for three times as often as any other degree.
 */
export const SIGNATURE_DEGREE_WEIGHT = 3;

export function axisPreferenceWeight(
  id: AxisId,
  valueKey: string,
  context: AxisContext,
): number {
  if (id === 'targetScaleDegree' && context.keyMode) {
    return Number(valueKey) === signatureDegree(context.keyMode).number
      ? SIGNATURE_DEGREE_WEIGHT
      : 1;
  }
  return 1;
}

export { NECK_POSITIONS, DIRECTIONS };
