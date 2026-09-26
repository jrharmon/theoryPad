import { useState } from 'react';
import {
  COMPS,
  compById,
  formatProgression,
  backingChord,
  parseProgression,
  type GeneratedBackingSettings,
  type Progression,
} from '@/domain/backing';
import { keyModeName, modeTitle, pitchClass, romanNumeral } from '@/domain/music';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/toggle-button';
import type { ChordContext } from './chordContext';

type SourceKind = GeneratedBackingSettings['source']['kind'];

const SOURCES: { id: SourceKind; label: string }[] = [
  { id: 'vamp', label: 'Vamp on 1' },
  { id: 'goTo', label: 'Go-to' },
  { id: 'custom', label: 'Custom' },
];

const SOURCE_HINTS: Record<SourceKind, string> = {
  vamp: 'The tonic chord only: hear the mode.',
  goTo: 'One of the mode’s go-to progressions, picked each roll.',
  custom: 'Your own. With more than one, each roll picks one.',
};

const CHORDS: { id: GeneratedBackingSettings['chords']; label: string }[] = [
  { id: 'sevenths', label: '7ths' },
  { id: 'triads', label: 'Triads' },
];

/** Where a first custom progression starts: something that already plays. */
const STARTER = '1 4 5 1';

interface Draft {
  kind: SourceKind;
  /** The custom lists as typed, a line each — kept while one doesn't parse. */
  texts: string[];
}

function draftFrom(settings: GeneratedBackingSettings): Draft {
  const { source } = settings;
  return {
    kind: source.kind,
    texts: source.kind === 'custom' ? source.progressions.map(formatProgression) : [STARTER],
  };
}

/**
 * The generated backing's settings: where its progression comes from, the
 * comping style, and 7ths or triads. A change is reported only when every
 * custom list parses, so a half-typed one never reaches the backing; until
 * then it stays here, with what is wrong under it. An empty line is left out.
 *
 * It keeps its own state from `initial` on, because a save can land after the
 * next click: following the saved value back would flick the pills and drop
 * quick changes. A parent that changes the settings some other way — a reset —
 * remounts it with a new `key`.
 */
export function GeneratedBackingEditor({
  initial,
  chordsIn,
  onChange,
}: {
  initial: GeneratedBackingSettings;
  chordsIn: ChordContext;
  onChange: (settings: GeneratedBackingSettings) => void;
}) {
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));

  const report = (next: GeneratedBackingSettings) => {
    // An empty line added or cleared changes nothing worth saving.
    if (JSON.stringify(next) === JSON.stringify(value)) return;
    setValue(next);
    onChange(next);
  };

  const parsed = draft.texts.map(parseProgression);
  const edit = (next: Draft) => {
    setDraft(next);
    if (next.kind !== 'custom') {
      report({ ...value, source: { kind: next.kind } });
      return;
    }
    const lists = next.texts.filter((t) => t.trim() !== '').map(parseProgression);
    const progressions = lists.flatMap((p) => (p.ok ? [p.progression] : []));
    if (progressions.length > 0 && progressions.length === lists.length) {
      report({ ...value, source: { kind: 'custom', progressions } });
    }
  };

  const style = compById(value.style);

  return (
    <div className="space-y-4">
      <Field label="Progression">
        <SegmentedControl
          label="Progression"
          value={draft.kind}
          options={SOURCES}
          onChange={(kind) => edit({ ...draft, kind })}
        />
        <p className="mt-1 text-caption text-ink-faint">{SOURCE_HINTS[draft.kind]}</p>
      </Field>

      {draft.kind === 'custom' && (
        <div className="max-w-sm space-y-2" data-testid="custom-progressions">
          {draft.texts.map((text, i) => {
            const result = parsed[i]!;
            return (
              <div key={i}>
                <div className="flex items-center gap-1">
                  <Input
                    aria-label={`Progression ${i + 1}`}
                    aria-invalid={!result.ok && text.trim() !== ''}
                    placeholder="2 5 1"
                    className="num"
                    value={text}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      edit({
                        ...draft,
                        texts: draft.texts.map((t, j) => (j === i ? e.target.value : t)),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove progression ${i + 1}`}
                    // At least one: an empty Custom is what Vamp is for.
                    disabled={draft.texts.length === 1}
                    onClick={() =>
                      edit({ ...draft, texts: draft.texts.filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </Button>
                </div>
                {result.ok ? (
                  <p className="mt-1 num text-meta text-ink-muted">
                    {chordNames(result.progression, chordsIn, value.chords)}
                  </p>
                ) : (
                  text.trim() !== '' && (
                    <p className="mt-1 text-meta text-destructive">{result.error}</p>
                  )
                )}
              </div>
            );
          })}
          <Button
            variant="secondary"
            size="xs"
            onClick={() => edit({ ...draft, texts: [...draft.texts, ''] })}
          >
            Add a progression
          </Button>
          <p className="text-caption text-ink-faint">
            Degrees 1–7 with spaces between; <span className="num">*2</span> holds one for two
            bars. {contextNote(chordsIn)}
          </p>
        </div>
      )}

      <Field label="Style">
        <SegmentedControl
          label="Style"
          value={style.id}
          options={COMPS.map((c) => ({ id: c.id, label: c.name }))}
          onChange={(next) => report({ ...value, style: next })}
        />
        <p className="mt-1 text-caption text-ink-faint">{style.detail}</p>
      </Field>

      <Field label="Chords">
        <SegmentedControl
          label="Chords"
          attached
          value={value.chords}
          options={CHORDS}
          onChange={(chords) => report({ ...value, chords })}
        />
      </Field>
    </div>
  );
}

/** "Dm7 – G7 – Cmaj7 ×2" in the rolled key, or "ii – V – I ×2" where none is. */
function chordNames(
  progression: Progression,
  context: ChordContext,
  chords: GeneratedBackingSettings['chords'],
): string {
  const keyMode =
    'keyMode' in context
      ? context.keyMode
      : { tonic: pitchClass('C'), scale: 'major' as const, mode: context.mode ?? 'ionian' };
  return progression
    .map(({ degree, bars }) => {
      const chord = backingChord(keyMode, degree);
      const name =
        'keyMode' in context
          ? chords === 'triads'
            ? chord.triadSymbol
            : chord.seventhSymbol
          : romanNumeral(chord);
      return bars > 1 ? `${name} ×${bars}` : name;
    })
    .join(' – ');
}

/** Which key or mode the chords under each list are in. */
function contextNote(context: ChordContext): string {
  if ('keyMode' in context) {
    return `In ${keyModeName(context.keyMode)}, this roll’s key.`;
  }
  if (context.mode) return `Numerals in ${modeTitle(context.mode)}.`;
  return 'Numerals in Ionian; the mode is rolled.';
}
