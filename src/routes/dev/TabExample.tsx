import type { Instrument } from '@/domain/instrument';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { Phrase } from '@/domain/phrase';
import { phraseSeconds } from '@/domain/phrase';
import { TabStaff } from '@/components/music';
import type { Transport } from './useTransport';

export interface TabExampleProps {
  id: string;
  phrase: Phrase;
  transport: Transport;
  instrument?: Instrument;
  size?: 'compact' | 'large';
  showPickStrokes?: boolean;
}

/**
 * One playable tab example. Every phrase in the gallery gets its own controls,
 * so anything that only shows up in the sound — legato speaking more quietly
 * than picked notes, a sixteenth run at tempo — can actually be heard.
 */
export function TabExample({
  id,
  phrase,
  transport,
  instrument = STANDARD_GUITAR,
  size = 'compact',
  showPickStrokes = false,
}: TabExampleProps) {
  const isActive = transport.activeId === id;
  const isPlaying = isActive && transport.isPlaying;
  const seconds = phraseSeconds(phrase, transport.bpm);
  const passes = phrase.repeat ?? 1;

  // The playhead wraps on a repeat, so without this the second pass looks
  // identical to the first.
  const pass =
    isActive && transport.playheadTick !== null && phrase.totalTicks > 0
      ? Math.min(passes, Math.floor(transport.playheadTick / phrase.totalTicks) + 1)
      : null;

  const onPrimary = () => {
    if (isPlaying) transport.pause();
    else if (isActive) transport.resume();
    else void transport.play(id, phrase);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className={[
            'px-5 py-2 text-[14px] font-semibold',
            isPlaying
              ? 'border border-rule hover:bg-ink/5'
              : 'bg-accent text-on-accent hover:bg-accent-600 active:bg-accent-700',
          ].join(' ')}
        >
          {isPlaying ? 'Pause' : isActive ? 'Resume' : 'Play'}
        </button>

        <button
          type="button"
          onClick={transport.stop}
          disabled={!isActive}
          className="border border-rule px-4 py-2 text-[13px] hover:bg-ink/5 disabled:opacity-45"
        >
          Stop
        </button>

        <span className="text-[12px] text-ink/64 tabular-nums">
          {phrase.bars.length} bars
          {passes > 1 ? ` × ${passes}` : ''} · {seconds.toFixed(1)}s at {transport.bpm} bpm
        </span>

        {pass !== null && passes > 1 && (
          <span className="text-[12px] font-semibold text-accent-text tabular-nums">
            Pass {pass} of {passes}
          </span>
        )}
      </div>

      <TabStaff
        phrase={phrase}
        instrument={instrument}
        size={size}
        showPickStrokes={showPickStrokes}
        playheadTick={isActive ? transport.playheadTick : null}
      />
    </div>
  );
}
