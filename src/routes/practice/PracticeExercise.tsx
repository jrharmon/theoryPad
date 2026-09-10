import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Fretboard, TabStaff } from '@/components/music';
import { Button, EmptyState, Kicker, Tag } from '@/components/ui';
import { tickToBarBeat } from '@/domain/phrase';
import { findExerciseDefinition } from '@/exercises/registry';
import { useExercises } from '@/store/exercises';
import { usePractice } from '@/store/practice';
import { useSettings } from '@/store/settings';
import { useRunnerHotkeys } from './useRunnerHotkeys';
import { RunningChrome } from './RunningChrome';
import { AxisStrip } from './AxisStrip';

export function PracticeExercise() {
  const { exerciseId } = useParams();
  const { exercises, loaded, load } = useExercises();
  const loadSettings = useSettings((s) => s.load);
  const practice = usePractice();
  const [freeTime, setFreeTime] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void load();
    void loadSettings();
  }, [load, loadSettings]);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const definition = exercise ? findExerciseDefinition(exercise.definitionId) : undefined;

  // Leaving the screen must not leave a metronome running.
  useEffect(() => () => void usePractice.getState().end(), []);

  const start = useCallback(async () => {
    if (!exercise) return;
    setStarting(true);
    try {
      await practice.startExercise(exercise, { freeTime });
    } finally {
      setStarting(false);
    }
  }, [exercise, freeTime, practice]);

  useRunnerHotkeys();

  if (!loaded) return <p className="px-8 py-8 text-[13px] text-ink/55">Loading…</p>;
  if (!exercise || !definition) {
    return (
      <div className="px-8 py-8">
        <EmptyState title="No such exercise">
          <Link to="/exercises" className="text-accent-700 underline">
            Back to the library
          </Link>
        </EmptyState>
      </div>
    );
  }

  const { snapshot, instance } = practice;

  if (!snapshot) {
    return (
      <section className="px-8 py-8">
        <Kicker accent>Practice</Kicker>
        <h1 className="text-[42px]">{exercise.name}</h1>
        <p className="mb-6 max-w-[620px] text-[15px] text-ink/70">{definition.summary}</p>

        <div className="flex items-center gap-4">
          <Button variant="primary" onClick={() => void start()} disabled={starting}>
            {starting ? 'Starting…' : 'Start'}
          </Button>

          {definition.timing !== 'metronome' && definition.timing !== 'free' && (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={freeTime}
                onChange={(e) => setFreeTime(e.target.checked)}
              />
              Free time — no metronome, finish when you like
            </label>
          )}
        </div>

        <p className="mt-4 text-[12px] text-ink/50">
          {exercise.defaultReps} rep{exercise.defaultReps === 1 ? '' : 's'} ·{' '}
          {exercise.tempo.targetTempo === null
            ? 'no tempo'
            : `target ${exercise.tempo.targetTempo} bpm`}
        </p>
      </section>
    );
  }

  return (
    <section>
      <RunningChrome name={exercise.name} />

      {snapshot.state === 'done' ? (
        <Done onAgain={() => void start()} />
      ) : (
        <>
          <Brief />
          <AxisStrip />
          {instance?.kind === 'played' && <PlayedBody />}
          <TransportBar />
        </>
      )}
    </section>
  );
}

function Brief() {
  const instance = usePractice((s) => s.instance);
  if (!instance) return null;
  return (
    <div className="border-b border-divider px-8 py-6">
      <Kicker accent>This time you are playing</Kicker>
      <h2 className="max-w-[820px] text-[34px]">{instance.brief.headline}</h2>
      <p className="max-w-[640px] text-[14px] text-ink/70">{instance.brief.instruction}</p>
    </div>
  );
}

