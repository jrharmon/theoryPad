import * as Tone from 'tone';
import type { NoteEvent, RenderedPass } from '@/domain/backing';
import { noteNameFromMidi } from '@/domain/music';
import { ticksToSeconds } from '@/domain/phrase';
import type { Clock } from '@/domain/time';
import type { BackingSource } from './backing/types';
import {
  BASS_PRESET,
  SampledVoice,
  SynthVoice,
  VOICE_PRESETS,
  type InstrumentVoice,
  type VoicePreset,
} from './voices';

/** How far under the notes the bass and piano sit. Set by ear at the gate. */
const LEVEL_DB = -8;
/** The synth voices' own level (SynthVoice), before LEVEL_DB. */
const SYNTH_DB = -8;

/**
 * One of the backing's two instruments: samples once they are in, the synth
 * until then — and for good, if they fail. Nothing waits on the download.
 */
class Part {
  private readonly preset: VoicePreset;
  private readonly fallback: SynthVoice;
  private sampled: SampledVoice | null = null;
  private loading: Promise<void> | null = null;
  private disposed = false;

  constructor(preset: VoicePreset, fallback: SynthVoice) {
    this.preset = preset;
    this.fallback = fallback;
  }

  /** Read as each note plays, so samples that arrive mid-pass take over from the next. */
  get voice(): InstrumentVoice {
    if (this.sampled) return this.sampled;
    if (!this.fallback.ready) {
      void this.fallback.load();
      this.fallback.setVolume(SYNTH_DB + LEVEL_DB);
    }
    return this.fallback;
  }

  /** Never rejects: a failed download leaves the synth playing. */
  load(): Promise<void> {
    this.loading ??= (async () => {
      const voice = new SampledVoice(this.preset);
      try {
        await voice.load();
      } catch {
        voice.dispose();
        return;
      }
      if (this.disposed) return voice.dispose();
      voice.setVolume(this.preset.volumeDb + LEVEL_DB);
      this.sampled = voice;
    })();
    return this.loading;
  }

  releaseAll(): void {
    this.sampled?.releaseAll();
    this.fallback.releaseAll();
  }

  dispose(): void {
    this.disposed = true;
    this.sampled?.dispose();
    this.fallback.dispose();
    this.sampled = null;
  }
}

/**
 * Bass and piano chords over the key's progression, under the notes
 * (docs/plan/13-GENERATED-BACKING.md). It has no tempo of its own: each pass's
 * notes are scheduled on the clock, so it follows the clock at any speed, and
 * pausing the clock pauses it. The session hands it every pass as it starts.
 */
export class GeneratedBacking implements BackingSource {
  readonly kind = 'generated';
  readonly rates = null;
  readonly effectiveBpm = null;

  private readonly clock: Clock;
  private readonly bass = new Part(BASS_PRESET, new SynthVoice('bass'));
  private readonly piano = new Part(VOICE_PRESETS.piano, new SynthVoice('pad'));
  private handles: number[] = [];
  private pass: { events: RenderedPass; atTick: number } | null = null;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  /** Start the downloads. Never rejects, and nothing needs to wait for it. */
  load(): Promise<void> {
    return Promise.all([this.bass.load(), this.piano.load()]).then(() => undefined);
  }

  /** What sounds is scheduled on the clock by `loadPass`; starting it is the clock's job. */
  start(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Schedule a pass from `atTick`, its bar 1. The last pass's schedule goes;
   * its notes were cut at its end, so nothing of it rings into this bar 1.
   */
  loadPass(events: RenderedPass, atTick: number): void {
    this.cancel();
    this.pass = { events, atTick };
    for (const [part, notes] of [
      [this.bass, events.bass],
      [this.piano, events.piano],
    ] as const) {
      for (const note of notes) {
        this.handles.push(
          this.clock.schedule(
            (audioTime) => this.sound(part, note, note.durationTicks, audioTime),
            atTick + note.tick,
          ),
        );
      }
    }
  }

  /** Nothing scheduled, nothing ringing. */
  clear(): void {
    this.cancel();
    this.pass = null;
    this.releaseAll();
  }

  /** The clock holds what is scheduled; only what is ringing needs stopping. */
  pause(): void {
    this.releaseAll();
  }

  /** Strike again whatever was ringing at the pause, for the rest of its length. */
  resume(): Promise<void> {
    this.restrike();
    return Promise.resolve();
  }

  stop(): void {
    this.clear();
  }

  setRate(): void {}

  /**
   * The clock was moved: scheduled notes follow it on their own, but what
   * was ringing belongs to where it was. Sound what is due here instead.
   */
  reanchor(): void {
    this.releaseAll();
    this.restrike();
  }

  dispose(): void {
    this.clear();
    this.bass.dispose();
    this.piano.dispose();
  }

  private sound(part: Part, note: NoteEvent, ticks: number, audioTime: number): void {
    part.voice.play(
      noteNameFromMidi(note.midi),
      ticksToSeconds(ticks, this.clock.bpm),
      audioTime,
      note.velocity,
    );
  }

  /** Every note that spans the clock's position, from here to its end. */
  private restrike(): void {
    if (!this.pass) return;
    const at = this.clock.ticks - this.pass.atTick;
    const now = Tone.now();
    for (const [part, notes] of [
      [this.bass, this.pass.events.bass],
      [this.piano, this.pass.events.piano],
    ] as const) {
      for (const note of notes) {
        const end = note.tick + note.durationTicks;
        if (note.tick < at && at < end) this.sound(part, note, end - at, now);
      }
    }
  }

  private cancel(): void {
    for (const handle of this.handles) this.clock.clear(handle);
    this.handles = [];
  }

  private releaseAll(): void {
    this.bass.releaseAll();
    this.piano.releaseAll();
  }
}
