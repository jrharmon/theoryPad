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
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    setPlaying(false);
    setActiveId(null);
    setPlayheadTick(null);
    if (!engine) return;
    engine.metronome.stop();
    engine.phrase.clear();
    engine.clock.stop();
  }, [engine]);

  const play = useCallback(
    async (id: string, phrase: Phrase) => {
      // Importing here keeps Tone off the first-paint path, and the click that
      // reaches this callback is the user gesture the AudioContext needs.
      const { getAudioEngine } = await import('@/audio');
      const e = getAudioEngine();
      await e.init();
      setEngine(e);

      // Whatever was playing stops; one clock, one phrase.
      e.metronome.stop();
      e.phrase.clear();
      e.clock.stop();
      e.clock.setBpm(bpm);

      if (withMetronome) e.metronome.start();
      if (withNotes) e.phrase.load(phrase, STANDARD_GUITAR);

      // End at the phrase's end rather than running on silently.
      e.clock.schedule(() => {
        e.metronome.stop();
        e.clock.pause();
        setPlaying(false);
      }, phrase.totalTicks * (phrase.repeat ?? 1));

      e.clock.start();
      setActiveId(id);
      setPlaying(true);
    },
    [bpm, withMetronome, withNotes],
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

  return {
    activeId,
    isPlaying,
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
