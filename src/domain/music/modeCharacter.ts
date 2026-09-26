import type { DegreeNumber, KeyMode } from './types';
import type { CharacterId } from './scales';
import { characterId, harmonyOf } from './scales';

/**
 * What each mode sounds like and how to use it — the one piece of the
 * key/mode reference that is written rather than computed. It is per mode, not
 * per key: one entry per Major-scale mode, and one per other scale (a shape
 * doesn't change how a pentatonic sounds).
 *
 * Practical voice: what to play, what to land on, what to steer round. No
 * genre labels. Drafted for the player to edit; the wording is theirs to
 * change.
 */
export interface ModeCharacter {
  /** One line, for the compact popover. */
  summary: string;
  soundsLike: string;
  /** The note that makes the mode, and how to put it to work. */
  signatureNote: string;
  avoid: string;
  /** Against its neighbors: one alteration away in either direction. */
  compare: string;
  /**
   * Go-to progressions as scale degrees, a bar each (a degree repeated is held);
   * the view spells them in the key. Absent for a pentatonic, which uses its
   * parent mode's.
   */
  progressions?: { degrees: DegreeNumber[]; use: string }[];
}

export const MODE_CHARACTER: Record<CharacterId, ModeCharacter> = {
  ionian: {
    summary: 'Major and settled — every line wants to come home to 1.',
    soundsLike:
      'Bright and resolved. Every chord pulls back to the I, so a phrase sounds finished when it lands on 1, 3 or 5.',
    signatureNote:
      'The major 7th. It sits a half step under the root and leans into it: play 7 → 1 to end a line. It is what separates Ionian from Mixolydian.',
    avoid:
      'Holding the 4th over the I chord — a half step above the 3rd, it clashes. Pass through it, or let it fall to 3.',
    compare:
      'Lower the 7th and it is Mixolydian; raise the 4th and it is Lydian. Of the three, Ionian is the most at rest.',
    progressions: [
      { degrees: [1, 4, 5, 1], use: 'The plain cadence. Land on 1 as the V resolves.' },
      { degrees: [1, 6, 4, 5], use: 'Target the 3rd of each chord as it changes.' },
      { degrees: [2, 5, 1], use: 'Run 7 → 1 across the V to I.' },
    ],
  },
  dorian: {
    summary: 'Minor, lifted by a natural 6th — brighter than Aeolian.',
    soundsLike:
      'Minor with an open, unresolved lift. It sits happily on one or two chords rather than cadencing.',
    signatureNote:
      'The natural 6th. Over the i chord, play 6 → 5, or climb 5–6–♭7. The major IV chord carries it.',
    avoid:
      'Ending on the 6th: over the i chord it sounds like a m6, fine in passing but unsettled as a last note. Finish on 1, ♭3 or 5 — and watch that minor-scale habit doesn’t drag the 6th down to ♭6.',
    compare:
      'Aeolian with the 6th raised; Mixolydian with the 3rd lowered. The brightest of the minor modes.',
    progressions: [
      { degrees: [1, 4], use: 'The Dorian vamp. Hit the 6th as the IV arrives.' },
      { degrees: [1, 7, 4, 1], use: 'Walk ♭7 → 6 → 5 down through the changes.' },
      { degrees: [1, 2], use: 'Alternate the two minor chords; lean on 6 over the ii.' },
    ],
  },
  phrygian: {
    summary: 'Dark minor with a half step above the root.',
    soundsLike:
      'Tense and close. The ♭2 hangs just above the root, so lines fall onto home rather than climb to it.',
    signatureNote:
      'The ♭2. Resolve ♭2 → 1, or trill between them. The ♭II chord, a half step above the tonic, carries it.',
    avoid:
      'Landing on the ♭2 and staying: against the root it grinds. Treat it as a note that always moves down.',
    compare:
      'Aeolian with the 2nd lowered; Locrian with the 5th restored. Raise the 3rd and it becomes Phrygian dominant — a different scale.',
    progressions: [
      { degrees: [1, 2], use: 'The half-step move. Play ♭2 → 1 as the chords swap.' },
      { degrees: [1, 2, 3, 2], use: 'Climb and fall back; end each bar on the root.' },
      { degrees: [1, 4, 2, 1], use: 'Save the ♭II for last so its pull lands.' },
    ],
  },
  lydian: {
    summary: 'Major with a raised 4th — bright, and floating.',
    soundsLike:
      'Brighter than major and less settled: with no natural 4th pulling to 3, lines hover instead of landing.',
    signatureNote:
      'The ♯4. Let it ring over the I chord, or move 3–♯4–5. The II chord, a whole step above the tonic, carries it.',
    avoid:
      'Resolving the ♯4 up to 5 every time — it turns into a leading tone and the color becomes an ordinary V. Let it sit. And catch major-scale muscle memory slipping back to a natural 4th.',
    compare: 'Ionian with the 4th raised. The brightest of the seven.',
    progressions: [
      { degrees: [1, 2], use: 'The Lydian vamp. The ♯4 is the 3rd of the II — target it.' },
      { degrees: [1, 2, 3, 2], use: 'Keep the ♯4 in view as the chords climb.' },
      { degrees: [1, 6, 2], use: 'Save the II for last and land the ♯4 as it arrives.' },
    ],
  },
  mixolydian: {
    summary: 'Major with a flat 7th — bright, but loose rather than final.',
    soundsLike:
      'Major on top, relaxed underneath: the ♭7 removes the leading tone, so the tonic is home without the pull.',
    signatureNote:
      'The ♭7. Play 5–♭7–1, or bend up into it. The major ♭VII chord, a whole step below the tonic, carries it.',
    avoid:
      'Holding the 4th over the I chord — it sounds like a suspension waiting to resolve. Move it to 3.',
    compare:
      'Ionian with the 7th lowered; Dorian with the 3rd raised. It keeps major’s 3rd and borrows minor’s 7th.',
    progressions: [
      { degrees: [1, 7, 4, 1], use: 'The ♭VII–IV turn back home. Target ♭7 on the ♭VII.' },
      { degrees: [1, 7], use: 'Two chords a whole step apart; the ♭VII is built on the ♭7.' },
      { degrees: [1, 5, 4], use: 'The minor v gives away the ♭7 — lean on it there.' },
    ],
  },
  aeolian: {
    summary: 'Natural minor — dark, and settled.',
    soundsLike:
      'Plain minor: serious, and it resolves firmly. The ♭6 sinking to 5 gives it weight.',
    signatureNote:
      'The ♭6. Play ♭6 → 5 over the i chord; it is the note that separates Aeolian from Dorian. The ♭VI chord carries it.',
    avoid:
      'Holding the ♭6 over the i chord — a half step above the 5th, it wants to fall. Resolve it down. And there is no leading tone here: a strong V–i is harmonic minor, not this.',
    compare: 'Dorian with the 6th lowered; Phrygian with the 2nd raised.',
    progressions: [
      { degrees: [1, 6, 7, 1], use: 'The climb home. Put ♭6 → 5 over the ♭VI.' },
      { degrees: [1, 4, 5, 1], use: 'All minor chords — target each root on the change.' },
      {
        degrees: [1, 7, 6, 7],
        use: 'Rock between ♭VII and ♭VI; land on ♭6 as the ♭VI arrives.',
      },
    ],
  },
  locrian: {
    summary: 'The unstable one — its own tonic chord is diminished.',
    soundsLike:
      'Uneasy and unresolved. The tonic chord is diminished, so home never quite sounds like home.',
    signatureNote:
      'The ♭5. It replaces the perfect 5th that anchors every other mode, leaving the root nothing solid under it. Play 1–♭5 and ♭5–4 to hear it.',
    avoid:
      'Treating the ♭5 as a 5th, and ending long phrases on the root — they rarely sound final. It works best over a m7♭5 chord, which is where it belongs.',
    compare: 'Phrygian with the 5th lowered. The darkest of the seven.',
    progressions: [
      {
        degrees: [1, 2],
        use: 'Half-step chords; resolve ♭2 → 1 against the diminished tonic.',
      },
      { degrees: [1, 4, 2], use: 'Lean on the ♭5 over the i°, the root over the iv.' },
    ],
  },
  'minor-pentatonic': {
    summary: 'Natural minor with the two notes that rub taken out.',
    soundsLike:
      'Minor and open. With no 2nd or ♭6 there is nothing to clash with the chords, so almost any note works over a minor or bluesy progression.',
    signatureNote:
      'The ♭3. It is what makes the scale minor: land on it squarely over a minor chord, or bend it a little sharp over a major one for the blues sound.',
    avoid:
      'Running the box up and down in order — five notes go stale fast. Skip strings, repeat short figures, and end phrases on 1 or 5.',
    compare:
      'Aeolian without its 2nd and ♭6. Add the ♭5 and it is the blues scale; the same notes from its second note are the relative major pentatonic.',
  },
  'major-pentatonic': {
    summary: 'The major scale with the 4th and 7th taken out.',
    soundsLike:
      'Bright and open, never tense. With no 4th or 7th there are no half steps, so nothing needs resolving.',
    signatureNote:
      'The 3rd. It is what makes it major: slide or bend into it from the 2nd, and land on it over the I chord.',
    avoid:
      'Playing it over a minor chord — its 3rd clashes with the chord’s ♭3. Over minor, the same shapes from the relative minor are the minor pentatonic.',
    compare:
      'Ionian without its 4th and 7th. The same five notes as the minor pentatonic a minor 3rd lower.',
  },
  blues: {
    summary: 'Minor pentatonic with the ♭5 added.',
    soundsLike:
      'Gritty and vocal. The ♭5 sits between the 4th and 5th and turns any climb through it into a smear.',
    signatureNote:
      'The ♭5. Pass through it — 4–♭5–5, or 5–♭5–4 — or bend the 4th up to it. It is a passing note, not a resting one.',
    avoid:
      'Holding the ♭5 or ending on it: once it stops moving it sounds like a wrong note. Land on 1, ♭3 or 5.',
    compare:
      'Minor pentatonic plus one note. Over a dominant-7th blues it works against every chord.',
    // The generated backing plays blues' 1, 4 and 5 as dominant 7ths (decision 22).
    progressions: [
      {
        degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
        use: 'The 12-bar. Land on the ♭3 over the I7 and on the root of the IV7 as it arrives.',
      },
      {
        degrees: [1, 4, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
        use: 'Quick change: the IV7 comes early in bar 2. Bend the 4th toward the ♭5 there.',
      },
    ],
  },
  'harmonic-minor': {
    summary: 'Natural minor with a raised 7th — a leading tone back to the root.',
    soundsLike:
      'Dark and dramatic. The gap from ♭6 up to 7 is a step and a half, which gives it its exotic, classical edge.',
    signatureNote:
      'The major 7th, raised from natural minor’s ♭7. A half step under the root, it pulls hard into it: play 7 → 1. The major V chord carries it and makes V–i a strong cadence.',
    avoid:
      'Holding the 7th over the i chord — resolve it up. And the ♭6–7 leap is the loudest thing in the scale; use it on purpose.',
    compare:
      'Aeolian with the 7th raised; melodic minor with the 6th lowered. Start it from its 5th note and it is Phrygian dominant.',
    progressions: [{ degrees: [1, 4, 5], use: 'i–iv–V. Play 7 → 1 as the V resolves.' }],
  },
  'phrygian-dominant': {
    summary: 'Phrygian with a major 3rd — the 5th mode of harmonic minor.',
    soundsLike:
      'Menacing and exotic. The ♭2 falls onto the root and the major 3rd makes the home chord major — at home in metal and flamenco.',
    signatureNote:
      'The major 3rd. Played ♭2 → 3 it is the step and a half that gives the scale its sound; over the I chord it makes it major.',
    avoid:
      'Letting the ♭2 sit over the I chord — move it down to the root. And catch Phrygian muscle memory flattening the 3rd.',
    compare:
      'Phrygian with the 3rd raised. The same notes as harmonic minor, started from its 5th.',
    progressions: [
      { degrees: [1], use: 'Vamp on the I. Let the ♭2 fall to 1, and lean on the 3rd.' },
      { degrees: [1, 2], use: 'The half-step move up to ♭II and back.' },
      {
        degrees: [4, 2, 1],
        use: 'Fall iv–♭II–I; let the ♭2 drop onto the root as the I arrives.',
      },
    ],
  },
  'melodic-minor': {
    summary: 'Minor with a raised 6th and 7th — major with a flat 3rd.',
    soundsLike:
      'Minor, but smooth and bright on top: from the 5th up it runs like a major scale.',
    signatureNote:
      'The natural 6th. It separates melodic minor from harmonic minor; play 5–6–7–1 to hear the major-scale climb into the root.',
    avoid:
      'Reaching for natural minor’s ♭6 out of habit. And the 7th wants to resolve up — don’t hold it over the i chord.',
    compare:
      'Dorian with the 7th raised; harmonic minor with the 6th raised; Ionian with the 3rd lowered. Played the same up and down here.',
    progressions: [{ degrees: [1], use: 'Vamp on the i. Lean on the 6th and 7th.' }],
  },
};

export function modeCharacter(km: Pick<KeyMode, 'scale' | 'mode'>): ModeCharacter {
  return MODE_CHARACTER[characterId(km)];
}

/**
 * The key's go-to progressions: its own, or its parent mode's for a pentatonic.
 * Blues has its own 12-bars although its chords are Aeolian's.
 */
export function progressionsFor(km: KeyMode): { degrees: DegreeNumber[]; use: string }[] {
  return modeCharacter(km).progressions ?? modeCharacter(harmonyOf(km)).progressions ?? [];
}
