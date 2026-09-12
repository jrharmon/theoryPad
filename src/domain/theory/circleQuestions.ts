import type { ModeName } from '@/domain/music';
import { MODE_NAMES, circlePosition, keySignature, tonicsForMode } from '@/domain/music';
import type { Rng } from '@/domain/variation';
import {
  CIRCLE_POSITIONS,
  majorAt,
  minorAt,
  signatureLabel,
  wrapPosition,
} from './circle';
import { keyModeName } from './diatonic';
import { wantsTrick, withCorrect } from './distractors';
import type { SinglePickQuestion } from './types';

export type CircleQuestionType =
  | 'signature-to-key'
  | 'key-to-signature'
  | 'relative-minor'
  | 'relative-major'
  | 'neighbour-key'
  | 'mode-signature';

/**
 * Build a single pick whose options are all places on the circle — keys, or
 * signatures — so the feedback can show where the pick was and where the
 * answer is.
 */
function pick(
  id: string,
  rng: Rng,
  correct: number,
  wrong: number[],
  label: (position: number) => string,
  rest: {
    prompt: string;
    subject: string;
    rule: string;
    whatItIs?: (position: number) => string;
    /** Where the answer sits on the circle, when that is not `correct` itself. */
    circleAt?: number;
  },
): SinglePickQuestion {
  const distinct = wrong.filter(
    (w, i) => label(w) !== label(correct) && wrong.findIndex((x) => label(x) === label(w)) === i,
  );
  const { items, index } = withCorrect(correct, distinct.slice(0, 3), rng);
  const options = items.map((value, i) => ({ id: `${id}-${i}`, label: label(value) }));
  const whatItIs: Record<string, string> = {};
  const positions: Record<string, number> = {};
  items.forEach((value, i) => {
    positions[options[i]!.id] = wrapPosition(value);
    if (i !== index && rest.whatItIs) whatItIs[options[i]!.id] = rest.whatItIs(value);
  });
  return {
    kind: 'single-pick',
    id,
    prompt: rest.prompt,
    subject: rest.subject,
    options,
    correctOptionId: options[index]!.id,
    feedback: {
      rule: rest.rule,
      ...(rest.whatItIs ? { whatItIs } : {}),
      visual: { kind: 'circle-of-fifths', correct: wrapPosition(rest.circleAt ?? correct), positions },
    },
  };
}

function signatureToKey(p: number, rng: Rng, id: string): SinglePickQuestion {
  return pick(id, rng, p, rng.shuffle([p - 1, p + 1, p - 2, p + 2]).map(wrapPosition), (q) => `${majorAt(q)} major`, {
    prompt: p === 0 ? 'Which major key has no sharps or flats?' : `Which major key has ${signatureLabel(p).toLowerCase()}?`,
    subject: `key:${majorAt(p)}`,
    rule: `${majorAt(p)} major has ${signatureLabel(p).toLowerCase()} — ${Math.abs(p)} step${Math.abs(p) === 1 ? '' : 's'} ${p >= 0 ? 'clockwise' : 'anticlockwise'} from C.`,
    whatItIs: (q) => `${majorAt(q)} major has ${signatureLabel(q).toLowerCase()}.`,
  });
}

/**
 * Wrong answers for a question with a known trap: now and then the trap
 * leads, otherwise only the plain alternatives are offered.
 */
function traps(rng: Rng, trap: readonly number[], plain: readonly number[]): number[] {
  const honest = rng.shuffle(plain);
  return wantsTrick(rng) ? [...trap, ...honest] : honest;
}

function keyToSignature(p: number, rng: Rng, id: string): SinglePickQuestion {
  // The same count on the other side is the classic slip: 3 sharps for 3 flats.
  const wrong = traps(rng, p === 0 ? [] : [-p], [p + 1, p - 1, p + 2, p - 2]).filter(
    (q) => Math.abs(q) <= 7,
  );
  return pick(id, rng, p, wrong, signatureLabel, {
    prompt: `How many sharps or flats does ${majorAt(p)} major have?`,
    subject: `key:${majorAt(p)}`,
    rule: `${majorAt(p)} major has ${signatureLabel(p).toLowerCase()}.`,
  });
}

function relativeMinor(p: number, rng: Rng, id: string): SinglePickQuestion {
  const major = majorAt(p);
  // The parallel minor — same letter — is the answer people reach for.
  const parallel = CIRCLE_POSITIONS.find((q) => minorAt(q) === major);
  const wrong = traps(rng, parallel !== undefined ? [parallel] : [], [p + 1, p - 1, p + 2, p - 2]).map(wrapPosition);
  return pick(id, rng, p, wrong, (q) => `${minorAt(q)} minor`, {
    prompt: `What is the relative minor of ${major} major?`,
    subject: `key:${major}`,
    rule: `A relative minor shares its key signature: ${minorAt(p)} minor, three semitones below ${major}.`,
    whatItIs: (q) => `${minorAt(q)} minor is the relative of ${majorAt(q)} major.`,
  });
}

