import { useEffect, useRef, useState } from 'react';
import {
  applyImport,
  type Appearance,
  db,
  exportData,
  parseExport,
  planImport,
  type ImportMode,
  type ImportSummary,
  type TheoryPadExport,
} from '@/data';
import { OFFERED_INSTRUMENTS } from '@/domain/instrument';
import type { Chroma, ModeName } from '@/domain/music';
import { MODE_NAMES, modeTitle, preferredTonic } from '@/domain/music';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/store/settings';
import { downloadFile } from '@/lib/download';
import { clampZoom, nudgeTabZoom } from '../practice/tabZoom';
import { BackingTracksSection } from './BackingTracksSection';

export function SettingsPage() {
  const { settings, load, save } = useSettings();

  useEffect(() => {
    void load();
  }, [load]);

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
        <Row
          label="Metronome"
          hint="On when you open an exercise. The transport can switch it any time."
        >
          <OnOff
            on={audio.metronomeEnabled}
            label="Metronome"
            onChange={(on) => void save({ audio: { ...audio, metronomeEnabled: on } })}
          />
        </Row>
        {/* The count-in belongs to each exercise now, and is set from its transport. */}
        <Row label="Volume" hint="The notes and the click together.">
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
            <span className="w-14 text-[13px] tabular-nums text-ink/64">
              {audio.masterVolumeDb > 0 ? '+' : ''}
              {audio.masterVolumeDb} dB
            </span>
          </div>
        </Row>
      </Section>

      <Section title="Keys and modes">
        <p className="text-[13px] text-ink/64">
          Strike out any you don&rsquo;t want to practice. They never come up when a key or mode
          is rolled, in any exercise or routine. One you pin or hold on purpose still plays.
        </p>
        <Row label="Keys" hint="By pitch: striking out Db strikes out C# too.">
          <Blockable
            label="Keys"
            options={KEYS.map((k) => ({ id: k, label: k }))}
            blocked={practice.blockedKeys ?? []}
            onChange={(blockedKeys) => void save({ practice: { ...practice, blockedKeys } })}
          />
        </Row>
        <Row label="Modes">
          <Blockable
            label="Modes"
            options={MODE_NAMES.map((m) => ({ id: m, label: modeTitle(m) }))}
            blocked={practice.blockedModes ?? []}
            onChange={(blocked) =>
              void save({ practice: { ...practice, blockedModes: blocked as ModeName[] } })
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
            <span className="w-16 text-center text-[13px] tabular-nums">
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
        <p className="text-[14px] font-semibold">{label}</p>
        {hint && <p className="text-[12px] text-ink/64">{hint}</p>}
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
    <div className="flex" role="group" aria-label="Appearance">
      {APPEARANCES.map((option, i) => (
        <Button
          key={option.id}
          size="sm"
          variant="secondary"
          aria-pressed={value === option.id}
          className={[
            'rounded-toggle',
            i > 0 ? '-ml-px rounded-l-none' : '',
            i < APPEARANCES.length - 1 ? 'rounded-r-none' : '',
            value === option.id
              ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85'
              : 'text-toggle-off-ink',
          ].join(' ')}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
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
            className={on ? '' : 'text-ink/35 line-through'}
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
    <Button
      size="sm"
      variant="secondary"
      aria-label={label}
      aria-pressed={on}
      className={`rounded-toggle ${on ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85' : 'text-toggle-off-ink'}`}
      onClick={() => onChange(!on)}
    >
      {on ? 'On' : 'Off'}
    </Button>
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
      <p className="text-[13px] text-ink/64">
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
      {error && <p className="text-[13px] text-destructive">{error}</p>}

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
            <div className="space-y-4 text-[13px]">
              <div>
                <p className="font-semibold">Merge — keeps whichever copy was changed last</p>
                <p className="text-ink/64" data-testid="merge-summary">
                  {describe(pending.merge)}
                </p>
              </div>
              <div>
                <p className="font-semibold">Replace — this browser becomes exactly the file</p>
                <p className="text-ink/64" data-testid="replace-summary">
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
