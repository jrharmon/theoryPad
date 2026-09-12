import type { PitchClass } from '@/domain/music';
import { chroma, pitchClass } from '@/domain/music';
import type { Rng } from '@/domain/variation';

/**
 * Wrong answers worth being tempted by.
 *
 * A drill whose wrong answers are obviously wrong teaches nothing, so each
 * kind of answer has its own idea of a near miss: the other spelling of the
 * same note, the same letter with the wrong accidental, the note a semitone
 * away; a spelling with exactly one note wrong.
 */

const LETTERS = 'CDEFGAB';

/**
 * How often a question sets a trap. A near miss teaches, but a drill made of
 * nothing but traps becomes a game about spotting the trap rather than
 * knowing the theory — so most questions offer plainly wrong answers, and
 * about one in three offers the near miss. (The player's call, after M4.)
 */
export const TRICK_RATE = 0.3;

export function wantsTrick(rng: Rng): boolean {
  return rng.next() < TRICK_RATE;
}

/** Plain wrong answers: a few from a pool of honest alternatives, in a seeded order. */
export function plainDistractors<T>(correct: T, pool: readonly T[], rng: Rng, count = 3): T[] {
  const seen = new Set<string>([JSON.stringify(correct)]);
  const out: T[] = [];
  for (const item of rng.shuffle(pool)) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === count) break;
  }
  return out;
}

function letterOf(pc: PitchClass): string {
  return pc[0]!;
}

/** The spelling of a chroma on a given letter, if it needs at most one accidental. */
function spellOn(letter: string, target: number): PitchClass | null {
  const natural = chroma(pitchClass(letter));
  let alter = target - natural;
  while (alter > 6) alter -= 12;
  while (alter < -6) alter += 12;
  if (alter === 0) return pitchClass(letter);
  if (alter === 1) return pitchClass(`${letter}#`);
  if (alter === -1) return pitchClass(`${letter}b`);
  return null;
}

/** Every single-accidental spelling of a chroma: 10 → A#, Bb. */
export function spellingsOf(target: number): PitchClass[] {
  return [...LETTERS].flatMap((letter) => {
    const spelled = spellOn(letter, target);
    return spelled ? [spelled] : [];
  });
}

/** The same note under another name: Bb → A#, E → Fb. */
export function enharmonics(pc: PitchClass): PitchClass[] {
  return spellingsOf(chroma(pc)).filter((s) => s !== pc);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Traps for a note: its other spelling first, then its letter with the
 * wrong accidental, then its chromatic neighbours. One from each kind, so a
 * question always offers a spelling trap and a pitch trap.
 */
export function noteDistractors(
  correct: PitchClass,
  rng: Rng,
  count = 3,
  avoid: readonly PitchClass[] = [],
): PitchClass[] {
  const letter = letterOf(correct);
  const c = chroma(correct);
  const excluded = new Set<string>([correct, ...avoid]);
  const keep = (list: PitchClass[]) => unique(list).filter((p) => !excluded.has(p));

  const enharmonic = keep(enharmonics(correct));
  const sameLetter = keep(
    [pitchClass(letter), pitchClass(`${letter}#`), pitchClass(`${letter}b`)].filter((p) => p !== correct),
  );
  const neighbours = keep([...spellingsOf((c + 1) % 12), ...spellingsOf((c + 11) % 12)]);

  const picked: PitchClass[] = [];
  for (const group of [enharmonic, sameLetter, neighbours]) {
    const choice = rng.shuffle(group.filter((p) => !picked.includes(p)))[0];
    if (choice && picked.length < count) picked.push(choice);
  }
  const rest = rng.shuffle(
    [...enharmonic, ...sameLetter, ...neighbours].filter((p) => !picked.includes(p)),
  );
  while (picked.length < count && rest.length > 0) picked.push(rest.shift()!);
  return picked;
}

/**
 * A chord spelled with exactly one note wrong: moved a semitone on its own
 * letter, so it still looks like a stack of thirds. The root is left alone —
 * changing it would change which chord is being asked about.
 */
export function spellingDistractors(
  notes: readonly PitchClass[],
  rng: Rng,
  count = 3,
): PitchClass[][] {
  const seen = new Set([notes.join(' ')]);
  const candidates: PitchClass[][] = [];
  for (let i = 1; i < notes.length; i += 1) {
    const note = notes[i]!;
    for (const shift of [1, -1]) {
      const moved = spellOn(letterOf(note), (chroma(note) + shift + 12) % 12);
      if (!moved) continue;
      const spelled = notes.map((n, k) => (k === i ? moved : n));
      const key = spelled.join(' ');
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(spelled);
      }
    }
  }
  return rng.shuffle(candidates).slice(0, count);
}

/** Put the right answer among the wrong ones, in a seeded order. */
export function withCorrect<T>(correct: T, distractors: readonly T[], rng: Rng): { items: T[]; index: number } {
  const items = rng.shuffle([correct, ...distractors]);
  return { items, index: items.indexOf(correct) };
}
