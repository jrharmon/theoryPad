import { useEffect, useMemo, useState } from 'react';
import { tunedInstrument, tuningName } from '@/domain/instrument';
import type { KeyMode, ModeName } from '@/domain/music';
import { MODE_NAMES, midi, modeTitle, noteNameFromMidi, pitchClass } from '@/domain/music';
import type { GpScore } from '@/domain/phrase/import';
import type { WrittenChoice } from './written';
import { importPhrase, playableTracks } from '@/domain/phrase/import';
import { readGuitarPro } from '@/import/guitar-pro';
import { TabStaff } from '@/components/music';
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

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Reading a Guitar Pro file into a written exercise: the file, then the track
 * and bars, the key, and a live tab of what will be made — with what the tab
 * leaves out, or why it can't be made. Used to make one and to replace one's
 * notes. Tells its owner the choice, or null while there is none to make.
 */
export function WrittenImport({
  onChange,
}: {
  onChange: (choice: WrittenChoice | null) => void;
}) {
  const player = useSettings((s) => s.settings.instrument);
  const [file, setFile] = useState<{ name: string; score: GpScore } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [range, setRange] = useState({ track: 0, firstBar: 0, lastBar: 0 });
  const [key, setKey] = useState<KeyMode | null>(null);

  const open = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    try {
      const score = await readGuitarPro(new Uint8Array(await picked.arrayBuffer()));
      const lastBar = score.masterBars.length - 1;
      setFile({ name: picked.name, score });
      setRange({ track: playableTracks(score, 0, lastBar)[0] ?? 0, firstBar: 0, lastBar });
      setKey(null);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const score = file?.score;
  const tracks = useMemo(
    () => (score ? playableTracks(score, range.firstBar, range.lastBar) : []),
    [score, range.firstBar, range.lastBar],
  );
  const track = tracks.includes(range.track) ? range.track : tracks[0];
  const result = useMemo(
    () => (score && track !== undefined ? importPhrase(score, { ...range, track }) : null),
    [score, range, track],
  );
  const imported = result?.ok ? result.value : null;
  // The file's key until another is picked.
  const keyMode = key ?? imported?.keyMode ?? null;

  const choice = useMemo<WrittenChoice | null>(() => {
    if (!file || !score || !imported || !keyMode || track === undefined) return null;
    return {
      imported,
      keyMode,
      source: {
        file: file.name,
        title: score.title || file.name.replace(/\.gpx?$/i, ''),
        track: score.tracks[track]!.name,
        firstBar: range.firstBar + 1,
        lastBar: range.lastBar + 1,
      },
    };
  }, [file, score, imported, keyMode, track, range.firstBar, range.lastBar]);

  useEffect(() => onChange(choice), [choice, onChange]);

  const instrument = useMemo(
    () =>
      imported
        ? tunedInstrument(player, { strings: imported.tuning, capo: imported.capo })
        : player,
    [imported, player],
  );

  const barLabel = (i: number) => {
    const section = score?.masterBars[i]?.section;
    return `${i + 1}${section ? ` · ${section}` : ''}`;
  };
  const tonics =
    keyMode && !TONICS.includes(keyMode.tonic) ? [keyMode.tonic, ...TONICS] : TONICS;

  return (
    <div className="space-y-6">
      <div className="sheet max-w-[900px] space-y-5 p-5">
        <label
          data-testid="written-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void open(e.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-panel border border-dashed px-6 py-6 text-center ${
            dragging ? 'border-accent bg-accent-tint' : 'border-rule'
          }`}
        >
          <span className="text-body font-semibold">
            {file ? file.name : 'Choose a Guitar Pro file'}
          </span>
          <span className="text-meta text-ink-muted">
            {file
              ? 'Drop another, or click, to choose again'
              : 'Drop it here, or click · .gp, .gpx'}
          </span>
          <input
            type="file"
            accept=".gp,.gpx"
            aria-label="Guitar Pro file"
            className="sr-only"
            onChange={(e) => void open(e.target.files?.[0])}
          />
        </label>
        {error && <p className="text-body-sm text-destructive">{error}</p>}

        {score && (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <Field label="Track">
              <Select
                value={track === undefined ? '' : String(track)}
                onValueChange={(v) => setRange({ ...range, track: Number(v) })}
                disabled={tracks.length === 0}
              >
                <SelectTrigger aria-label="Track" className="w-[300px]">
                  <SelectValue placeholder="No track has notes in these bars" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {score.tracks[t]!.name} ·{' '}
                      {tuningName(
                        score.tracks[t]!.tuning.map((p) => noteNameFromMidi(midi(p))),
                      )}
                      {score.tracks[t]!.capo > 0 ? ` · capo ${score.tracks[t]!.capo}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="From bar">
              <BarSelect
                label="From bar"
                count={score.masterBars.length}
                value={range.firstBar}
                describe={barLabel}
                onChange={(firstBar) =>
                  setRange({ ...range, firstBar, lastBar: Math.max(firstBar, range.lastBar) })
                }
              />
            </Field>
            <Field label="To bar">
              <BarSelect
                label="To bar"
                count={score.masterBars.length}
                value={range.lastBar}
                describe={barLabel}
                onChange={(lastBar) =>
                  setRange({ ...range, lastBar, firstBar: Math.min(lastBar, range.firstBar) })
                }
              />
            </Field>
            {keyMode && (
              <Field
                label="Key"
                {...(key
                  ? {}
                  : { hint: 'From the file’s key signature: change it if that isn’t right.' })}
              >
                <div className="flex gap-2">
                  <Select
                    value={keyMode.tonic}
                    onValueChange={(t) => setKey({ ...keyMode, tonic: pitchClass(t) })}
                  >
                    <SelectTrigger aria-label="Key" className="w-[84px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tonics.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={keyMode.mode}
                    onValueChange={(m) => setKey({ ...keyMode, mode: m as ModeName })}
                  >
                    <SelectTrigger aria-label="Mode" className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODE_NAMES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {modeTitle(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            )}
          </div>
        )}
      </div>

      {result && !result.ok && (
        <div className="sheet max-w-[900px] p-5">
          <Kicker>Can’t be made from these bars</Kicker>
          <p data-testid="written-refusal" className="mt-1 text-body text-destructive">
            {result.reason}
          </p>
        </div>
      )}

      {imported && (
        <div className="sheet space-y-4 p-5">
          <p className="text-body-sm text-ink-muted" data-testid="written-facts">
            {[
              imported.phrase.writtenTempo
                ? `Written at ${imported.phrase.writtenTempo}`
                : null,
              `${imported.phrase.timeSignature.beats}/${imported.phrase.timeSignature.unit}`,
              tuningName(imported.tuning),
              imported.capo > 0 ? `capo ${imported.capo}` : null,
              `${imported.phrase.bars.length} ${imported.phrase.bars.length === 1 ? 'bar' : 'bars'}${
                imported.phrase.repeat ? ` × ${imported.phrase.repeat}` : ''
              }`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <TabStaff
            phrase={imported.phrase}
            instrument={instrument}
            size="large"
            showPickStrokes
          />
          <div data-testid="written-dropped" className="border-t border-rule pt-3">
            <Kicker>Left out</Kicker>
            {imported.dropped.length === 0 ? (
              <p className="text-meta text-ink-muted">
                Nothing: the tab shows every mark in these bars.
              </p>
            ) : (
              <ul className="mt-1 list-disc pl-5 text-body-sm text-ink-muted">
                {imported.dropped.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BarSelect({
  label,
  count,
  value,
  describe,
  onChange,
}: {
  label: string;
  count: number;
  value: number;
  describe: (index: number) => string;
  onChange: (index: number) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger aria-label={label} className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: count }, (_, i) => (
          <SelectItem key={i} value={String(i)}>
            {describe(i)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
