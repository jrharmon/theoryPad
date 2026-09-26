import { useEffect } from 'react';
import { PlayIcon, SquareIcon } from 'lucide-react';
import type { MetronomeVoiceId } from '@/domain/drums';
import { LEVEL_MIN, levelMax, type Level, type Mix, type MixChannel } from '@/domain/mix';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';

const CHANNELS: { id: MixChannel; label: string }[] = [
  { id: 'master', label: 'Master' },
  { id: 'notes', label: 'Notes' },
  { id: 'metronome', label: 'Metronome' },
  { id: 'generated', label: 'Generated' },
  { id: 'video', label: 'Video track' },
];

/** The fader's bottom step, one below the quietest level, is Off. */
const OFF_POSITION = LEVEL_MIN - 1;

/** One scale for every fader, so 0 dB lines up — the video's just stops there. */
const PX_PER_DB = 6;

function formatLevel(level: Level): string {
  if (level === null) return 'Off';
  return `${level > 0 ? '+' : ''}${level} dB`;
}

/**
 * A fader per channel, and a loop to hear them against. Each move is saved and
 * heard at once — through the preview, or whatever is playing.
 */
export function Mixer({ mix, metronome }: { mix: Mix; metronome: MetronomeVoiceId }) {
  const previewing = useSounds((s) => s.previewing);

  // The preview is Settings' own: leaving the page stops it.
  useEffect(() => () => useSounds.getState().stopPreview(), []);

  const setLevel = (channel: MixChannel, level: Level) => {
    const { settings, save } = useSettings.getState();
    const next = { ...settings.audio.mix, [channel]: level };
    void save({ audio: { ...settings.audio, mix: next } });
    useSounds.getState().setMix(next);
  };

  const togglePreview = () => {
    const sounds = useSounds.getState();
    if (sounds.previewing) sounds.stopPreview();
    else void sounds.startPreview(mix, metronome);
  };

  return (
    <div className="space-y-2">
      {CHANNELS.map(({ id, label }) => {
        const level = mix[id];
        return (
          <div key={id} className="grid grid-cols-[96px_222px_56px] items-center gap-3">
            <span className="text-body-sm">{label}</span>
            <input
              type="range"
              aria-label={label}
              aria-valuetext={formatLevel(level)}
              min={OFF_POSITION}
              max={levelMax(id)}
              step={1}
              value={level ?? OFF_POSITION}
              onChange={(e) => {
                const position = Number(e.target.value);
                setLevel(id, position === OFF_POSITION ? null : position);
              }}
              style={{ width: (levelMax(id) - OFF_POSITION) * PX_PER_DB }}
              className="accent-[var(--color-accent)]"
            />
            <span className="text-body-sm tabular-nums text-ink-muted">
              {formatLevel(level)}
            </span>
          </div>
        );
      })}
      <Button variant="secondary" size="sm" onClick={togglePreview} className="mt-1">
        {previewing ? <SquareIcon /> : <PlayIcon />}
        {previewing ? 'Stop' : 'Preview'}
      </Button>
    </div>
  );
}
