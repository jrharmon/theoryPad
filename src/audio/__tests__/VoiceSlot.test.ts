import { describe, expect, it } from 'vitest';
import { VoiceSlot, type InstrumentVoice } from '../voices';

/** A voice whose load the test settles by hand. */
function fakeVoice(id: string) {
  let settle!: { resolve: () => void; reject: (e: Error) => void };
  const loading = new Promise<void>((resolve, reject) => (settle = { resolve, reject }));
  let disposed = false;
  const voice: InstrumentVoice = {
    id,
    ready: true,
    load: () => loading,
    play: () => {},
    releaseAll: () => {},
    setVolume: () => {},
    dispose: () => {
      disposed = true;
    },
  };
  return { voice, settle, disposed: () => disposed };
}

function slot() {
  const synth = fakeVoice('synth');
  const made: Record<string, ReturnType<typeof fakeVoice>> = {};
  const voices = new VoiceSlot(synth.voice, (id) => {
    made[id] = fakeVoice(id);
    return made[id].voice;
  });
  return { voices, synth: synth.voice, made };
}

describe('the voice slot', () => {
  it('plays the synth while samples load, then the samples', async () => {
    const { voices, synth, made } = slot();
    const statuses: string[] = [];
    voices.subscribe((s) => statuses.push(s));

    const choosing = voices.choose('guitar');
    expect(voices.voice).toBe(synth);
    made.guitar!.settle.resolve();
    await choosing;

    expect(voices.voice).toBe(made.guitar!.voice);
    expect(statuses).toEqual(['loading', 'ready']);

    await voices.choose('synth');
    expect(voices.voice).toBe(synth);
    expect(made.guitar!.disposed()).toBe(true);
  });

  it('stays on the synth when a load fails, and does not retry the same voice', async () => {
    const { voices, synth, made } = slot();
    const choosing = voices.choose('piano');
    const first = made.piano!;
    first.settle.reject(new Error('404'));
    await choosing;

    expect(voices.voice).toBe(synth);
    expect(voices.status).toBe('failed');
    await voices.choose('piano');
    expect(made.piano).toBe(first);
  });

  it('throws away a load that finishes after another voice was chosen', async () => {
    const { voices, made } = slot();
    const piano = voices.choose('piano');
    const guitar = voices.choose('guitar');
    made.guitar!.settle.resolve();
    await guitar;
    made.piano!.settle.resolve();
    await piano;

    expect(voices.voice).toBe(made.guitar!.voice);
    expect(made.piano!.disposed()).toBe(true);
  });
});
