import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { VOICE_PRESETS, sampleDir } from '@/audio/voices/presets';

/**
 * The presets are hand-written pitch ranges; the files were cut by
 * scripts/fetch-samples.mjs. In test/ because it reads the filesystem.
 */
const SAMPLES = join(__dirname, '../public/samples/v1');

describe('the sample presets', () => {
  it('name exactly the files that are shipped, under the base URL', () => {
    for (const preset of Object.values(VOICE_PRESETS)) {
      const dir = sampleDir(preset, '/theoryPad/');
      // The deploy serves from /theoryPad/: a rooted /samples/ URL would 404 there.
      expect(dir).toBe(`/theoryPad/samples/v1/${preset.dir}/`);
      const shipped = readdirSync(join(SAMPLES, preset.dir)).sort();
      expect(Object.values(preset.urls).sort()).toEqual(shipped);
    }
  });
});
