import { useState } from 'react';
import { STANDARD_GUITAR, SEVEN_STRING_GUITAR, DROP_D_GUITAR } from '@/domain/instrument';
import { diatonicChords, keySignature, scaleNotes, signatureNote } from '@/domain/music';
import { Fretboard, TabStaff } from '@/components/music';
import {
  ALL_SHAPES,
  D_DORIAN,
  articulationPhrase,
  chordPhrase,
  fullNeckOverlay,
  scaleRunPhrase,
  shapeOverlay,
  sixteenthRunPhrase,
} from './fixtures';
import { useTransport } from './useTransport';

/**
 * A development-only view of the M1 primitives against fixture data. Not part
 * of the app proper — it exists so the domain and the two bespoke components
 * can be judged by eye before any real screen exists.
 */
export function Gallery() {
  const runPhrase = scaleRunPhrase();
  const transport = useTransport(runPhrase);
  const [shapeIndex, setShapeIndex] = useState(0);
  const shapes = ALL_SHAPES();

  return (
    <div className="pb-16">
      <Header />

      <Section title="Fretboard · D Dorian across the neck" note="Root · target 6th · other degrees">
        <Fretboard
          instrument={STANDARD_GUITAR}
          overlay={fullNeckOverlay()}
          fretRange={{ low: 0, high: 12 }}
          size="large"
        />
      </Section>

      <Section
        title="Tab + playhead"
        note="Press play. Metronome and playhead share one clock."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={transport.isPlaying ? transport.pause : () => void transport.play()}
            className="bg-accent px-5 py-2 text-[15px] font-semibold text-bg hover:bg-accent-600 active:bg-accent-700"
          >
            {transport.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={transport.stop}
            className="border border-divider px-4 py-2 text-[13px] hover:bg-ink/5"
          >
            Stop
          </button>

          <label className="flex items-center gap-2 text-[13px]">
            <span className="kicker">Tempo</span>
            <input
              type="range"
              min={40}
              max={200}
              value={transport.bpm}
              onChange={(e) => transport.setBpm(Number(e.target.value))}
            />
            <span className="w-10 font-extrabold tabular-nums">{transport.bpm}</span>
          </label>

          <Toggle
            label="Metronome"
            checked={transport.withMetronome}
            onChange={transport.setWithMetronome}
          />
          <Toggle label="Notes" checked={transport.withNotes} onChange={transport.setWithNotes} />
        </div>

        <TabStaff
          phrase={runPhrase}
          instrument={STANDARD_GUITAR}
          playheadTick={transport.playheadTick}
          size="large"
        />
      </Section>

      <Section title="Tab · articulations and pick strokes">
        <TabStaff
          phrase={articulationPhrase()}
          instrument={STANDARD_GUITAR}
          showPickStrokes
        />
      </Section>

      <Section title="Tab · sixteenth-note run" note="Grid resolution comes from the phrase">
        <TabStaff phrase={sixteenthRunPhrase()} instrument={STANDARD_GUITAR} />
      </Section>

      <Section title="Tab · chords" note="Simultaneous notes stack in one column">
        <TabStaff phrase={chordPhrase()} instrument={STANDARD_GUITAR} />
      </Section>

      <Section
        title="Generated 3nps shapes"
        note="Seven shapes ascending the neck, each starting on whichever degree falls next"
      >
        <div className="mb-4 flex gap-1">
          {shapes.map((shape, i) => (
            <button
              key={shape.startFret}
              type="button"
              onClick={() => setShapeIndex(i)}
              className={[
                'px-3 py-1 text-[13px] tabular-nums',
                i === shapeIndex
                  ? 'bg-accent font-semibold text-bg'
                  : 'border border-divider hover:bg-ink/5',
              ].join(' ')}
            >
              fret {shape.startFret}
            </button>
          ))}
        </div>
        <Fretboard
          instrument={STANDARD_GUITAR}
          overlay={shapeOverlay(shapes[shapeIndex]?.positions ?? [])}
          fretRange={{ low: 0, high: 17 }}
          size="large"
        />
      </Section>

      <Section title="Other instruments" note="Same components, string count from the tuning">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="kicker mb-2">Seven string</p>
            <Fretboard
              instrument={SEVEN_STRING_GUITAR}
              overlay={fullNeckOverlay(SEVEN_STRING_GUITAR)}
              fretRange={{ low: 0, high: 12 }}
            />
          </div>
          <div>
            <p className="kicker mb-2">Drop D</p>
            <Fretboard
              instrument={DROP_D_GUITAR}
              overlay={fullNeckOverlay(DROP_D_GUITAR)}
              fretRange={{ low: 0, high: 12 }}
            />
          </div>
        </div>
      </Section>

      <Section title="Derived theory" note="Everything below is computed, nothing is authored">
        <TheoryTable />
      </Section>
    </div>
  );
}

function Header() {
  const sig = keySignature(D_DORIAN);
  return (
    <div className="border-b-2 border-divider px-8 py-6">
      <p className="kicker kicker-accent">Dev gallery · milestone 1</p>
      <h1 className="text-[42px]">D Dorian</h1>
      <p className="text-[15px] text-ink/70">
        {scaleNotes(D_DORIAN).join(' · ')} — signature note {signatureNote(D_DORIAN)}, relative
        major {sig.relativeMajor}, {sig.sharps} sharps and {sig.flats} flats.
      </p>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-divider px-8 py-7">
      <div className="mb-4">
        <p className="kicker">{title}</p>
        {note && <p className="text-[12px] text-ink/55">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function TheoryTable() {
  const chords = diatonicChords(D_DORIAN);
  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="border-b border-divider">
          {['Deg', 'Triad', '7th', '9th', 'Function'].map((h) => (
            <th key={h} className="kicker py-2 font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chords.map((chord) => (
          <tr
            key={chord.degree.label}
            className={[
              'border-b border-divider/50',
              chord.function !== 'other' ? 'bg-accent/8' : '',
            ].join(' ')}
          >
            <td className="py-2 font-semibold">{chord.degree.label}</td>
            <td className="py-2 font-semibold">{chord.triadSymbol}</td>
            <td className="py-2">{chord.seventhSymbol}</td>
            <td className="py-2 text-ink/60">{chord.ninthSymbol ?? '—'}</td>
            <td className="py-2 text-ink/60">
              {chord.function === 'other' ? '' : chord.function}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
