import type { DegreeNumber, ModeName } from './types';

/**
 * What each mode sounds like and how to use it — the one piece of the
 * key/mode reference that is written rather than computed. It is per mode, not
 * per key, so seven entries cover everything.
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
  /** Go-to progressions as scale degrees; the view spells them in the key. */
  progressions: { degrees: DegreeNumber[]; use: string }[];
}

export const MODE_CHARACTER: Record<ModeName, ModeCharacter> = {
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
      { degrees: [1, 7, 6, 7], use: 'Rock between ♭VII and ♭VI; land on ♭6 as the ♭VI arrives.' },
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
      { degrees: [1, 2], use: 'Half-step chords; resolve ♭2 → 1 against the diminished tonic.' },
      { degrees: [1, 4, 2], use: 'Lean on the ♭5 over the i°, the root over the iv.' },
    ],
  },
};

export function modeCharacter(mode: ModeName): ModeCharacter {
  return MODE_CHARACTER[mode];
}

/** "dorian" → "Dorian". */
export function modeTitle(mode: ModeName): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
