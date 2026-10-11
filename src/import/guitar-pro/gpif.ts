import type { Bend, HarmonicKind, Technique } from '@/domain/phrase';
import type {
  GpBeat,
  GpMasterBar,
  GpNote,
  GpNoteValue,
  GpRhythm,
  GpScore,
  GpTempo,
  GpTrack,
} from '@/domain/phrase/import';

/**
 * GPIF — the score's XML — into a `GpScore`.
 *
 * GPIF is a set of flat tables that refer to each other by id: master bars
 * name a bar per track, a bar names voices, a voice beats, a beat notes and a
 * rhythm. Ids are shared: one beat or note can be used many times, so they
 * are definitions, read once and referred to.
 */
export function parseGpif(xml: string): GpScore {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'GPIF') throw new Error('The score inside the file could not be read.');

  const table = (section: string, tag: string) =>
    new Map(children(child(root, section), tag).map((el) => [el.getAttribute('id') ?? '', el]));
  const rhythms = table('Rhythms', 'Rhythm');
  const notes = table('Notes', 'Note');
  const beats = table('Beats', 'Beat');
  const voices = table('Voices', 'Voice');
  const bars = table('Bars', 'Bar');

  const noteCache = new Map<string, GpNote>();
  const readNoteById = (id: string): GpNote | null => {
    const cached = noteCache.get(id);
    if (cached) return cached;
    const el = notes.get(id);
    if (!el) return null;
    const note = readNote(el);
    noteCache.set(id, note);
    return note;
  };

  const beatCache = new Map<string, GpBeat>();
  const readBeatById = (id: string): GpBeat | null => {
    const cached = beatCache.get(id);
    if (cached) return cached;
    const el = beats.get(id);
    if (!el) return null;
    const rhythm = rhythms.get(child(el, 'Rhythm')?.getAttribute('ref') ?? '');
    const beat = readBeat(
      el,
      rhythm,
      ids(text(child(el, 'Notes'))).flatMap((n) => readNoteById(n) ?? []),
    );
    beatCache.set(id, beat);
    return beat;
  };

  const masterBarEls = children(child(root, 'MasterBars'), 'MasterBar');
  const trackEls = children(child(root, 'Tracks'), 'Track');

  const tracks: GpTrack[] = trackEls.map((el, trackIndex) => ({
    ...readTrackHead(el),
    bars: masterBarEls.map((masterBar) => {
      const barId = ids(text(child(masterBar, 'Bars')))[trackIndex];
      const bar = barId === undefined ? undefined : bars.get(barId);
      if (!bar) return [];
      return ids(text(child(bar, 'Voices')))
        .filter((v) => v !== '-1')
        .map((v) =>
          ids(text(child(voices.get(v), 'Beats'))).flatMap((b) => readBeatById(b) ?? []),
        );
    }),
  }));

  return {
    title: text(child(child(root, 'Score'), 'Title')).trim(),
    artist: text(child(child(root, 'Score'), 'Artist')).trim(),
    tempos: readTempos(child(root, 'MasterTrack')),
    masterBars: masterBarEls.map(readMasterBar),
    tracks,
  };
}

// --- reading helpers ----------------------------------------------------------

function children(el: Element | undefined, tag?: string): Element[] {
  if (!el) return [];
  return [...el.children].filter((c) => tag === undefined || c.nodeName === tag);
}

function child(el: Element | undefined, tag: string): Element | undefined {
  return children(el, tag)[0];
}

function text(el: Element | undefined): string {
  return el?.textContent ?? '';
}

