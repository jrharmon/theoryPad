import { useEffect, useMemo, useState } from 'react';
import type { Instrument } from '@/domain/instrument';
import { keyModeName, midi, midiOf, noteNameFromMidi } from '@/domain/music';
import type { GpScore } from '@/domain/phrase/import';
import { importPhrase, playableTracks } from '@/domain/phrase/import';
import { readGuitarPro } from '@/import/guitar-pro';
import { Section, TransportBar } from './Gallery';
import { TabExample } from './TabExample';
import { useTransport } from './useTransport';

/**
 * A development page for run A of written exercises (doc 16): drop a Guitar
 * Pro file, choose a track and bars, and see the tab beside what was left out
 * — to be judged against Guitar Pro itself. The import sheet proper is run B.
 */
export function GuitarProImport() {
  const transport = useTransport();
  const [file, setFile] = useState<{ name: string; score: GpScore } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [range, setRange] = useState({ track: 0, firstBar: 0, lastBar: 0 });

  const open = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    try {
      const score = await readGuitarPro(new Uint8Array(await picked.arrayBuffer()));
      const lastBar = score.masterBars.length - 1;
      setFile({ name: picked.name, score });
      setRange({ track: playableTracks(score, 0, lastBar)[0] ?? 0, firstBar: 0, lastBar });
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

  const instrument = useMemo<Instrument | null>(() => {
    if (!imported) return null;
    const highest = Math.max(0, ...imported.phrase.notes.map((n) => n.fret));
    return {
      id: 'guitar-pro-import',
      name: 'From the file',
      // Guitar Pro counts frets from the capo, so the strings sound from there.
      tuning: imported.tuning.map((n) => noteNameFromMidi(midi(midiOf(n) + imported.capo))),
      fretCount: Math.max(24, highest),
      handedness: 'right',
      // Frets are drawn as the file writes them, from the capo; it is named above.
      capo: 0,
    };
  }, [imported]);

  // Play at the tempo it was written at.
  const writtenTempo = imported?.phrase.writtenTempo;
  const { setBpm } = transport;
  useEffect(() => {
    if (writtenTempo) setBpm(writtenTempo);
  }, [writtenTempo, setBpm]);

  const barOption = (i: number) => {
    const section = score?.masterBars[i]?.section;
    return `${i + 1}${section ? ` · ${section}` : ''}`;
  };

  return (
    <div className="pb-16">
      <div className="border-b-(length:--rule-section-w) border-divider px-8 py-6">
        <p className="kicker kicker-accent">Dev · written exercises, run A</p>
        <h1>Guitar Pro import</h1>
        <p className="text-body text-ink-muted">
          Drop a .gp or .gpx file, choose a track and bars, and compare the tab with Guitar Pro.
          Nothing is saved.
        </p>
      </div>
      <TransportBar transport={transport} />

      <Section title="File">
        <label
          data-testid="gp-drop"
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
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-[12px] border border-dashed px-6 py-8 text-center ${
            dragging ? 'border-accent bg-accent/5' : 'border-rule'
          }`}
        >
          <span className="text-body font-semibold">
            {file ? file.name : 'Drop a Guitar Pro file here'}
          </span>
          <span className="text-meta text-ink-muted">or click to choose one · .gp, .gpx</span>
          <input
            type="file"
            accept=".gp,.gpx"
            className="sr-only"
            onChange={(e) => void open(e.target.files?.[0])}
          />
        </label>
        {error && <p className="mt-3 text-body-sm text-destructive">{error}</p>}
      </Section>

      {score && (
        <Section
          title="Track and bars"
          note={[score.title, score.artist].filter(Boolean).join(' · ')}
        >
          <div className="flex flex-wrap items-end gap-5">
            <Picker label="Track">
              <select
                value={track ?? ''}
                onChange={(e) => setRange({ ...range, track: Number(e.target.value) })}
                disabled={tracks.length === 0}
              >
                {tracks.length === 0 && (
                  <option value="">No track has notes in these bars</option>
                )}
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {score.tracks[t]!.name} ·{' '}
                    {score.tracks[t]!.tuning.map((p) => noteNameFromMidi(midi(p))).join(' ')}
                  </option>
                ))}
              </select>
            </Picker>
            <Picker label="From bar">
              <select
                value={range.firstBar}
                onChange={(e) => {
                  const firstBar = Number(e.target.value);
                  setRange({ ...range, firstBar, lastBar: Math.max(firstBar, range.lastBar) });
                }}
              >
                {score.masterBars.map((_, i) => (
                  <option key={i} value={i}>
                    {barOption(i)}
                  </option>
                ))}
              </select>
            </Picker>
            <Picker label="To bar">
              <select
                value={range.lastBar}
                onChange={(e) => {
                  const lastBar = Number(e.target.value);
                  setRange({ ...range, lastBar, firstBar: Math.min(lastBar, range.firstBar) });
                }}
              >
                {score.masterBars.map((_, i) => (
                  <option key={i} value={i}>
                    {barOption(i)}
                  </option>
                ))}
              </select>
            </Picker>
          </div>
        </Section>
      )}

      {result && !result.ok && (
        <Section title="Can't be imported">
          <p data-testid="gp-refusal" className="text-body text-destructive">
            {result.reason}
          </p>
        </Section>
      )}

      {imported && instrument && (
        <Section
          title={imported.name}
          note={[
            keyModeName(imported.keyMode),
            `written at ${imported.phrase.writtenTempo} bpm`,
            `${imported.phrase.timeSignature.beats}/${imported.phrase.timeSignature.unit}`,
            imported.tuning.join(' '),
            imported.capo > 0 ? `capo ${imported.capo}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <TabExample
            id="guitar-pro-import"
            phrase={imported.phrase}
            transport={transport}
            instrument={instrument}
            size="large"
            showPickStrokes
          />
          <div className="mt-6 border-t border-rule pt-3" data-testid="gp-dropped">
            <p className="kicker mb-1">Left out</p>
            {imported.dropped.length === 0 ? (
              <p className="text-meta text-ink-muted">
                Nothing — every mark in these bars is shown.
              </p>
            ) : (
              <ul className="list-disc pl-5 text-body-sm text-ink-muted">
                {imported.dropped.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Picker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-body-sm [&_select]:rounded-[8px] [&_select]:border [&_select]:border-rule [&_select]:bg-paper [&_select]:px-2 [&_select]:py-1.5">
      <span className="kicker">{label}</span>
      {children}
    </label>
  );
}
