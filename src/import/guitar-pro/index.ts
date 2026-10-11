import type { GpScore } from '@/domain/phrase/import';
import { unwrapScore } from './container';
import { parseGpif } from './gpif';

/** A `.gp` (GP7/8) or `.gpx` (GP6) file's bytes, read into a score. */
export async function readGuitarPro(bytes: Uint8Array): Promise<GpScore> {
  return parseGpif(await unwrapScore(bytes));
}
