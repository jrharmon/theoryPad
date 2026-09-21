import type { ChordFunction, KeyMode } from '@/domain/music';
import {
  chordOnDegree,
  diatonicChords,
  modeCharacter,
  modeTitle,
  romanNumeral,
  scaleDegrees,
  scaleNotes,
  signatureDegree,
} from '@/domain/music';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { cn } from 'cn';

const FUNCTION_LABEL: Record<ChordFunction, string> = {
  tonic: 'Tonic',
  subdominant: 'Subdominant',
  dominant: 'Dominant',
};

function Notes({ keyMode, size }: { keyMode: KeyMode; size: 'full' | 'compact' }) {
  const notes = scaleNotes(keyMode);
  const degrees = scaleDegrees(keyMode);
  const signature = signatureDegree(keyMode).number;
  return (
    <div className="grid grid-cols-7 border-y border-rule" data-testid="key-mode-notes">
      {notes.map((note, i) => {
        const isSignature = degrees[i]!.number === signature;
        return (
          <div
            key={note}
            className={cn('px-1 py-2 text-center', i > 0 && 'border-l border-rule')}
            data-signature={isSignature || undefined}
          >
            <p
              className={cn(
                'font-extrabold',
                size === 'full' ? 'text-headline' : 'text-lead',
                isSignature && 'text-accent',
              )}
            >
              {note}
            </p>
            <p
              className={cn(
                'tabular text-caption',
                isSignature ? 'text-accent' : 'text-ink-muted',
              )}
            >
              {degrees[i]!.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Prose({ label, children }: { label: string; children: string }) {
  return (
    <div className="border-b border-rule py-3">
      <Kicker>{label}</Kicker>
      <p className="mt-1 text-body-sm leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * Everything worth knowing about a key and mode: its notes, its chords, where
 * they pull, and how to use it. All computed from the key — only the prose is
 * written, once per mode.
 *
 * `compact` is the popover beside a running exercise: notes, triads, one line.
 * `full` is the drawer and the explorer's side panel.
 */
export function KeyModeView({
  keyMode,
  variant,
  onFullView,
  className,
}: {
  keyMode: KeyMode;
  variant: 'full' | 'compact';
  /** Compact only: open the full view. */
  onFullView?: () => void;
  className?: string;
}) {
  const character = modeCharacter(keyMode.mode);
  const chords = diatonicChords(keyMode);
  const name = `${keyMode.tonic} ${modeTitle(keyMode.mode)}`;

  if (variant === 'compact') {
    return (
      <div className={cn('w-[360px]', className)} data-testid="key-mode-compact">
        <p className="text-title font-extrabold">{name}</p>
        <p className="mb-3 text-body-sm text-ink-muted">{character.summary}</p>
        <Notes keyMode={keyMode} size="compact" />
        <div className="grid grid-cols-7 border-b border-rule">
          {chords.map((chord, i) => (
            <div
              key={chord.root}
              className={cn('px-1 py-2 text-center', i > 0 && 'border-l border-rule')}
            >
              <p className="tabular text-caption text-ink-muted">{romanNumeral(chord)}</p>
              <p className="text-body-sm font-bold">{chord.triadSymbol}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-caption text-ink-faint">K to close</span>
          {onFullView && (
            <Button size="sm" variant="secondary" onClick={onFullView}>
              Full view
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="key-mode-full">
      <Kicker accent>Key &amp; mode</Kicker>
      <p className="text-display font-extrabold leading-tight">{name}</p>
      <p className="mb-4 text-body-sm text-ink-muted">{character.summary}</p>

      <Notes keyMode={keyMode} size="full" />

      <Kicker className="mt-6 block">Chords</Kicker>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full border-collapse text-left text-body-sm">
          <thead>
            <tr className="border-b-(length:--rule-section-w) border-divider">
              {['', 'Triad', '7th', '9th', 'Family'].map((h) => (
                <th key={h} className="kicker py-1.5 pr-4 font-normal text-ink-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chords.map((chord) => (
              <tr
                key={chord.root}
                className="border-b border-rule"
                data-function={chord.function}
              >
                <td className="tabular py-1.5 pr-4 pl-1 text-ink-muted">
                  {romanNumeral(chord)}
                </td>
                <td className="py-1.5 pr-4 font-bold">{chord.triadSymbol}</td>
                <td className="py-1.5 pr-4">{chord.seventhSymbol}</td>
                <td className="py-1.5 pr-4">{chord.ninthSymbol ?? '—'}</td>
                <td className="py-1.5 pr-4 text-ink-muted">{FUNCTION_LABEL[chord.function]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Kicker className="mt-6 block">Go-to progressions</Kicker>
      <ul className="mt-1">
        {character.progressions.map((progression) => (
          <li key={progression.degrees.join('-')} className="border-b border-rule py-2.5">
            <p className="text-body">
              <span className="font-bold">
                {progression.degrees
                  .map((d) => romanNumeral(chordOnDegree(keyMode, d)))
                  .join(' – ')}
              </span>
              <span className="ml-3 text-ink-muted">
                {progression.degrees
                  .map((d) => chordOnDegree(keyMode, d).triadSymbol)
                  .join(' – ')}
              </span>
            </p>
            <p className="text-body-sm text-ink-muted">{progression.use}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <Prose label="What it sounds like">{character.soundsLike}</Prose>
        <Prose label={`Signature note · ${signatureDegree(keyMode).label}`}>
          {character.signatureNote}
        </Prose>
        <Prose label="Steer round">{character.avoid}</Prose>
        <Prose label="Compared">{character.compare}</Prose>
      </div>
    </div>
  );
}