function relativeMajor(p: number, rng: Rng, id: string): SinglePickQuestion {
  const minor = minorAt(p);
  const parallel = CIRCLE_POSITIONS.find((q) => majorAt(q) === minor);
  const wrong = traps(rng, parallel !== undefined ? [parallel] : [], [p + 1, p - 1, p + 2, p - 2]).map(wrapPosition);
  return pick(id, rng, p, wrong, (q) => `${majorAt(q)} major`, {
    prompt: `What is the relative major of ${minor} minor?`,
    subject: `key:${majorAt(p)}`,
    rule: `A relative major shares its key signature: ${majorAt(p)} major, three semitones above ${minor}.`,
    whatItIs: (q) => `${majorAt(q)} major is the relative of ${minorAt(q)} minor.`,
  });
}

function neighbourKey(p: number, rng: Rng, id: string): SinglePickQuestion {
  const clockwise = rng.next() < 0.5;
  const step = clockwise ? 1 : -1;
  const target = wrapPosition(p + step);
  // Going the wrong way round is the trap.
  const wrong = traps(rng, [p - step], [p + 2 * step, p + 3 * step, p - 2 * step]).map(wrapPosition);
  return pick(id, rng, target, wrong, (q) => `${majorAt(q)} major`, {
    prompt: clockwise
      ? `One step clockwise from ${majorAt(p)} major — one more sharp or one fewer flat — is which key?`
      : `One step anticlockwise from ${majorAt(p)} major — one more flat or one fewer sharp — is which key?`,
    subject: `key:${majorAt(p)}`,
    rule: `${clockwise ? 'Clockwise is up a fifth' : 'Anticlockwise is up a fourth'}: ${majorAt(p)} to ${majorAt(target)}.`,
  });
}

function modeSignature(rng: Rng, id: string): SinglePickQuestion {
  const mode = rng.pick(MODE_NAMES.filter((m) => m !== 'ionian')) as ModeName;
  const tonic = rng.pick(tonicsForMode(mode));
  const km = { tonic, mode };
  const sig = keySignature(km);
  const position = circlePosition(km);
  // The slip is the major key on the same tonic: 2 sharps for D Dorian.
  // Only when that major is on the circle as spelled (C# Dorian's is not).
  const parallel = CIRCLE_POSITIONS.find((q) => majorAt(q) === tonic) ?? null;
  const wrong = traps(
    rng,
    [...(parallel !== null ? [parallel] : []), ...(position === 0 ? [] : [-position])],
    [position + 1, position - 1, position + 2, position - 2],
  ).filter((q) => Math.abs(q) <= 7);
  return pick(id, rng, position, wrong, signatureLabel, {
    prompt: `How many sharps or flats does ${keyModeName(km)} have?`,
    subject: `mode:${keyModeName(km)}`,
    rule: `${keyModeName(km)} is a rotation of ${sig.relativeMajor} major, so it shares its signature: ${signatureLabel(position).toLowerCase()}.`,
  });
}

/** Keys roam the whole circle: coverage is the point of this drill. */
export function circleQuestions(options: {
  rng: Rng;
  types: readonly CircleQuestionType[];
  count: number;
  includeModes: boolean;
  /** Lean toward some major keys (by name, `"Eb"`): 1 is even, higher is more often. */
  keyWeights?: Readonly<Record<string, number>>;
}): SinglePickQuestion[] {
  const { rng, count, includeModes, keyWeights = {} } = options;
  const positions = CIRCLE_POSITIONS.map((p) => ({ value: p, weight: keyWeights[majorAt(p)] ?? 1 }));
  const types = options.types.filter((t) => includeModes || t !== 'mode-signature');
  const pool = types.length > 0 ? types : (['signature-to-key'] as const);
  const start = rng.int(pool.length);

  const make = (type: CircleQuestionType, id: string): SinglePickQuestion => {
    const p = rng.weighted(positions);
    switch (type) {
      case 'signature-to-key':
        return signatureToKey(p, rng, id);
      case 'key-to-signature':
        return keyToSignature(p, rng, id);
      case 'relative-minor':
        return relativeMinor(p, rng, id);
      case 'relative-major':
        return relativeMajor(p, rng, id);
      case 'neighbour-key':
        return neighbourKey(p, rng, id);
      case 'mode-signature':
        return modeSignature(rng, id);
    }
  };

  // The same question twice in one set is wasted; a few tries finds another.
  const seen = new Set<string>();
  return Array.from({ length: count }, (_, i) => {
    const type = pool[(start + i) % pool.length]!;
    const id = `q${i + 1}`;
    let question = make(type, id);
    for (let tries = 0; seen.has(question.prompt) && tries < 8; tries += 1) question = make(type, id);
    seen.add(question.prompt);
    return question;
  });
}

