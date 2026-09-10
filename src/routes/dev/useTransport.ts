import { useCallback, useEffect, useRef, useState } from 'react';
import type { Phrase } from '@/domain/phrase';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { AudioEngine } from '@/audio';

/**
 * Drives playback for the gallery.
 *
 * There is one AudioEngine and one clock, so exactly one phrase can sound at a
 * time — starting a second stops the first. The hook is therefore owned by the
 * Gallery and shared by every example, rather than each example holding its own.
 *
 * The playhead is polled on requestAnimationFrame into React state. At gallery
 * scale that is fine; the real running view must drive it without re-rendering,
 * see docs/plan/01-ARCHITECTURE.md.
 */
export function useTransport() {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [playheadTick, setPlayheadTick] = useState<number | null>(null);
  const [withMetronome, setWithMetronome] = useState(true);
  const [withNotes, setWithNotes] = useState(true);
  const [isLooping, setLooping] = useState(false);
  const frame = useRef<number | null>(null);
  /**
   * The end-of-phrase callback's handle. It must be cleared explicitly: it is
   * scheduled straight onto the clock, so unlike the metronome's and the
   * phrase player's handles nothing else owns it. Leaving it registered means a
   * short example's end callback fires part-way through a longer one and pauses
   * it — which is exactly what happened.
   */
  const endHandle = useRef<number | null>(null);
  /** Scheduled length of whatever is loaded, so loop can be toggled live. */
  const activeLength = useRef(0);

  const teardown = useCallback((e: AudioEngine) => {
    if (endHandle.current !== null) {
      e.clock.clear(endHandle.current);
      endHandle.current = null;
    }
    e.metronome.stop();
    e.phrase.clear();
    e.clock.clearLoop();
    e.clock.stop();
    // Belt and braces: nothing should be left, and an orphaned callback is
    // silent until it derails a later phrase.
    e.clock.clearAll();
  }, []);

  const finish = useCallback(
    (e: AudioEngine) => {
      teardown(e);
      setPlaying(false);
      setActiveId(null);
      setPlayheadTick(null);
    },
    [teardown],
  );

  const stop = useCallback(() => {
    setPlaying(false);
    setActiveId(null);
    setPlayheadTick(null);
    if (engine) teardown(engine);
  }, [engine, teardown]);

  const play = useCallback(
    async (id: string, phrase: Phrase) => {
      // Importing here keeps Tone off the first-paint path, and the click that
      // reaches this callback is the user gesture the AudioContext needs.
      const { getAudioEngine } = await import('@/audio');
      const e = getAudioEngine();
      await e.init();
      setEngine(e);

      // Whatever was playing stops; one clock, one phrase.
      teardown(e);
      e.clock.setBpm(bpm);

      if (withMetronome) e.metronome.start();
      if (withNotes) e.phrase.load(phrase, STANDARD_GUITAR);

      const length = phrase.totalTicks * (phrase.repeat ?? 1);

      if (isLooping) {
        // Looping on the clock means everything driven by it loops together —
        // metronome, notes and playhead stay in step, and the scheduled events
        // re-fire because the transport position rewinds.
        e.clock.setLoop(0, length);
      } else {
        // At the end, reset fully rather than pausing. Pausing left the
        // transport parked past every scheduled event, so "Resume" had nothing
        // left to play and toggled forever.
        endHandle.current = e.clock.schedule(() => finish(e), length);
      }

      activeLength.current = length;

      e.clock.start();
      setActiveId(id);
      setPlaying(true);
    },
    [bpm, withMetronome, withNotes, isLooping, teardown, finish],
  );

  const pause = useCallback(() => {
    if (!engine) return;
    engine.clock.pause();
    setPlaying(false);
  }, [engine]);

  const resume = useCallback(() => {
    if (!engine) return;
    engine.clock.start();
    setPlaying(true);
  }, [engine]);

  useEffect(() => {
    if (!engine || !isPlaying) return;
    const tick = () => {
      setPlayheadTick(engine.clock.ticks);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [engine, isPlaying]);

  useEffect(() => {
    engine?.clock.setBpm(bpm);
  }, [engine, bpm]);

  // Toggling loop applies to whatever is playing now, rather than waiting for
  // the next Play. While looping the transport stays inside [0, length), so
  // switching it off can still schedule the stop at the phrase's end.
  useEffect(() => {
    if (!engine || activeId === null || activeLength.current <= 0) return;

    if (isLooping) {
      if (endHandle.current !== null) {
        engine.clock.clear(endHandle.current);
        endHandle.current = null;
      }
      engine.clock.setLoop(0, activeLength.current);
    } else {
      engine.clock.clearLoop();
      endHandle.current ??= engine.clock.schedule(() => finish(engine), activeLength.current);
    }
  }, [engine, activeId, isLooping, finish]);

  return {
    activeId,
    isPlaying,
    isLooping,
    setLooping,
    bpm,
    setBpm,
    playheadTick,
    withMetronome,
    setWithMetronome,
    withNotes,
    setWithNotes,
    play,
    pause,
    resume,
    stop,
  };
}

export type Transport = ReturnType<typeof useTransport>;
