import type {
  Chroma,
  DegreeNumber,
  KeyMode,
  ModeId,
  PitchClass,
  ScaleId,
} from '@/domain/music';
import {
  MODE_NAMES,
  SCALE_IDS,
  chroma,
  isModeOf,
  modeTitle,
  modesOf,
  pitchClass,
  preferredTonic,
  scaleDegrees,
  hasModes,
  scaleTitle,
  signatureDegree,
} from '@/domain/music';
import type { NeckPosition, StringSet } from '@/domain/instrument';
import { defaultStringSets } from '@/domain/instrument';
import type { RhythmPattern } from '@/domain/phrase';
import { RHYTHM_PATTERNS, rhythmById } from '@/domain/phrase';
import type { AxisContext, AxisDefinition, AxisId } from './types';

export type Direction = 'ascending' | 'descending' | 'up-down' | 'down-up';
export type ShapeSystem = '3nps' | 'positional';

/**
 * A figure repeated up the scale: 3rds are 1-3, 2-4, 3-5…; groups of three
 * are 1-2-3, 2-3-4…. `figure` holds each note's offset in scale steps from
 * the figure's first note, which is all a generator needs to know.
 */
export interface IntervalPattern {
  id: string;
  name: string;
  figure: number[];
}

const INTERVAL_PATTERNS: IntervalPattern[] = [
  { id: '3rds', name: '3rds', figure: [0, 2] },
  { id: '4ths', name: '4ths', figure: [0, 3] },
  { id: '5ths', name: '5ths', figure: [0, 4] },
  { id: '6ths', name: '6ths', figure: [0, 5] },
  { id: '7ths', name: '7ths', figure: [0, 6] },
  { id: 'groups-of-3', name: 'Groups of 3', figure: [0, 1, 2] },
  { id: 'groups-of-4', name: 'Groups of 4', figure: [0, 1, 2, 3] },
];

/** Whether every figure runs the same way, or every other one turns round: 1-3, 4-2, 3-5, 6-4. */
export type IntervalPairing = 'same-direction' | 'alternating';

const INTERVAL_PAIRINGS: IntervalPairing[] = ['same-direction', 'alternating'];

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

/**
 * What each axis rolls.
 *
 * One place says an axis's type, so a generator reading `neckPosition` gets a
 * NeckPosition without saying so — and an axis whose definition rolls
 * something else does not compile.
 */
export interface AxisValues {
  scale: ScaleId;
  mode: ModeId;
  key: PitchClass;
  neckPosition: NeckPosition;
  stringSet: StringSet;
  targetScaleDegree: DegreeNumber;
  rhythmPattern: RhythmPattern;
  direction: Direction;
  shapeSystem: ShapeSystem;
  intervalPattern: IntervalPattern;
  intervalPairing: IntervalPairing;
}

/**
 * The scale the key is played in. Absent — an exercise that doesn't declare it,
 * or anything stored before scales existed — is Major, and so is the default:
 * a scale is a deliberate choice until the player rolls it.
 */
const scaleAxis: AxisDefinition<AxisValues['scale']> = {
  id: 'scale',
  scope: 'session',
  label: 'Scale',
  candidates: () => [...SCALE_IDS],
  key: (scale) => scale,
  format: scaleTitle,
  parse: (key) => (SCALE_IDS.includes(key as ScaleId) ? (key as ScaleId) : null),
  defaultPolicy: { mode: 'fixed', value: 'major' },
};

/** The scale this roll is in: the rolled one, or Major. */
export function resolvedScale(context: AxisContext): ScaleId {
  return (context.resolved.scale as ScaleId | undefined) ?? 'major';
}

/**
 * The scale's modes: Major's seven, or the one of any other scale, whose id is
 * its own. So `scale` resolves first.
 */
