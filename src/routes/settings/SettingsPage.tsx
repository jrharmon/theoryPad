import { useEffect, useRef, useState } from 'react';
import {
  applyImport,
  type Appearance,
  type VoiceId,
  db,
  exportData,
  parseExport,
  planImport,
  type ImportMode,
  type ImportSummary,
  type TheoryPadExport,
} from '@/data';
import type { MetronomeVoiceId } from '@/domain/drums';
import { OFFERED_INSTRUMENTS } from '@/domain/instrument';
import type { Chroma, ModeId, NoteName, ScaleId } from '@/domain/music';
import {
  MODE_NAMES,
  SCALE_IDS,
  SHAPE_IDS,
  modeTitle,
  noteName,
  preferredTonic,
  scaleTitle,
} from '@/domain/music';
import { ZOOM_MAX, ZOOM_MIN } from '@/components/music/tabLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Kicker } from '@/components/ui/kicker';
import { SegmentedControl, ToggleButton } from '@/components/ui/toggle-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';
import { downloadFile } from '@/lib/download';
import { metronomeChoices } from '../practice/metronomeChoices';
import { clampZoom, nudgeTabZoom } from '../practice/tabZoom';
import { BackingTracksSection } from './BackingTracksSection';

export function SettingsPage() {
  const { settings, reload, save } = useSettings();

  // Every visit reads the stored row again: settings changed in another tab
  // were otherwise invisible here until the page was refreshed.
  useEffect(() => {
    void reload();
  }, [reload]);

  const { audio, ui, instrument, practice } = settings;

  const setVolume = (db: number) => {
    void save({ audio: { ...audio, masterVolumeDb: db } });
    // Heard straight away if the engine is already running; applied on the
    // next Play otherwise.
    void import('@/audio').then(({ getAudioEngine }) => getAudioEngine().setMasterVolume(db));
  };

  return (
    <section className="pb-16">
      <div className="px-8 py-7">
        <Kicker accent>Preferences</Kicker>
        <h1>Settings</h1>
      </div>

      <Section title="Instrument">
        <Field
          label="Tuning"
          htmlFor="instrument"
          hint="Every exercise works it out from the tuning — shapes, string sets and positions."
        >
          <Select
            value={instrument.id}
            onValueChange={(id) => {
              const next = OFFERED_INSTRUMENTS.find((i) => i.id === id);
              if (next) void save({ instrument: next });
            }}
          >
            <SelectTrigger id="instrument" aria-label="Tuning" className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OFFERED_INSTRUMENTS.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Sound">
        <InstrumentRow voice={audio.voice} volumeDb={audio.masterVolumeDb} />
        <Row
          label="Metronome"
          hint="For an exercise that hasn’t chosen its own. A beat written for 4/4 plays Simple in any other time."
        >
          <Select
            // A beat that is no longer offered plays Simple, so say so.
            value={
              metronomeChoices(null).some((c) => c.id === audio.metronome)
                ? audio.metronome
                : 'drums-simple'
            }
            onValueChange={(id) =>
              void save({ audio: { ...audio, metronome: id as MetronomeVoiceId } })
            }
          >
            <SelectTrigger aria-label="Metronome" className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {metronomeChoices(null).map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>
                  {choice.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        {/* The count-in belongs to each exercise now, and is set from its transport. */}
        <Row label="Volume" hint="The notes and the metronome together.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="Volume"
              min={-30}
              max={6}
              step={1}
              value={audio.masterVolumeDb}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-[220px] accent-[var(--color-accent)]"
            />
            <span className="w-14 text-body-sm tabular-nums text-ink-muted">
              {audio.masterVolumeDb > 0 ? '+' : ''}
              {audio.masterVolumeDb} dB
            </span>
          </div>
        </Row>
        <Row label="Credits">
          {/* Two of the sample sets are CC-BY: crediting them is the licence, not politeness. */}
          <p className="text-body-sm text-ink-muted">
            Piano: Salamander Grand Piano by Alexander Holm. Guitar: FluidR3_GM by Frank Wen.
            Both <span className="whitespace-nowrap">CC-BY 3.0</span>. Drums: Sonic Pi&rsquo;s
            samples, CC0.{' '}
            <a
              href={`${import.meta.env.BASE_URL}samples/v1/CREDITS.md`}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              Full credits
            </a>
          </p>
        </Row>
      </Section>

      <Section title="Keys and modes">
        <p className="text-body-sm text-ink-muted">
          Strike out any you don&rsquo;t want to practice. They never come up when a key, scale
          or mode is rolled, in any exercise or routine. One you pin or hold on purpose still
          plays.
        </p>
        <Row label="Keys" hint="By pitch: striking out Db strikes out C# too.">
          <Blockable
            label="Keys"
            options={KEYS.map((k) => ({ id: k, label: k }))}
            blocked={practice.blockedKeys ?? []}
            onChange={(blockedKeys) => void save({ practice: { ...practice, blockedKeys } })}
          />
        </Row>
        <Row
          label="Scales"
          hint="Harmonic minor, Phrygian dominant and melodic minor start struck out."
        >
          <Blockable
            label="Scales"
            options={SCALE_IDS.map((s) => ({ id: s, label: scaleTitle(s) }))}
            blocked={practice.blockedScales ?? []}
            onChange={(blocked) =>
              void save({ practice: { ...practice, blockedScales: blocked as ScaleId[] } })
            }
          />
        </Row>
        <Row label="Modes" hint="Of the Major scale.">
          <Blockable
            label="Modes"
            options={MODE_NAMES.map((m) => ({ id: m, label: modeTitle(m) }))}
            blocked={(practice.blockedModes ?? []).filter((m) => !m.startsWith('shape-'))}
            onChange={(blocked) =>
              void save({
                practice: {
                  ...practice,
                  blockedModes: [
                    ...(practice.blockedModes ?? []).filter((m) => m.startsWith('shape-')),
                    ...(blocked as ModeId[]),
                  ],
                },
              })
            }
          />
        </Row>
        <Row
          label="Shapes"
          hint="Of the pentatonic and blues scales. Struck out for all three at once."
        >
          <Blockable
            label="Shapes"
            options={SHAPE_IDS.map((m) => ({ id: m, label: modeTitle(m) }))}
            blocked={(practice.blockedModes ?? []).filter((m) => m.startsWith('shape-'))}
            onChange={(blocked) =>
              void save({
                practice: {
                  ...practice,
                  blockedModes: [
                    ...(practice.blockedModes ?? []).filter((m) => !m.startsWith('shape-')),
                    ...(blocked as ModeId[]),
                  ],
                },
              })
            }
          />
        </Row>
      </Section>

      <Section title="Display">
        <Row label="Appearance" hint="System follows your computer's light or dark setting.">
          <AppearanceChoice
            value={ui.appearance}
            onChange={(appearance) => void save({ ui: { ...ui, appearance } })}
          />
        </Row>
        <Row
          label="Neck diagram"
          hint="Beside the tab while practicing. Minimize it there, or here, to give the tab the room."
        >
          <OnOff
            on={ui.showNeck}
            label="Neck diagram"
            onChange={(on) => void save({ ui: { ...ui, showNeck: on } })}
          />
        </Row>
        <Row
          label="Circle of fifths"
          hint="Under the neck while practicing, marking the key and its chords. Minimize it there, or here."
        >
          <OnOff
            on={ui.showCircle ?? true}
            label="Circle of fifths"
            onChange={(on) => void save({ ui: { ...ui, showCircle: on } })}
          />
        </Row>
        <Row label="Tab size" hint="Also - and = while practicing.">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Smaller"
              disabled={clampZoom(ui.tabZoom) <= ZOOM_MIN}
              onClick={() => nudgeTabZoom(-1)}
            >
              −
            </Button>
            <span className="w-16 text-center text-body-sm tabular-nums">
              {ui.tabZoom === 0 ? 'Default' : ui.tabZoom > 0 ? `+${ui.tabZoom}` : ui.tabZoom}
            </span>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Bigger"
              disabled={clampZoom(ui.tabZoom) >= ZOOM_MAX}
              onClick={() => nudgeTabZoom(1)}
            >
              +
            </Button>
          </div>
        </Row>
      </Section>

      <BackingTracksSection />

      <DataSection />
    </section>
  );
}

const VOICES: { id: VoiceId; label: string }[] = [
  { id: 'synth', label: 'Synth' },
  { id: 'piano', label: 'Piano' },
  { id: 'guitar', label: 'Guitar' },
];

/** maj7 then dom7: the difference ear training needs, and the proof that chords sound. */
const HEAR_CHORDS: NoteName[][] = [
  ['C3', 'E3', 'G3', 'B3', 'E4'],
  ['C3', 'E3', 'G3', 'Bb3', 'E4'],
].map((chord) => chord.map(noteName));

/** What the notes play on, and a chord through it. */
function InstrumentRow({ voice, volumeDb }: { voice: VoiceId; volumeDb: number }) {
  const save = useSettings((s) => s.save);
  const status = useSounds((s) => s.status);
  const [hearing, setHearing] = useState(false);

  // Tone, not the samples: ready before "hear it" is clicked, so the click
  // still counts as the gesture that starts audio.
  useEffect(() => {
    void import('@/audio');
  }, []);

  const choose = (id: VoiceId) => {
    const { audio } = useSettings.getState().settings;
    void save({ audio: { ...audio, voice: id } });
    void useSounds.getState().choose(id);
  };

  const hear = () => {
    setHearing(true);
    // Choosing the voice already chosen is a no-op; this starts the download
    // if nothing on this visit has yet.
    void useSounds.getState().choose(voice);
    void useSounds
      .getState()
      .hear(HEAR_CHORDS, volumeDb)
      .finally(() => setHearing(false));
  };

  return (
    <Row
      label="Instrument"
      hint={
        status === 'failed'
          ? 'Those sounds didn’t load, so the synth plays instead.'
          : 'What the notes play on. The synth plays while samples load.'
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl label="Instrument" value={voice} options={VOICES} onChange={choose} />
        <Button variant="secondary" size="sm" onClick={hear} disabled={hearing}>
          {hearing && status === 'loading' ? 'Loading…' : 'Hear it'}
        </Button>
      </div>
    </Row>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sheet mx-8 mb-4 px-6 py-5">
      <Kicker>{title}</Kicker>
      <div className="mt-3 max-w-[760px] space-y-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4">
      <div>
        <p className="text-body-sm font-semibold">{label}</p>
        {hint && <p className="text-meta text-ink-muted">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/** System, Light or Dark, as one joined pill. The theme changes as soon as you choose. */
function AppearanceChoice({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
}) {
  return (
    <SegmentedControl
      label="Appearance"
      value={value}
      options={APPEARANCES.map((option) => ({ id: option.id, label: option.label }))}
      onChange={onChange}
      attached
      quietOff
    />
  );
}

/** The twelve keys, spelled as majors — how the policy editor offers them too. */
const KEYS = Array.from({ length: 12 }, (_, c) => preferredTonic(c as Chroma, 'ionian'));

/**
 * A row of chips, each in or struck out. The last one in can't be struck out:
 * rolling from nothing is not a roll.
 */
function Blockable({
  label,
  options,
  blocked,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  blocked: readonly string[];
  onChange: (blocked: string[]) => void;
}) {
  const open = options.filter((o) => !blocked.includes(o.id)).length;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => {
        const on = !blocked.includes(o.id);
        return (
          <Button
            key={o.id}
            size="xs"
            variant={on ? 'secondary' : 'ghost'}
            className={on ? '' : 'text-ink-disabled line-through'}
            aria-pressed={on}
            disabled={on && open === 1}
            onClick={() =>
              onChange(on ? [...blocked, o.id] : blocked.filter((b) => b !== o.id))
            }
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}

function OnOff({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <ToggleButton on={on} quietOff aria-label={label} onClick={() => onChange(!on)}>
      {on ? 'On' : 'Off'}
    </ToggleButton>
  );
}

/** Backup, and moving between devices. */
function DataSection() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{
    file: TheoryPadExport;
    merge: ImportSummary;
    replace: ImportSummary;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    const data = await exportData(db());
    downloadFile(
      `theorypad-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    );
  };

  const choose = async (picked: File | undefined) => {
    setError(null);
    if (!picked) return;
    try {
      const file = parseExport(JSON.parse(await picked.text()));
      setPending({
        file,
        merge: await planImport(db(), file, 'merge'),
        replace: await planImport(db(), file, 'replace'),
      });
    } catch (e) {
      setError(e instanceof SyntaxError ? 'That file is not JSON.' : (e as Error).message);
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const commit = async (mode: ImportMode) => {
    if (!pending) return;
    await applyImport(db(), pending.file, mode);
    // Every screen read the old data; a reload is the honest way to show the new.
    window.location.reload();
  };

  return (
    <Section title="Your data">
      <p className="text-body-sm text-ink-muted">
        Everything lives in this browser. Export to back it up or move it to another device.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void download()}>
          Export
        </Button>
        <Button variant="secondary" onClick={() => input.current?.click()}>
          Import…
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-file"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-body-sm text-destructive">{error}</p>}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        {pending && (
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Import</DialogTitle>
              <DialogDescription>
                Exported {new Date(pending.file.exportedAt).toLocaleString()}. Nothing is
                changed until you choose.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-body-sm">
              <div>
                <p className="font-semibold">Merge — keeps whichever copy was changed last</p>
                <p className="text-ink-muted" data-testid="merge-summary">
                  {describe(pending.merge)}
                </p>
              </div>
              <div>
                <p className="font-semibold">Replace — this browser becomes exactly the file</p>
                <p className="text-ink-muted" data-testid="replace-summary">
                  {describe(pending.replace)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => void commit('replace')}>
                Replace
              </Button>
              <Button onClick={() => void commit('merge')}>Merge</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Section>
  );
}

/** "Adds 3 exercises and 428 passes, updates 1 routine." */
function describe(summary: ImportSummary): string {
  const parts: string[] = [];
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const tables = [
    ['exercises', 'exercise', 'exercises'],
    ['routines', 'routine', 'routines'],
    ['sessions', 'session', 'sessions'],
    ['reps', 'logged pass', 'logged passes'],
    ['videos', 'video', 'videos'],
  ] as const;
  for (const verb of ['added', 'updated', 'removed'] as const) {
    const items = tables
      .filter(([t]) => summary[t][verb] > 0)
      .map(([t, one, many]) => count(summary[t][verb], one, many));
    if (items.length > 0)
      parts.push(
        `${verb === 'added' ? 'Adds' : verb === 'updated' ? 'updates' : 'removes'} ${items.join(', ')}`,
      );
  }
  if (summary.settings === 'replaced') parts.push('takes its settings');
  return parts.length === 0 ? 'Nothing would change.' : `${parts.join('; ')}.`;
}
