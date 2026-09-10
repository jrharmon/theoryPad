import { useState } from 'react';
import { STANDARD_GUITAR, SEVEN_STRING_GUITAR, DROP_D_GUITAR } from '@/domain/instrument';
import { diatonicChords, keySignature, scaleNotes, signatureNote } from '@/domain/music';
import { Fretboard } from '@/components/music';
import {
  ALL_SHAPES,
  D_DORIAN,
  articulationPhrase,
  chordPhrase,
  fullNeckOverlay,
  legatoComparisonPhrase,
  scaleRunPhrase,
  sevenShapesPhrase,
  shapeOverlay,
  sixteenthRunPhrase,
} from './fixtures';
import { useTransport, type Transport } from './useTransport';
import { TabExample } from './TabExample';

/**
 * A development-only view of the M1 primitives against fixture data. Not part
 * of the app proper — it exists so the domain and the two bespoke components
 * can be judged by eye before any real screen exists.
 */
export function Gallery() {
  const transport = useTransport();
  const [shapeIndex, setShapeIndex] = useState(0);
  const shapes = ALL_SHAPES();

  return (
    <div className="pb-16">
      <Header />
      <TransportBar transport={transport} />

      <Section title="Fretboard · D Dorian across the neck" note="Root · target 6th · other degrees">
        <Fretboard
          instrument={STANDARD_GUITAR}
          overlay={fullNeckOverlay()}
          fretRange={{ low: 0, high: 12 }}
          size="large"
        />
      </Section>

      <Section
        title="Tab + playhead · scale run"
        note="Ascending through one shape, landing on the 6th. Metronome and playhead share one clock."
      >
        <TabExample id="run" phrase={scaleRunPhrase()} transport={transport} size="large" />
      </Section>

      <Section
        title="Tab · picked vs legato"
        note="The same eight notes twice: picked, then slurred. Turn the metronome off and listen for the drop in attack on the h and p notes. Repeats twice."
      >
        <TabExample
          id="legato"
          phrase={legatoComparisonPhrase()}
          transport={transport}
          size="large"
          showPickStrokes
        />
        <ArticulationLegend />
      </Section>

      <Section
        title="Tab · articulation marks"
        note="Every written mark the renderer supports"
      >
        <TabExample
          id="articulations"
          phrase={articulationPhrase()}
          transport={transport}
          size="large"
          showPickStrokes
        />
      </Section>

      <Section
        title="Tab · sixteenth-note run"
        note="Grid resolution comes from the phrase, not a fixed column count"
      >
        <TabExample id="sixteenths" phrase={sixteenthRunPhrase()} transport={transport} />
      </Section>

      <Section
        title="Tab · all seven shapes"
        note="What modes-through-key will generate. Long phrases wrap onto lines rather than running off the page."
      >
        <TabExample id="seven-shapes" phrase={sevenShapesPhrase()} transport={transport} />
      </Section>

      <Section title="Tab · chords" note="Simultaneous notes stack in one column">
        <TabExample id="chords" phrase={chordPhrase()} transport={transport} />
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

function ArticulationLegend() {
  const marks: [string, string][] = [
    ['⊓ V', 'pick stroke: down, up'],
    ['h', 'hammer-on'],
    ['p', 'pull-off'],
    ['/ \\', 'slide up, slide down'],
    ['~', 'vibrato'],
    ['b r', 'bend, release'],
  ];
  return (
    <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-divider pt-3">
      {marks.map(([glyph, meaning]) => (
        <div key={meaning} className="flex items-baseline gap-2">
          <dt className="font-extrabold text-accent-700">{glyph}</dt>
          <dd className="text-[12px] text-ink/60">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Settings shared by every example: they all use one engine and one clock. */
function TransportBar({ transport }: { transport: Transport }) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-5 border-b-2 border-divider bg-bg px-8 py-3">
      <span className="kicker kicker-accent">Playback</span>

      <label className="flex items-center gap-2 text-[13px]">
        <span className="kicker">Tempo</span>
        <input
          type="range"
          min={40}
          max={200}
          value={transport.bpm}
          onChange={(e) => transport.setBpm(Number(e.target.value))}
          aria-label="Tempo"
        />
        <span className="w-10 font-extrabold tabular-nums">{transport.bpm}</span>
      </label>

      <Toggle
        label="Metronome"
        checked={transport.withMetronome}
        onChange={transport.setWithMetronome}
      />
      <Toggle label="Notes" checked={transport.withNotes} onChange={transport.setWithNotes} />

      <span className="ml-auto text-[12px] text-ink/50">
        {transport.activeId
          ? `Playing: ${transport.activeId}`
          : 'One clock — starting an example stops any other'}
      </span>
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
    // scroll-mt keeps the sticky toolbar from covering a section's controls
    // when it is scrolled to.
    <section className="scroll-mt-14 border-b border-divider px-8 py-7">
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