const modeAxis: AxisDefinition<AxisValues['mode']> = {
  id: 'mode',
  scope: 'session',
  label: 'Mode',
  candidates: (context) => [...modesOf(resolvedScale(context))],
  key: (mode) => mode,
  format: modeTitle,
  parse: (key, context) => (isModeOf(resolvedScale(context), key) ? key : null),
};

/**
 * The modes a player chooses between: Major's, when the scale is Major or
 * varies (the choice applies when it rolls Major). None for a scale with a
 * single mode: there is nothing to choose.
 */
export function modeChoices(scale: ScaleId | null): ModeId[] {
  if (scale === null) return [...MODE_NAMES];
  return hasModes(scale) ? [...modesOf(scale)] : [];
}

/** The scale and mode resolved so far, for spelling a tonic. */
function spellingOf(context: AxisContext): Pick<KeyMode, 'scale' | 'mode'> {
  const scale = resolvedScale(context);
  const mode = context.resolved.mode;
  return {
    scale,
    mode: mode !== undefined && isModeOf(scale, mode) ? mode : modesOf(scale)[0]!,
  };
}

/**
 * The key axis rolls a pitch, and the spelling follows from the scale and mode
 * — Db phrygian is written C#. So it depends on both being resolved first,
 * which is why session axes roll in a defined order.
 */
