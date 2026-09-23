/**
 * Cuts the sample sets TheoryPad ships under public/samples/v1/ and writes their CREDITS.md.
 *
 *   node scripts/fetch-samples.mjs
 *
 * Run by hand, once; the output is committed. This exists so the cut is reproducible and
 * reviewable — it is not part of `pnpm build` and must not become part of it. Needs `ffmpeg`
 * on the PATH for the drum kit. Downloads are cached in .cache/samples/.
 *
 * Every source is pinned to a commit, so a re-run fetches the same bytes. The pitched voices
 * are copied byte for byte — they are mp3 at the source, and re-encoding a lossy file only
 * loses more. The kit is lossless at the source and is trimmed and encoded here.
 *
 * v1/ never changes once committed: a re-cut goes in v2/. See docs/plan/12-SOUNDS.md.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, '.cache', 'samples');
const OUT = join(ROOT, 'public', 'samples', 'v1');

export const SOURCES = {
  salamander: {
    work: 'Salamander Grand Piano V3',
    author: 'Alexander Holm',
    licence: 'CC-BY 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/3.0/',
    home: 'https://github.com/Tonejs/audio/tree/master/salamander',
    base: 'https://raw.githubusercontent.com/Tonejs/audio/efd8296360f9526e379bfbe5c1698ff54d6a1d34/salamander',
    /** Salamander was recorded every minor third, and names its sharps `Ds`, `Fs`. */
    remote: (midi) => `${noteName(midi, SHARP_S)}.mp3`,
  },
  fluid: {
    work: 'FluidR3_GM, pre-rendered by midi-js-soundfonts',
    author: 'Frank Wen (FluidR3_GM); Benjamin Gleitzman (rendering)',
    licence: 'CC-BY 3.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/3.0/us/',
    home: 'https://github.com/gleitz/midi-js-soundfonts',
    base: 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/044fab8e1456bfafc5776e86dfd6bb8697149aef/FluidR3_GM',
    remote: (midi, instrument) => `${instrument}-mp3/${noteName(midi, FLAT)}.mp3`,
  },
  sonicPi: {
    work: 'Sonic Pi sample library',
    author: 'Sonic Pi contributors; original recordings from freesound.org (per file below)',
    licence: 'CC0 1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    home: 'https://github.com/sonic-pi-net/sonic-pi/tree/dev/etc/samples',
    base: 'https://raw.githubusercontent.com/sonic-pi-net/sonic-pi/aaaef697834c044b52e0005d31213430834ea48f/etc/samples',
    remote: (name) => `${name}.flac`,
  },
};

/**
 * The pitched voices. Samples sit every `step` semitones on the pitch classes of `anchor`,
 * spanning `low`–`high` so that no note in range is shifted more than half a step.
 */
export const VOICES = [
  { dir: 'piano', source: 'salamander', anchor: 'A0', low: 'E1', high: 'C7', step: 3 },
  {
    dir: 'guitar',
    source: 'fluid',
    instrument: 'acoustic_guitar_steel',
    // Every semitone: shifted guitar notes sounded synthetic by ear. B1 is the 7-string's low B.
    anchor: 'E2',
    low: 'B1',
    high: 'E6',
    step: 1,
  },
  {
    dir: 'bass',
    source: 'fluid',
    instrument: 'acoustic_bass',
    // Anchored on E so the E strings are real samples.
    anchor: 'E1',
    low: 'B0',
    high: 'G3',
    step: 3,
  },
];

/**
 * The drum kit: one file per role. `seconds` cuts a long tail (with a short fade), and
 * `author`/`original` are the freesound credit Sonic Pi records for the file.
 */
export const KIT = [
  {
    role: 'kick',
    name: 'drum_heavy_kick',
    author: 'Zajo',
    original: 'https://freesound.org/people/Zajo/sounds/4832/',
  },
  {
    role: 'snare',
    name: 'drum_snare_hard',
    author: 'menegass',
    original: 'https://freesound.org/people/menegass/sounds/100058/',
  },
  {
    role: 'hat-closed',
    name: 'drum_cymbal_closed',
    author: 'menegass',
    original: 'https://freesound.org/people/menegass/sounds/100053/',
  },
  {
    role: 'hat-open',
    name: 'drum_cymbal_open',
    seconds: 1.2,
    author: 'menegass',
    original: 'https://freesound.org/people/menegass/sounds/100055/',
  },
  {
    role: 'ride',
    name: 'drum_cymbal_soft',
    seconds: 1.5,
    author: 'menegass',
    original: 'https://freesound.org/people/menegass/sounds/100057/',
  },
  {
    role: 'crash',
    name: 'drum_splash_hard',
    seconds: 2.5,
    author: 'menegass',
    original: 'https://freesound.org/people/menegass/sounds/100060/',
  },
  {
    role: 'stick',
    name: 'perc_snap',
    author: 'SoundCollectah',
    original: 'https://freesound.org/people/SoundCollectah/sounds/109400/',
  },
];

/** 'mp3' or 'flac'. */
export const KIT_FORMAT = 'mp3';

const FADE_SECONDS = 0.15;

// ---------------------------------------------------------------------------------------------
// Pitch names

export const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SHARP_S = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

