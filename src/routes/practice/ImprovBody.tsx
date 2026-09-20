import type { Instrument } from '@/domain/instrument';
import type { DegreeNumber } from '@/domain/music';
import { noteAtDegree } from '@/domain/music';
import { overlayFretRange } from '@/domain/neck';
import { ticksPerBar } from '@/domain/phrase';
import { ordinal } from '@/exercises/shared';
import { PHRASE_LABEL } from '@/exercises/free-improv-target/definition';
import type { PlayedInstance } from '@/exercises/types';
import { Fretboard } from '@/components/music';
import { Kicker } from '@/components/ui/kicker';
import { cn } from 'cn';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { BackingPanel, ReferencePanel } from './BackingPanel';
import { CircleSheet } from './CircleSheet';
import { InfoColumnToggle } from './SidePanel';
import { usePhraseTick, useVideoColumn } from './usePracticeBody';

/** Where each phrase begins, from the labels on its first bar. */
function phraseShape(instance: PlayedInstance) {
  const starts = instance.phrase.bars
    .filter((bar) => bar.label?.startsWith(PHRASE_LABEL))
    .map((bar) => bar.index);
  const count = Math.max(1, starts.length);
  const length = starts.length > 1 ? starts[1]! - starts[0]! : instance.phrase.bars.length;
  return { count, length: Math.max(1, length) };
}

/**
 * An improvisation: nothing written, so no tab. What matters while playing is
 * which phrase this is, how far through it, and the note to land on — big
 * enough to read from the guitar. The neck shows the whole mode.
 */
export function ImprovBody({
  instance,
  instrument,
}: {
  instance: PlayedInstance;
  instrument: Instrument;
}) {
  const snapshot = usePractice((s) => s.snapshot);
  const state = snapshot?.state;
  const tick = usePhraseTick(state === 'playing');
  const videoColumn = useVideoColumn();
  const showCircle = useSettings((s) => s.settings.ui.showCircle !== false);
  const side = useSettings((s) => s.settings.ui.showInfoColumn !== false);
  if (!snapshot) return null;

  const { count, length } = phraseShape(instance);
  const perBar = ticksPerBar(instance.phrase.timeSignature);
  const running = state === 'playing' || state === 'paused';
  const barIndex = Math.min(count * length - 1, Math.floor(tick / perBar));
  const phrase = running ? Math.floor(barIndex / length) + 1 : null;
  const bar = running ? (barIndex % length) + 1 : null;
  const landing = bar === length;

  const degree = snapshot.variation?.axes.targetScaleDegree?.value as DegreeNumber | undefined;
  const target = degree === undefined ? null : noteAtDegree(snapshot.keyMode, degree);

  return (
    <div
      className={cn(
        'grid gap-6 px-8 py-6',
        side && (videoColumn || showCircle) ? 'lg:grid-cols-[1fr_320px]' : '',
        side && !videoColumn && !showCircle ? 'lg:grid-cols-[1fr_auto]' : '',
      )}
    >
      <div className="min-w-0 space-y-6">
        <div className="sheet grid gap-6 px-6 py-5 sm:grid-cols-2" data-testid="phrase-counter">
          <div>
            <Kicker>{phrase === null ? 'Phrases' : 'Phrase'}</Kicker>
            <p className="num face-title mt-1 text-jumbo leading-none font-extrabold">
              {phrase ?? count}
              {phrase !== null && (
                <span className="text-display text-ink-faint"> of {count}</span>
              )}
            </p>
            <p className="num mt-2 text-lead text-ink-muted">
              {bar === null
                ? state === 'count-in'
                  ? 'Counting in…'
                  : `${length} ${length === 1 ? 'bar' : 'bars'} each`
                : `Bar ${bar} of ${length}`}
            </p>
          </div>
          {target && (
            <div
              // The last bar of a phrase is "you are here": the playhead's yellow.
              className={cn(
                'rounded-[12px] px-5 py-4',
                landing ? 'bg-playhead' : 'bg-ink/[0.03]',
              )}
              data-testid="landing-target"
            >
              <Kicker>{landing ? 'Land it' : 'End each phrase on'}</Kicker>
              <p className="face-title mt-1 text-jumbo leading-none font-extrabold text-accent-text">
                {target}
              </p>
              <p className="mt-2 text-lead text-ink-muted">the {ordinal(degree!)}</p>
            </div>
          )}
        </div>

        <div className="sheet px-5 pt-4 pb-[18px]">
          <div className="flex items-center gap-3">
            <Kicker>The mode on the neck</Kicker>
            <span className="ml-auto">
              <InfoColumnToggle />
            </span>
          </div>
          <div className="mt-2">
            <Fretboard
              instrument={instrument}
              overlay={instance.neck}
              fretRange={overlayFretRange(instance.neck, instrument)}
            />
          </div>
        </div>
      </div>

      {/* Minimized, the circle shrinks to its title rather than leaving the column. */}
      {side && (
        <div className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh_-_7.5rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          <BackingPanel />
          <ReferencePanel />
          <CircleSheet keyMode={snapshot.keyMode} />
        </div>
      )}
    </div>
  );
}