function ids(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/** A `<Property name="…">` under an element's `<Properties>`. */
function property(el: Element, name: string): Element | undefined {
  return children(child(el, 'Properties'), 'Property').find(
    (p) => p.getAttribute('name') === name,
  );
}

/** A property's single value: `<Property name="Fret"><Fret>5</Fret></Property>` → "5". */
function propertyValue(el: Element, name: string): string | undefined {
  const prop = property(el, name);
  return prop ? text(prop.children[0]).trim() : undefined;
}

function propertyNumber(el: Element, name: string): number | undefined {
  const value = propertyValue(el, name);
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

// --- the parts ----------------------------------------------------------------

/** The beat a tempo is measured in, as the file numbers it, in quarter notes. */
const TEMPO_UNIT: Record<string, number> = { 1: 0.5, 2: 1, 3: 1.5, 4: 2, 5: 3 };

function readTempos(masterTrack: Element | undefined): GpTempo[] {
  return children(child(masterTrack, 'Automations'), 'Automation')
    .filter((a) => text(child(a, 'Type')) === 'Tempo')
    .map((a) => {
      const [bpm = '120', unit = '2'] = ids(text(child(a, 'Value')));
      return {
        bar: Number(text(child(a, 'Bar'))) || 0,
        bpm: Math.round(Number(bpm) * (TEMPO_UNIT[unit] ?? 1)),
      };
    })
    .sort((a, b) => a.bar - b.bar);
}

function readTrackHead(el: Element): Omit<GpTrack, 'bars'> {
  // GP7 keeps tuning and capo under Staves/Staff; GP6 under the track itself.
  const holders = [...el.getElementsByTagName('Properties')];
  const find = (name: string) =>
    holders
      .flatMap((h) => children(h, 'Property'))
      .find((p) => p.getAttribute('name') === name);

  const pitches = ids(text(child(find('Tuning'), 'Pitches'))).map(Number);
  const instrument = text(child(child(el, 'InstrumentSet'), 'Type')).toLowerCase();
  const drums = instrument.includes('drum') || pitches.every((p) => p === 0);
  return {
    name: text(child(el, 'Name')).trim(),
    tuning: drums ? [] : pitches,
    capo: Number(text(child(find('CapoFret'), 'Fret'))) || 0,
  };
}

function readMasterBar(el: Element): GpMasterBar {
  const [beats = 4, unit = 4] = text(child(el, 'Time')).split('/').map(Number);
  const key = child(el, 'Key');
  const repeat = child(el, 'Repeat');
  const section = child(el, 'Section');
  const sectionName = [text(child(section, 'Letter')), text(child(section, 'Text'))]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
  const directions = child(el, 'Directions');
  return {
    time: { beats, unit },
    key: {
      accidentals: Number(text(child(key, 'AccidentalCount'))) || 0,
      minor: text(child(key, 'Mode')) === 'Minor',
    },
    repeatStart: repeat?.getAttribute('start') === 'true',
    repeatEnd:
      repeat?.getAttribute('end') === 'true' ? Number(repeat.getAttribute('count')) || 2 : 0,
    alternateEndings: ids(text(child(el, 'AlternateEndings'))).map(Number),
    ...(sectionName ? { section: sectionName } : {}),
    targets: children(directions, 'Target').map((t) => text(t).trim()),
    jumps: children(directions, 'Jump').map((j) => text(j).trim()),
    unsupported: children(child(el, 'Fermatas'), 'Fermata').length > 0 ? ['fermata'] : [],
  };
}

const NOTE_VALUE: Record<string, GpNoteValue> = {
  Whole: 1,
  Half: 2,
  Quarter: 4,
  Eighth: 8,
  '16th': 16,
  '32nd': 32,
  '64th': 64,
  '128th': 128,
};

function readRhythm(el: Element | undefined): GpRhythm {
  const tuplet = child(el, 'PrimaryTuplet');
  const num = Number(tuplet?.getAttribute('num'));
  const den = Number(tuplet?.getAttribute('den'));
  return {
    value: NOTE_VALUE[text(child(el, 'NoteValue'))] ?? 4,
    dots: Number(child(el, 'AugmentationDot')?.getAttribute('count')) || 0,
    ...(num > 0 && den > 0 && num !== den ? { tuplet: { num, den } } : {}),
  };
}

/** Beat-level things the tab doesn't show, by element. */
const BEAT_UNSUPPORTED: Record<string, string> = {
  Tremolo: 'tremolo picking',
  Hairpin: 'hairpin',
  Ottavia: 'ottava',
  Chord: 'chord name',
  Lyrics: 'lyrics',
  Wah: 'wah',
  Arpeggio: 'arpeggio',
  Fadding: 'volume swell',
};

function readBeat(el: Element, rhythm: Element | undefined, notes: GpNote[]): GpBeat {
  const grace = text(child(el, 'GraceNotes'));
  const stroke = text(child(property(el, 'PickStroke'), 'Direction'));
  const unsupported = children(el).flatMap((c) => BEAT_UNSUPPORTED[c.nodeName] ?? []);
  const dynamic = text(child(el, 'Dynamic'));
  if (dynamic && dynamic !== 'MF') unsupported.push('dynamics');
  if (property(el, 'Brush')) unsupported.push('brush');
  if (property(el, 'Rasgueado')) unsupported.push('rasgueado');
  const whammy = ['WhammyBarOriginValue', 'WhammyBarMiddleValue', 'WhammyBarDestinationValue'];
  if (whammy.some((name) => (propertyNumber(el, name) ?? 0) !== 0)) unsupported.push('whammy');
  const freeText = text(child(el, 'FreeText')).trim();

  return {
    rhythm: readRhythm(rhythm),
    ...(grace === 'BeforeBeat'
      ? { grace: 'before-beat' as const }
      : grace === 'OnBeat'
        ? { grace: 'on-beat' as const }
        : {}),
    ...(stroke === 'Down'
      ? { pickStroke: 'down' as const }
      : stroke === 'Up'
        ? { pickStroke: 'up' as const }
        : {}),
    notes,
    ...(freeText ? { text: freeText } : {}),
    unsupported,
  };
}

const HARMONIC_KIND: Record<string, HarmonicKind> = {
  Natural: 'natural',
  Artificial: 'artificial',
  Pinch: 'pinch',
  Tap: 'tapped',
  Semi: 'semi',
};

/** Accent flags: 1 staccato, 2 staccatissimo, 4 heavy accent, 8 accent, 16 tenuto. */
function accentTechniques(flags: number): Technique[] {
  return [
    ...(flags & (1 | 2) ? (['staccato'] as const) : []),
    ...(flags & (4 | 8) ? (['accent'] as const) : []),
  ];
}

function readNote(el: Element): GpNote {
  const techniques: Technique[] = [];
  const unsupported: string[] = [];
  if (child(el, 'Vibrato')) techniques.push('vibrato');
  if (child(el, 'LetRing')) techniques.push('let-ring');
  if (child(el, 'AntiAccent')) techniques.push('ghost');
  if (property(el, 'PalmMuted')) techniques.push('palm-mute');
  if (property(el, 'Muted')) techniques.push('dead');
  if (property(el, 'Tapped')) techniques.push('tap');
  const accent = Number(text(child(el, 'Accent'))) || 0;
  techniques.push(...accentTechniques(accent));
  if (accent & 16) unsupported.push('tenuto');
  if (child(el, 'Trill')) unsupported.push('trill');
  if (child(el, 'LeftFingering') || child(el, 'RightFingering')) unsupported.push('fingering');
  if (child(el, 'Ornament')) unsupported.push('ornament');
  // Notes entered as notation only carry a pitch, not a place on the neck.
  if (!property(el, 'String')) unsupported.push('no string or fret');

  let harmonic: GpNote['harmonic'];
  if (property(el, 'Harmonic')) {
    const type = propertyValue(el, 'HarmonicType') ?? 'Natural';
    const kind = HARMONIC_KIND[type];
    if (!kind) unsupported.push(`${type.toLowerCase()} harmonic`);
    else if (kind === 'natural') harmonic = { kind };
    else harmonic = { kind, fret: propertyNumber(el, 'HarmonicFret') ?? 12 };
  }

  const tie = child(el, 'Tie');
  return {
    string: propertyNumber(el, 'String') ?? -1,
    fret: propertyNumber(el, 'Fret') ?? 0,
    tied: tie?.getAttribute('destination') === 'true',
    slide: propertyNumber(el, 'Slide') ?? 0,
    hopoDestination: property(el, 'HopoDestination') !== undefined,
    techniques,
    ...(harmonic ? { harmonic } : {}),
    ...(property(el, 'Bended') ? { bend: readBend(el) } : {}),
    unsupported,
  };
}

/**
 * A bend's shape: origin, up to two middle points sharing one value, and a
 * destination. Offsets run 0–100 through the note; values are hundredths of a
 * whole tone, so 100 is a full bend.
 */
function readBend(el: Element): Bend {
  const point = (offset: string, value: string, defaultOffset: number) => {
    const tones = propertyNumber(el, value);
    return tones === undefined
      ? []
      : [{ at: (propertyNumber(el, offset) ?? defaultOffset) / 100, tones: tones / 100 }];
  };
  const points = [
    ...point('BendOriginOffset', 'BendOriginValue', 0),
    ...point('BendMiddleOffset1', 'BendMiddleValue', 50),
    ...(propertyNumber(el, 'BendMiddleOffset2') !== undefined
      ? point('BendMiddleOffset2', 'BendMiddleValue', 50)
      : []),
    ...point('BendDestinationOffset', 'BendDestinationValue', 100),
  ].sort((a, b) => a.at - b.at);
  // The two middle points often coincide: keep one of each.
  return {
    points: points.filter(
      (p, i) => i === 0 || p.at !== points[i - 1]!.at || p.tones !== points[i - 1]!.tones,
    ),
  };
}
