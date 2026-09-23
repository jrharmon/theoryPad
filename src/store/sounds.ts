import { create } from 'zustand';
import type { VoiceId } from '@/data';
import type { VoiceStatus } from '@/audio';
import type { NoteName } from '@/domain/music';

interface SoundsState {
  /** What the notes are playing on: the synth, samples, or the synth while they load. */
  status: VoiceStatus;
  /** Start loading a voice. Nothing waits on it; the synth plays until it is ready. */
  choose: (id: VoiceId) => Promise<void>;
  /** Chords through the chosen voice, at this volume. Must be called from a click. */
  hear: (chords: readonly (readonly NoteName[])[], volumeDb: number) => Promise<void>;
}

/**
 * The engine's voice, for the screens. The engine is imported on first use, so
 * Tone stays off first paint; the practice screen starts the load when it
 * opens, and Settings when the voice is changed.
 */
export const useSounds = create<SoundsState>((set) => {
  let subscribed = false;
  const engine = async () => {
    const audio = await import('@/audio');
    const e = audio.getAudioEngine();
    if (!subscribed) {
      subscribed = true;
      e.onVoiceStatus((status) => set({ status }));
      set({ status: e.voiceStatus });
    }
    return e;
  };

  return {
    status: 'synth',
    choose: async (id) => (await engine()).chooseVoice(id),
    async hear(chords, volumeDb) {
      const e = await engine();
      const hearing = e.hear(chords);
      e.setMasterVolume(volumeDb);
      await hearing;
    },
  };
});
