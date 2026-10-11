/**
 * Getting the score's XML out of a Guitar Pro file. GP7 and GP8 (`.gp`) are
 * ordinary ZIP archives with the score at `Content/score.gpif`. GP6 (`.gpx`)
 * is BCFZ — a small bitwise LZ compressor — around BCFS, a file system of
 * 4 KB sectors holding `score.gpif`. Only the wrappers differ: the XML inside
 * is the same.
 */

const textDecoder = new TextDecoder();

function startsWith(bytes: Uint8Array, magic: string): boolean {
  return [...magic].every((char, i) => bytes[i] === char.charCodeAt(0));
}

/** The score's XML, from the bytes of a `.gp` or `.gpx` file. */
export async function unwrapScore(bytes: Uint8Array): Promise<string> {
  if (startsWith(bytes, 'PK\x03\x04'))
    return textDecoder.decode(await readZipEntry(bytes, 'Content/score.gpif'));
  if (startsWith(bytes, 'BCFZ'))
    return textDecoder.decode(
      readBcfsFile(inflateBcfz(bytes.subarray(4)).subarray(4), 'score.gpif'),
    );
  if (startsWith(bytes, 'BCFS'))
    return textDecoder.decode(readBcfsFile(bytes.subarray(4), 'score.gpif'));
  throw new Error('This is not a Guitar Pro 6, 7 or 8 file (.gpx or .gp).');
}

// --- ZIP -------------------------------------------------------------------

async function readZipEntry(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is the last thing in the file, before
  // a comment of at most 64 KB.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('The file is damaged: its ZIP directory is missing.');

  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let n = 0; n < entries; n += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localHeader = view.getUint32(at + 42, true);
    const entryName = textDecoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (entryName === name) {
      const dataStart =
        localHeader +
        30 +
        view.getUint16(localHeader + 26, true) +
        view.getUint16(localHeader + 28, true);
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error(
        `The file uses a ZIP compression this app can't read (method ${method}).`,
      );
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`The file has no ${name}: it may not be a Guitar Pro file.`);
}

/** Raw deflate, by the browser's own decompressor. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      // A copy, so it is backed by a plain ArrayBuffer, as the stream requires.
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// --- BCFZ / BCFS (GP6) -------------------------------------------------------

/** Reads bits most significant first, as BCFZ writes them. */
class BitReader {
  private position = 0; // in bits
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get done(): boolean {
    return this.position >= this.bytes.length * 8;
  }

  bit(): number {
    const byte = this.bytes[this.position >> 3];
    if (byte === undefined) throw new RangeError('BCFZ ran out of data');
    const value = (byte >> (7 - (this.position & 7))) & 1;
    this.position += 1;
    return value;
  }

  /** `count` bits, the first one highest. */
  bits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i += 1) value = (value << 1) | this.bit();
    return value;
  }

  /** `count` bits, the first one lowest. */
  bitsReversed(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i += 1) value |= this.bit() << i;
    return value;
  }
}

/**
 * BCFZ: a little-endian length, then a stream of chunks, which unpack to a
 * whole BCFS file, header and all. A 0 bit starts up to
 * three literal bytes; a 1 bit starts a copy of earlier output, `offset` back
 * from the end and `size` long, both `wordSize` bits.
 */
export function inflateBcfz(data: Uint8Array): Uint8Array {
  const expected = new DataView(data.buffer, data.byteOffset, 4).getInt32(0, true);
  const out = new Uint8Array(expected);
  const reader = new BitReader(data.subarray(4));
  let length = 0;

  try {
    while (length < expected) {
      if (reader.bit() === 1) {
        const wordSize = reader.bits(4);
        const offset = reader.bitsReversed(wordSize);
        const size = reader.bitsReversed(wordSize);
        const from = length - offset;
        const count = Math.min(offset, size, expected - length);
        for (let i = 0; i < count; i += 1) out[length + i] = out[from + i]!;
        length += count;
      } else {
        const size = reader.bitsReversed(2);
        for (let i = 0; i < size && length < expected; i += 1) out[length++] = reader.bits(8);
      }
    }
  } catch (error) {
    // Some files end their stream a little short of the stated length.
    if (!(error instanceof RangeError)) throw error;
  }
  return out.subarray(0, length);
}

const SECTOR = 0x1000;

/**
 * BCFS, after its 4-byte header: sectors of 4 KB, the first unused. A sector
 * whose first int is 2 describes a file: its name at 0x04, its size at 0x8c,
 * and from 0x94 the numbers of the sectors holding it, ending with 0.
 */
export function readBcfsFile(data: Uint8Array, name: string): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let offset = SECTOR; offset + 4 <= data.length; offset += SECTOR) {
    if (view.getInt32(offset, true) !== 2) continue;
    const nameBytes = data.subarray(offset + 4, offset + 4 + 127);
    const nul = nameBytes.indexOf(0);
    const fileName = textDecoder.decode(nul < 0 ? nameBytes : nameBytes.subarray(0, nul));
    const size = view.getInt32(offset + 0x8c, true);

    const sectors: number[] = [];
    for (let at = offset + 0x94; at + 4 <= data.length; at += 4) {
      const sector = view.getInt32(at, true);
      if (sector === 0) break;
      sectors.push(sector);
    }

    if (fileName === name) {
      const out = new Uint8Array(size);
      let written = 0;
      for (const sector of sectors) {
        if (written >= size) break;
        const chunk = data.subarray(
          sector * SECTOR,
          sector * SECTOR + Math.min(SECTOR, size - written),
        );
        out.set(chunk, written);
        written += chunk.length;
      }
      return out.subarray(0, written);
    }
    // The next entry comes after this file's data, never inside it.
    if (sectors.length > 0) offset = Math.max(offset, Math.max(...sectors) * SECTOR);
  }
  throw new Error(`The file has no ${name}: it may not be a Guitar Pro file.`);
}