const keyAxis: AxisDefinition<AxisValues['key']> = {
  id: 'key',
  scope: 'session',
  label: 'Key',
  candidates: (context) => {
    const spelling = spellingOf(context);
    return Array.from({ length: 12 }, (_, i) => preferredTonic(i as Chroma, spelling));
  },
  key: (tonic) => tonic,
  format: (tonic) => tonic,
  parse: (key, context) => {
    if (!/^[A-G](#|b)?$/.test(key)) return null;
    // Respell into the rolled scale and mode so a stored C# reads as Db where it should.
    return preferredTonic(chroma(pitchClass(key)), spellingOf(context));
  },
  identity: (key) => (/^[A-G](#|b)?$/.test(key) ? String(chroma(pitchClass(key))) : key),
};

const neckPositionAxis: AxisDefinition<AxisValues['neckPosition']> = {
  id: 'neckPosition',
  scope: 'exercise',
  label: 'Position',
  candidates: (context) =>
    NECK_POSITIONS.filter((p) => p.fret + p.span <= context.instrument.fretCount),
  key: (position) => String(position.fret),
  format: positionName,
  parse: (key) => NECK_POSITIONS.find((p) => String(p.fret) === key) ?? null,
};

const stringSetAxis: AxisDefinition<AxisValues['stringSet']> = {
  id: 'stringSet',
  scope: 'exercise',
  label: 'String set',
  candidates: (context) => defaultStringSets(context.instrument),
  key: (set) => set.id,
  format: (set) => set.name,
  parse: (key, context) =>
    defaultStringSets(context.instrument).find((s) => s.id === key) ?? null,
  // Every string unless an exercise or the player says otherwise: a set is a
  // deliberate choice, not something to be surprised by.
  defaultPolicy: { mode: 'fixed', value: 'all' },
};

/**
 * The degrees a phrase can land on: the scale's own. A pentatonic has no 2 or
 * 6 to land on. Blues' ♭5 is left out — it is a passing note, never a place to
 * stop — so a bare number always names one note (see `noteAtDegree`).
 */
function landingDegrees(keyMode: KeyMode | undefined): DegreeNumber[] {
  if (!keyMode) return [1, 2, 3, 4, 5, 6, 7];
  const numbers = scaleDegrees(keyMode)
    .filter((d) => !(keyMode.scale === 'blues' && d.alteration !== 0 && d.number === 5))
    .map((d) => d.number);
  return [...new Set(numbers)];
}

/**
 * Weighted toward the mode's signature degree — the note that makes the mode
 * sound like itself is the most useful thing to be asked to land on.
 */
const targetScaleDegreeAxis: AxisDefinition<AxisValues['targetScaleDegree']> = {
  id: 'targetScaleDegree',
  scope: 'exercise',
  label: 'Land on',
  candidates: (context) => landingDegrees(context.keyMode),
  key: (degree) => String(degree),
  format: (degree) => String(degree),
  parse: (key, context) => {
    const n = Number(key);
    return landingDegrees(context.keyMode).includes(n as DegreeNumber)
      ? (n as DegreeNumber)
      : null;
  },
};

const rhythmPatternAxis: AxisDefinition<AxisValues['rhythmPattern']> = {
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

const directionAxis: AxisDefinition<AxisValues['direction']> = {
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
const shapeSystemAxis: AxisDefinition<AxisValues['shapeSystem']> = {
  id: 'shapeSystem',
  scope: 'exercise',
  label: 'Shapes',
  candidates: () => ['3nps'],
  key: (system) => system,
  format: (system) => (system === '3nps' ? 'Three notes per string' : 'Positional'),
  parse: (key) => (key === '3nps' || key === 'positional' ? key : null),
};

const intervalPatternAxis: AxisDefinition<AxisValues['intervalPattern']> = {
  id: 'intervalPattern',
  scope: 'exercise',
  label: 'Interval',
  candidates: () => [...INTERVAL_PATTERNS],
  key: (pattern) => pattern.id,
  format: (pattern) => pattern.name,
  parse: (key) => INTERVAL_PATTERNS.find((p) => p.id === key) ?? null,
};

const intervalPairingAxis: AxisDefinition<AxisValues['intervalPairing']> = {
  id: 'intervalPairing',
  scope: 'exercise',
  label: 'Pairing',
  candidates: () => INTERVAL_PAIRINGS,
  key: (pairing) => pairing,
  format: (pairing) => (pairing === 'same-direction' ? 'Same direction' : 'Alternating'),
  parse: (key) =>
    INTERVAL_PAIRINGS.includes(key as IntervalPairing) ? (key as IntervalPairing) : null,
};

const DEFINITIONS = [
  scaleAxis,
  modeAxis,
  keyAxis,
  neckPositionAxis,
  stringSetAxis,
  targetScaleDegreeAxis,
  rhythmPatternAxis,
  directionAxis,
  shapeSystemAxis,
  intervalPatternAxis,
  intervalPairingAxis,
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
 * Session axes in resolution order. `scale` comes before `mode` because the
 * modes offered depend on it, and both before `key` because the spelling of
 * the tonic depends on them.
 */
export const SESSION_AXIS_ORDER: AxisId[] = ['scale', 'mode', 'key'];

export function isSessionAxis(id: AxisId): boolean {
  return axisDefinition(id).scope === 'session';
}

/**
 * Musical preferences applied on top of the coverage bias.
 *
 * The mode's signature degree is the note that makes the mode audible, so it
 * is the most useful thing to be told to land on. The root is the least: you
 * would land there anyway, and "land each shape on the 1st" is an instruction
 * that asks for nothing. It stays possible, just uncommon.
 */
export const SIGNATURE_DEGREE_WEIGHT = 3;
export const ROOT_DEGREE_WEIGHT = 0.4;

export function axisPreferenceWeight(
  id: AxisId,
  valueKey: string,
  context: AxisContext,
): number {
  if (id !== 'targetScaleDegree' || !context.keyMode) return 1;

  // By full degree: blues' signature is its ♭5, which is not its 5.
  const degree = Number(valueKey);
  const signature = signatureDegree(context.keyMode);
  const landing = scaleDegrees(context.keyMode).find(
    (d) => d.number === degree && (d.alteration === 0 || context.keyMode!.scale !== 'blues'),
  );
  if (landing?.number === signature.number && landing.alteration === signature.alteration) {
    return SIGNATURE_DEGREE_WEIGHT;
  }
  if (degree === 1) return ROOT_DEGREE_WEIGHT;
  return 1;
}

export { NECK_POSITIONS, DIRECTIONS, INTERVAL_PATTERNS };
