import { pitchClass } from '@/domain/music';
import type { Video } from '../entities';

/**
 * Videos added once, on first run, as ordinary rows — editable and deletable
 * like any other, and exported with them. The ids are fixed so that adding
 * them can never happen twice, and so that when the collection moves into a
 * static data file, rows already stored match it by id.
 */
export const FIRST_RUN_VIDEOS: readonly Video[] = [
  {
    id: '6d0f3f5e-7a51-4c1e-9a55-0a1b2c3d4e5f',
    videoId: 'WkIijba-HcU',
    title: 'A minor backing track',
    scope: { kind: 'shared' },
    playAlong: true,
    startSec: 216,
    keyMode: { tonic: pitchClass('A'), scale: 'major', mode: 'aeolian' },
    bpm: 100,
    beatsPerBar: 4,
    tags: [],
    createdAt: Date.UTC(2026, 8, 13),
    updatedAt: Date.UTC(2026, 8, 13),
  },
];
