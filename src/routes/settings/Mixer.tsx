import { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, PlayIcon, SquareIcon } from 'lucide-react';
import type { MetronomeVoiceId } from '@/domain/drums';
import { LEVEL_MIN, levelMax, type Level, type Mix, type MixChannel } from '@/domain/mix';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/toggle-button';
import { useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';

/** Under Master, shown when the mixer is opened out. */
const CHANNELS: { id: Exclude<MixChannel, 'master'>; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'metronome', label: 'Metronome' },
  { id: 'generated', label: 'Generated' },
  { id: 'video', label: 'Video track' },
];

/** The fader's bottom step, one below the quietest level, is Off. */
const OFF_POSITION = LEVEL_MIN - 1;

/** One scale for every fader, so 0 dB lines up — the video's just stops there. */
const PX_PER_DB = 6;

type PreviewBeat = 'click' | 'drums';

function formatLevel(level: Level): string {
  if (level === null) return 'Off';
  return `${level > 0 ? '+' : ''}${level} dB`;
}

/**
 * Master, opening out to a fader per channel, and a loop to hear them against.
 * Each move is saved and heard at once — through the preview, or whatever is
 * playing.
 */
export function Mixer({ mix, metronome }: { mix: Mix; metronome: MetronomeVoiceId }) {
  const previewing = useSounds((s) => s.previewing);
  const [open, setOpen] = useState(false);
  // The drums are the default beat, or Simple when the default is the click.
  const drums: MetronomeVoiceId = metronome.startsWith('drums-') ? metronome : 'drums-simple';
  const [beat, setBeat] = useState<PreviewBeat>(
    metronome.startsWith('drums-') ? 'drums' : 'click',
  );
  const beatVoice = (b: PreviewBeat): MetronomeVoiceId => (b === 'drums' ? drums : 'click');

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
    else void sounds.startPreview(mix, beatVoice(beat));
  };

  const chooseBeat = (b: PreviewBeat) => {
    setBeat(b);
    useSounds.getState().setPreviewMetronome(beatVoice(b));
  };

  const fader = (id: MixChannel, label: string, extra?: React.ReactNode) => {
    const level = mix[id];
    return (
      <div key={id} className="grid grid-cols-[96px_222px_56px_auto] items-center gap-3">
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
        <span className="text-body-sm tabular-nums text-ink-muted">{formatLevel(level)}</span>
        {extra}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {fader(
        'master',
        'Master',
        <Button
          variant="ghost"
          size="xs"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="justify-self-start"
        >
          Channels
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>,
      )}
      {open && CHANNELS.map(({ id, label }) => fader(id, label))}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="secondary" size="sm" onClick={togglePreview}>
          {previewing ? <SquareIcon /> : <PlayIcon />}
          {previewing ? 'Stop' : 'Preview'}
        </Button>
        <SegmentedControl
          label="Preview metronome"
          value={beat}
          options={[
            { id: 'click', label: 'Click' },
            { id: 'drums', label: 'Drums' },
          ]}
          onChange={chooseBeat}
          attached
          quietOff
        />
      </div>
    </div>
  );
}
