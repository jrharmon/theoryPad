import { create } from 'zustand';
import type { VoiceId } from '@/data';
import type { VoiceStatus } from '@/audio';
import type { MetronomeVoiceId } from '@/domain/drums';
import type { Mix } from '@/domain/mix';
import type { NoteName } from '@/domain/music';

interface SoundsState {
  /** What the notes are playing on: the synth, samples, or the synth while they load. */
  status: VoiceStatus;
  /** Start loading a voice. Nothing waits on it; the synth plays until it is ready. */
  choose: (id: VoiceId) => Promise<void>;
  /** Chords through the chosen voice, at this mix. Must be called from a click. */
  hear: (chords: readonly (readonly NoteName[])[], mix: Mix) => Promise<void>;
  /** Settings' mix preview is looping. */
  previewing: boolean;
  /** Loop the mix preview at this mix, with this metronome. Must be called from a click. */
  startPreview: (mix: Mix, metronome: MetronomeVoiceId) => Promise<void>;
  stopPreview: () => void;
  /** Switch the preview's metronome while it loops. */
  setPreviewMetronome: (metronome: MetronomeVoiceId) => void;
  /** Every channel's level, heard at once if anything is playing. */
  setMix: (mix: Mix) => void;
}

/**
 * The engine's voice, for the screens. The engine is imported on first use, so
 * Tone stays off first paint; the practice screen starts the load when it
 * opens, and Settings when the voice is changed.
 */
export const useSounds = create<SoundsState>((set, get) => {
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
    async hear(chords, mix) {
      const e = await engine();
      const hearing = e.hear(chords);
      e.setMix(mix);
      await hearing;
    },
    previewing: false,
    async startPreview(mix, metronome) {
      set({ previewing: true });
      const e = await engine();
      e.setMix(mix);
      await e.startPreview(metronome);
    },
    stopPreview() {
      if (!get().previewing) return;
      set({ previewing: false });
      void engine().then((e) => e.stopPreview());
    },
    setPreviewMetronome(metronome) {
      if (get().previewing) void engine().then((e) => e.setPreviewMetronome(metronome));
    },
    setMix(mix) {
      void engine().then((e) => e.setMix(mix));
    },
  };
});
