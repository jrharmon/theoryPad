import { useEffect, useMemo, useState } from 'react';
import type { Chroma, KeyMode, ModeName } from '@/domain/music';
import {
  MODE_NAMES,
  modeTitle,
  canonicalKeyMode,
  chroma,
  scaleDegrees,
  signatureDegree,
  tonicsForMode,
} from '@/domain/music';
import { scaleOnNeck, shapeSpan, shapesUpTheNeck } from '@/domain/instrument';
import { overlayFromScalePositions } from '@/domain/neck';
import {
  addDays,
  fretRuns,
  heatLevels,
  keyModeCounts,
  keyModeGrid,
  neckCounts,
  neckSummary,
} from '@/domain/progress';
import { Fretboard, KeyModeView } from '@/components/music';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { KeyModeGrid } from './KeyModeGrid';

type Layer = 'off' | 'all' | 'recent';

const title = modeTitle;

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.id}
          size="sm"
          variant="secondary"
          aria-pressed={value === option.id}
          className={value === option.id ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * A key and mode across the whole neck, one 3nps shape at a time if you like,
 * with how often you have played each spot laid underneath.
 */
export function FretboardExplorer() {
  const { days, today, lastKeyMode, loaded, load } = useProgress();
  const instrument = useSettings((s) => s.settings.instrument);
  const loadSettings = useSettings((s) => s.load);
  const [picked, setPicked] = useState<KeyMode | null>(null);
  const [labels, setLabels] = useState<'degree' | 'note'>('degree');
  const [shapeIndex, setShapeIndex] = useState<number | null>(null);
  const [layer, setLayer] = useState<Layer>('off');

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const keyMode = canonicalKeyMode(picked ?? lastKeyMode ?? { tonic: 'C' as never, mode: 'ionian' });
  const choose = (next: KeyMode) => {
    setPicked(canonicalKeyMode(next));
    setShapeIndex(null);
  };

  const shapes = useMemo(() => shapesUpTheNeck(instrument, keyMode), [instrument, keyMode]);
  const shape = shapeIndex === null ? null : (shapes[shapeIndex] ?? null);
  const degrees = scaleDegrees(keyMode);
  const signature = signatureDegree(keyMode);

  const overlay = useMemo(() => {
    const positions = shape ? shape.positions : scaleOnNeck(instrument, keyMode);
    const span = shape ? shapeSpan(shape.positions) : null;
    return overlayFromScalePositions(positions, {
      targetDegree: signature,
      labelMode: labels,
      ...(span
        ? { emphasisFrets: Array.from({ length: span.high - span.low + 1 }, (_, i) => span.low + i) }
        : {}),
    });
  }, [shape, instrument, keyMode, signature, labels]);

  const strings = instrument.tuning.length;
  const windowDays = useMemo(
    () => (layer === 'recent' ? days.filter((d) => d.date >= addDays(today, -29)) : days),
    [days, layer, today],
  );
  const counts = useMemo(() => neckCounts(windowDays, strings), [windowDays, strings]);
  const heat = useMemo(() => (layer === 'off' ? undefined : heatLevels(counts)), [counts, layer]);
  const summary = neckSummary(counts, strings, instrument.fretCount);
  const grid = useMemo(() => keyModeGrid(keyModeCounts(windowDays)), [windowDays]);
  const keyModesPlayed = MODE_NAMES.reduce((n, m) => n + grid[m].filter((x) => x > 0).length, 0);

  return (
    <section>
      <div className="border-b-(length:--rule-section-w) border-divider px-8 py-7">
        <Kicker accent>Explore</Kicker>
        <h1 data-testid="explorer-title">
          {keyMode.tonic} {title(keyMode.mode)}
        </h1>
        <p className="max-w-[640px] text-[15px] text-ink/70">
          The whole neck in one key and mode — or one shape of it — with where you have
          actually played laid underneath.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule px-8 py-4">
        <div className="flex items-center gap-2">
          <Select
            value={String(chroma(keyMode.tonic))}
            onValueChange={(c) => {
              const tonic = tonicsForMode(keyMode.mode)[Number(c) as Chroma];
              if (tonic) choose({ tonic, mode: keyMode.mode });
            }}
          >
            <SelectTrigger aria-label="Key" className="w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tonicsForMode(keyMode.mode).map((tonic, c) => (
                <SelectItem key={c} value={String(c)}>
                  {tonic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={keyMode.mode} onValueChange={(mode) => choose({ tonic: keyMode.tonic, mode: mode as ModeName })}>
            <SelectTrigger aria-label="Mode" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_NAMES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {title(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Toggle
          label="Labels"
          value={labels}
          options={[
            { id: 'degree', label: 'Degrees' },
            { id: 'note', label: 'Notes' },
          ]}
          onChange={setLabels}
        />
        <Toggle
          label="Notes played"
          value={layer}
          options={[
            { id: 'off', label: 'Notes played: off' },
            { id: 'all', label: 'All time' },
            { id: 'recent', label: 'Last 30 days' },
          ]}
          onChange={setLayer}
        />
      </div>

      <div className="border-b border-rule px-8 py-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Shape">
          <Button
            size="sm"
            variant="secondary"
            aria-pressed={shapeIndex === null}
            className={shapeIndex === null ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85' : ''}
            onClick={() => setShapeIndex(null)}
          >
            Whole neck
          </Button>
          {shapes.map((s, i) => (
            <Button
              key={`${s.startDegree}-${s.startFret}`}
              size="sm"
              variant="secondary"
              aria-pressed={shapeIndex === i}
              aria-label={`Shape starting on ${degrees[s.startDegree - 1]!.label} at fret ${s.startFret}`}
              className={shapeIndex === i ? 'bg-toggle-on text-toggle-on-ink inset-ring inset-ring-toggle-on-ring hover:bg-toggle-on/85' : ''}
              onClick={() => setShapeIndex(i)}
            >
              <span className="tabular">{degrees[s.startDegree - 1]!.label}</span>
              <span className="tabular text-[11px] opacity-60">fret {s.startFret}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="border-b-(length:--rule-section-w) border-divider px-8 py-6">
        <Fretboard
          instrument={instrument}
          overlay={overlay}
          fretRange={{ low: 0, high: instrument.fretCount }}
          size="large"
          {...(heat ? { heat, heatCounts: counts } : {})}
        />
        <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] text-ink/70" data-testid="legend">
          <span className="flex items-center gap-2">
            <span className="size-3.5 rounded-full bg-dot-root" /> Root
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3.5 rounded-full bg-dot-target" /> {signature.label} — the note that makes{' '}
            {title(keyMode.mode)}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3.5 rounded-full bg-dot-chord" /> The rest of the key
          </span>
          {heat && (
            <span className="flex items-center gap-2">
              Fewer
              <span
                className="h-3 w-24"
                style={{
                  background:
                    'linear-gradient(to right, color-mix(in srgb, var(--color-ink) 6%, transparent), color-mix(in srgb, var(--color-ink) 70%, transparent))',
                }}
              />
              More notes played
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-10 px-8 py-6 lg:grid-cols-[auto_1fr]">
        <div data-testid="coverage-panel">
          <Kicker>{layer === 'recent' ? 'Last 30 days' : 'All time'}</Kicker>
          {loaded && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
              <dt className="text-ink/60">Spots played</dt>
              <dd className="tabular" data-testid="spots-played">
                {summary.touched} of {summary.total}
              </dd>
              <dt className="text-ink/60">Frets never played</dt>
              <dd className="tabular" data-testid="frets-never">
                {summary.untouchedFrets.length === 0
                  ? 'none'
                  : summary.untouchedFrets.length === instrument.fretCount + 1
                    ? 'all of them, so far'
                    : fretRuns(summary.untouchedFrets)}
              </dd>
              <dt className="text-ink/60">Keys and modes</dt>
              <dd className="tabular">{keyModesPlayed} of 84</dd>
            </dl>
          )}
          <div className="mt-5">
            <KeyModeGrid grid={grid} selected={keyMode} onSelect={choose} />
          </div>
        </div>
        <KeyModeView keyMode={keyMode} variant="full" className="max-w-[620px]" />
      </div>
    </section>
  );
}
