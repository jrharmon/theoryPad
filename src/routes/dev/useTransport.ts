import { useCallback, useEffect, useRef, useState } from 'react';
import type { Phrase } from '@/domain/phrase';
import { STANDARD_GUITAR } from '@/domain/instrument';
import type { AudioEngine } from '@/audio';

/**
 * Drives playback for the gallery.
 *
 * The playhead is read on requestAnimationFrame and written into a ref-held
 * state at a coarse tick, rather than being set from a clock callback on every
 * beat. Once phrases get long this must stop touching React state at all — see
 * docs/plan/01-ARCHITECTURE.md — but at gallery scale it is fine and simple.
 */
export function useTransport(phrase: Phrase) {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [playheadTick, setPlayheadTick] = useState<number | null>(null);
  const [withMetronome, setWithMetronome] = useState(true);
  const [withNotes, setWithNotes] = useState(true);
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (!engine) return;
    engine.metronome.stop();
    engine.phrase.clear();
    engine.clock.stop();
    setPlaying(false);
    setPlayheadTick(null);
  }, [engine]);

  const play = useCallback(async () => {
    // The AudioContext can only start from a user gesture; this is that gesture.
    const { getAudioEngine } = await import('@/audio');
    const e = getAudioEngine();
    await e.init();
    setEngine(e);

    e.clock.stop();
    e.clock.setBpm(bpm);
    e.metronome.stop();
    e.phrase.clear();

    if (withMetronome) e.metronome.start();
    if (withNotes) e.phrase.load(phrase, STANDARD_GUITAR);

    // Stop cleanly at the end of the phrase rather than looping silently.
    e.clock.schedule(() => {
      e.metronome.stop();
      e.clock.pause();
      setPlaying(false);
    }, phrase.totalTicks * (phrase.repeat ?? 1));

    e.clock.start();
    setPlaying(true);
  }, [bpm, phrase, withMetronome, withNotes]);

  const pause = useCallback(() => {
    if (!engine) return;
    engine.clock.pause();
    setPlaying(false);
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
    stop,
  };
}
