/**
 * The layer boundaries in eslint.config.js are load-bearing: they are listed as
 * non-negotiables in CLAUDE.md, so if they silently stop firing, agents violate
 * them freely. Flat config makes that easy to do by accident — for a given rule
 * the last matching block wins outright rather than merging.
 *
 * This test lints in-memory fixtures to assert the boundaries actually fire.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const eslint = new ESLint({ cwd: process.cwd() });

/**
 * typescript-eslint's project service resolves real paths, so in-memory text is
 * not enough — fixtures are written under src/ (where tsconfig.app.json picks
 * them up) and removed afterwards.
 */
const FIXTURE_LEAF = '__boundary_fixture__.ts';
const written = new Set<string>();

async function messagesFor(dir: string, code: string): Promise<string[]> {
  const filePath = join(process.cwd(), dir, FIXTURE_LEAF);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, code);
  written.add(filePath);

  const results = await eslint.lintText(code, { filePath, warnIgnored: false });
  return results.flatMap((r) => r.messages.map((m) => `${m.ruleId ?? '?'}: ${m.message}`));
}

afterAll(() => {
  for (const f of written) rmSync(f, { force: true });
});

const IMPORT_ALL = "import 'tonal';\nimport 'tone';\nimport 'dexie';\n";

function restricted(messages: string[], lib: string): boolean {
  return messages.some((m) => m.startsWith('no-restricted-imports') && m.includes(`'${lib}'`));
}

describe('library confinement', () => {
  const cases: { dir: string; allows: string | null }[] = [
    { dir: 'src/domain/music', allows: 'tonal' },
    { dir: 'src/audio', allows: 'tone' },
    { dir: 'src/data', allows: 'dexie' },
    { dir: 'src/exercises', allows: null },
    { dir: 'src/components', allows: null },
    { dir: 'src/lib', allows: null },
  ];

  for (const { dir, allows } of cases) {
    it(`${dir} allows ${allows ?? 'none'} and blocks the rest`, async () => {
      const messages = await messagesFor(dir, IMPORT_ALL);
      for (const lib of ['tonal', 'tone', 'dexie']) {
        expect(restricted(messages, lib), `${lib} in ${dir}`).toBe(lib !== allows);
      }
    });
  }
});

describe('src/domain purity', () => {
  it('rejects React imports', async () => {
    const messages = await messagesFor(
      'src/domain',
      "import { useState } from 'react';\nexport const x = useState;\n",
    );
    expect(messages.some((m) => m.includes('must not import React'))).toBe(true);
  });

  it('rejects upper-layer imports', async () => {
    const messages = await messagesFor('src/domain', "export * from '@/store/session';\n");
    expect(messages.some((m) => m.includes('It is pure.'))).toBe(true);
  });

  it('rejects Math.random()', async () => {
    const messages = await messagesFor('src/domain', 'export const r = Math.random();\n');
    expect(messages.some((m) => m.includes('seeded Rng'))).toBe(true);
  });

  it('rejects reading the clock', async () => {
    const now = await messagesFor('src/domain', 'export const t = Date.now();\n');
    expect(now.some((m) => m.includes('never read the clock'))).toBe(true);

    const ctor = await messagesFor('src/domain', 'export const d = new Date();\n');
    expect(ctor.some((m) => m.includes('never read the clock'))).toBe(true);
  });

  it('still allows pure domain code', async () => {
    const messages = await messagesFor(
      'src/domain',
      'export function add(a: number, b: number): number {\n  return a + b;\n}\n',
    );
    expect(messages).toEqual([]);
  });
});

describe('src/exercises boundaries', () => {
  it('rejects importing the store or data layer', async () => {
    const messages = await messagesFor('src/exercises', "export * from '@/data/db';\n");
    expect(messages.some((m) => m.includes('Exercise definitions are pure'))).toBe(true);
  });
});