export function midiOf(name) {
  const match = /^([A-G])(b|#|s)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Not a pitch: ${name}`);
  const [, letter, accidental, octave] = match;
  const offset = accidental === 'b' ? -1 : accidental ? 1 : 0;
  return (Number(octave) + 1) * 12 + FLAT.indexOf(letter) + offset;
}

export function noteName(midi, names = FLAT) {
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Every sampled pitch for a voice: on the anchor's grid, within half a step of the range. */
export function sampledNotes({ anchor, low, high, step }) {
  const reach = Math.floor(step / 2);
  const from = midiOf(low) - reach;
  const to = midiOf(high) + reach;
  const phase = midiOf(anchor) % step;
  const notes = [];
  for (let midi = from; midi <= to; midi++) {
    if (midi % step === phase) notes.push(midi);
  }
  return notes;
}

// ---------------------------------------------------------------------------------------------
// Fetching and cutting

export async function fetchCached(url, cacheName) {
  const path = join(CACHE, cacheName);
  if (existsSync(path)) return path;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

export function voiceFiles(voice) {
  const source = SOURCES[voice.source];
  return sampledNotes(voice).map((midi) => {
    const remote = source.remote(midi, voice.instrument);
    return {
      url: `${source.base}/${remote}`,
      cacheName: `${voice.source}/${remote}`,
      file: `${noteName(midi)}.mp3`,
    };
  });
}

export function kitUrl(name) {
  return `${SOURCES.sonicPi.base}/${SOURCES.sonicPi.remote(name)}`;
}

/** Strips silence before the hit, cuts the tail with a fade, and encodes. */
export function cutKitFile(from, to, { seconds, format = KIT_FORMAT }) {
  const filters = ['silenceremove=start_periods=1:start_threshold=-60dB'];
  if (seconds) {
    filters.push(
      `atrim=end=${seconds}`,
      `afade=t=out:st=${seconds - FADE_SECONDS}:d=${FADE_SECONDS}`,
    );
  }
  const codec = format === 'mp3' ? ['-c:a', 'libmp3lame', '-q:a', '2'] : ['-c:a', 'flac'];
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    from,
    '-af',
    filters.join(','),
    // No encoder tag or copied metadata, so the same input always gives the same bytes.
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    ...codec,
    to,
  ]);
}

function requireFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('ffmpeg is not on the PATH. Install it (brew install ffmpeg) and run again.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------------
// CREDITS.md

function credits() {
  const lines = [
    '# Sample credits',
    '',
    'The sounds TheoryPad plays are recordings made and shared by the people below. Generated by',
    '`scripts/fetch-samples.mjs`; do not edit by hand.',
    '',
  ];
  const section = (source, title, body) => {
    const s = SOURCES[source];
    lines.push(`## ${title}`, '');
    lines.push(`- **Work:** ${s.work}`);
    lines.push(`- **Author:** ${s.author}`);
    lines.push(`- **Licence:** [${s.licence}](${s.licenceUrl})`);
    lines.push(`- **Source:** <${s.home}>`);
    lines.push(...body, '');
  };
  for (const voice of VOICES) {
    const notes = sampledNotes(voice);
    const what = voice.instrument ? ` (\`${voice.instrument}\`)` : '';
    const spacing = voice.step === 1 ? 'every semitone' : `every ${voice.step} semitones`;
    section(
      voice.source,
      `${voice.dir[0].toUpperCase()}${voice.dir.slice(1)} — \`${voice.dir}/\``,
      [
        `- **Files:** ${notes.length} notes${what}, ${noteName(notes[0])} to ${noteName(notes.at(-1))}, ${spacing}.`,
        '- **Changes:** none — copied unchanged, renamed to flat pitch names.',
      ],
    );
  }
  section('sonicPi', 'Drum kit — `kit/`', [
    `- **Changes:** leading silence removed, long tails trimmed with a fade, encoded as ${KIT_FORMAT}.`,
    '',
    '| File | Sonic Pi sample | Original recording |',
    '| --- | --- | --- |',
    ...KIT.map(
      (k) => `| \`${k.role}.${KIT_FORMAT}\` | \`${k.name}\` | [${k.author}](${k.original}) |`,
    ),
  ]);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------

async function sizeOf(dir) {
  let total = 0;
  for (const name of await readdir(dir)) total += (await stat(join(dir, name))).size;
  return total;
}

async function main() {
  requireFfmpeg();
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
  let total = 0;

  for (const voice of VOICES) {
    const dir = join(OUT, voice.dir);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const files = voiceFiles(voice);
    for (const f of files)
      await copyFile(await fetchCached(f.url, f.cacheName), join(dir, f.file));
    const size = await sizeOf(dir);
    total += size;
    console.log(
      `${voice.dir.padEnd(7)} ${String(files.length).padStart(3)} files  ${kb(size)}`,
    );
  }

  const kitDir = join(OUT, 'kit');
  await rm(kitDir, { recursive: true, force: true });
  await mkdir(kitDir, { recursive: true });
  for (const k of KIT) {
    const from = await fetchCached(kitUrl(k.name), `sonicPi/${k.name}.flac`);
    cutKitFile(from, join(kitDir, `${k.role}.${KIT_FORMAT}`), k);
  }
  const kitSize = await sizeOf(kitDir);
  total += kitSize;
  console.log(`kit     ${String(KIT.length).padStart(3)} files  ${kb(kitSize)}`);

  await writeFile(join(OUT, 'CREDITS.md'), credits() + '\n');
  console.log(`total              ${kb(total)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
