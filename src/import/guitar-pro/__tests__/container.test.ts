import { describe, expect, it } from 'vitest';
import { unwrapScore } from '../container';

/**
 * A GP6 file built by hand: no `.gpx` can be committed (the repo is public and
 * the player's are bought), so these write the format the reader undoes.
 */
const SECTOR = 0x1000;
const ascii = (text: string) => new TextEncoder().encode(text);

/** BCFS after its header: an empty first sector, a file entry, then its data. */
function bcfs(name: string, content: Uint8Array): Uint8Array {
  const dataSectors = Math.ceil(content.length / SECTOR);
  const image = new Uint8Array(SECTOR * (2 + dataSectors)).fill(0xff, 0, SECTOR);
  const view = new DataView(image.buffer);
  view.setInt32(SECTOR, 2, true);
  image.fill(0, SECTOR + 4, SECTOR * 2);
  image.set(ascii(name), SECTOR + 4);
  view.setInt32(SECTOR + 0x8c, content.length, true);
  for (let i = 0; i < dataSectors; i += 1) view.setInt32(SECTOR + 0x94 + 4 * i, 2 + i, true);
  image.set(content, SECTOR * 2);
  return image;
}

/** BCFZ: literals three bytes at a time, and back-references over any run of repeats. */
function bcfz(data: Uint8Array): Uint8Array {
  const bits: number[] = [];
  const put = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  const putReversed = (value: number, count: number) => {
    for (let i = 0; i < count; i += 1) bits.push((value >> i) & 1);
  };

  let at = 0;
  while (at < data.length) {
    // Bytes that repeat the ones just before them: copy them from there. A
    // copy reaches at most `offset` back and copies at most that many.
    let n = Math.min(15, at, data.length - at);
    while (n >= 4 && !data.subarray(at, at + n).every((b, i) => b === data[at - n + i])) n -= 1;
    if (n >= 4) {
      put(1, 1);
      put(4, 4); // word size
      putReversed(n, 4); // offset
      putReversed(n, 4); // size
      at += n;
      continue;
    }
    const size = Math.min(3, data.length - at);
    put(0, 1);
    putReversed(size, 2);
    for (let i = 0; i < size; i += 1) put(data[at + i]!, 8);
    at += size;
  }

  const out = new Uint8Array(8 + Math.ceil(bits.length / 8));
  out.set(ascii('BCFZ'));
  new DataView(out.buffer).setInt32(4, data.length, true);
  bits.forEach((bit, i) => {
    out[8 + (i >> 3)]! |= bit << (7 - (i & 7));
  });
  return out;
}

const SCORE = '<GPIF><Score><Title>Six</Title></Score>' + ' '.repeat(5000) + '</GPIF>';

describe('unwrapScore', () => {
  it('reads score.gpif out of a GP6 file, compressed or not', async () => {
    const fileSystem = bcfs('score.gpif', ascii(SCORE));
    const plain = new Uint8Array([...ascii('BCFS'), ...fileSystem]);
    expect(await unwrapScore(plain)).toBe(SCORE);

    const compressed = bcfz(new Uint8Array([...ascii('BCFS'), ...fileSystem]));
    expect(compressed.length).toBeLessThan(plain.length);
    expect(await unwrapScore(compressed)).toBe(SCORE);
  });

  it('says plainly when a file is not Guitar Pro', async () => {
    await expect(unwrapScore(ascii('%PDF-1.7'))).rejects.toThrow(/not a Guitar Pro/);
  });
});