function PlayedBody() {
  const instance = usePractice((s) => s.instance);
  const snapshot = usePractice((s) => s.snapshot);
  const instrument = useSettings((s) => s.settings.instrument);
  // The playhead is polled rather than pushed: the runner's clock is the source
  // of truth, and reading it on rAF keeps the tab in step without the clock
  // driving React. Whether it is shown at all is derived, so the effect never
  // has to clear it.
  const [tick, setTick] = useState(0);
  const frame = useRef<number | null>(null);
  const playing = snapshot?.state === 'playing';

  useEffect(() => {
    if (!playing) return;
    const step = () => {
      setTick(usePractice.getState().runner?.snapshot.phraseTick ?? 0);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing]);

  if (instance?.kind !== 'played') return null;

  return (
    <div className="grid gap-6 border-b border-divider px-8 py-6 lg:grid-cols-[1fr_320px]">
      <div>
        <Kicker>Tab · generated for this variation</Kicker>
        <div className="mt-2">
          <TabStaff
            phrase={instance.phrase}
            instrument={instrument}
            playheadTick={playing ? tick : null}
            size="large"
          />
        </div>
      </div>

      <div>
        <Kicker>Shape on the neck</Kicker>
        <div className="mt-2">
          <Fretboard
            instrument={instrument}
            overlay={instance.neck}
            fretRange={{ low: 0, high: 15 }}
          />
        </div>
      </div>
    </div>
  );
}

function TransportBar() {
  const snapshot = usePractice((s) => s.snapshot);
  const instance = usePractice((s) => s.instance);
  const practice = usePractice();
  if (!snapshot) return null;

  const { state, currentTempo, targetTempo, freeTime } = snapshot;
  const phrase = instance?.kind === 'played' ? instance.phrase : null;
  const position = phrase ? tickToBarBeat(phrase, snapshot.phraseTick) : null;

  return (
    <div className="flex flex-wrap items-center gap-4 border-t-2 border-divider px-8 py-4">
      {state === 'brief' && (
        <Button variant="primary" onClick={() => void practice.begin()} data-testid="begin">
          Start playing
        </Button>
      )}

      {state === 'count-in' && (
        <span className="text-[15px] font-extrabold tabular-nums">Counting in…</span>
      )}

      {(state === 'playing' || state === 'paused') && (
        <>
          <Button
            variant={state === 'paused' ? 'primary' : 'secondary'}
            onClick={() => (state === 'paused' ? practice.resume() : practice.pause())}
          >
            {state === 'paused' ? 'Resume' : 'Pause'}
          </Button>

          {freeTime ? (
            <Button variant="primary" onClick={() => practice.completeRep()} data-testid="done-rep">
              Done — next rep
            </Button>
          ) : (
            position && (
              <span className="text-[13px] font-extrabold tabular-nums">
                Bar {position.bar + 1} · beat {position.beat + 1}
              </span>
            )
          )}
        </>
      )}

      {currentTempo !== null && (
        <div className="flex items-center gap-2">
          <Button onClick={() => practice.nudgeTempo(-2)} aria-label="Slower">
            −
          </Button>
          <span className="w-14 text-center text-[17px] font-extrabold tabular-nums">
            {currentTempo}
          </span>
          <Button onClick={() => practice.nudgeTempo(2)} aria-label="Faster">
            +
          </Button>
          {targetTempo !== null && currentTempo !== targetTempo && (
            <span className="text-[12px] text-ink/55 tabular-nums">target {targetTempo}</span>
          )}
        </div>
      )}

      {freeTime && <Tag variant="outline">Free time</Tag>}

      <div className="ml-auto flex items-center gap-2">
        <Button onClick={() => practice.reroll()}>Re-roll</Button>
        <Button onClick={() => practice.skipRep()}>Skip</Button>
        <Button onClick={() => void practice.end()}>End</Button>
      </div>
    </div>
  );
}

function Done({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="px-8 py-10">
      <Kicker accent>Finished</Kicker>
      <h2 className="text-[34px]">That’s the set.</h2>
      <p className="mb-6 max-w-[560px] text-[14px] text-ink/70">
        Every rep is logged with the variation it was rolled at and the tempo you actually played.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={onAgain}>
          Again
        </Button>
        <Link to="/exercises">
          <Button>Back to the library</Button>
        </Link>
      </div>
    </div>
  );
}
