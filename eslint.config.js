import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * Layer boundaries (docs/plan/01-ARCHITECTURE.md).
 *
 * Import direction:
 *   routes → components → domain
 *   routes → store → domain
 *   store  → session, data, audio
 *   session → exercises, data, domain (audio as types only)
 *   exercises → domain
 *   domain → lib only
 *
 * Wide third-party APIs are each confined to one wrapper directory so they stay
 * testable and swappable: tonal, tone, dexie.
 */
/**
 * Third-party libraries with wide API surfaces are each confined to one wrapper
 * directory, so they stay testable and swappable.
 */
const CONFINED = {
  tonal: {
    dir: 'src/domain/music',
    message: 'Import the wrapper in src/domain/music instead.',
  },
  tone: { dir: 'src/audio', message: 'Import the AudioEngine facade in src/audio instead.' },
  dexie: { dir: 'src/data', message: 'Use a repository from src/data instead.' },
  'dexie-react-hooks': { dir: 'src/data', message: 'Use a repository from src/data instead.' },
};

/** Confinement entries that apply to a file outside `ownerDir`. */
function confinedPaths(ownerDir) {
  return Object.entries(CONFINED)
    .filter(([, v]) => v.dir !== ownerDir)
    .map(([name, v]) => ({ name, message: v.message }));
}

/**
 * ESLint flat config: for a given rule, the LAST matching block wins outright —
 * configs do not merge. So every block below sets the complete restriction list
 * for the files it covers, and blocks are ordered general → specific.
 */
function restrictImports({ ownerDir = null, patterns = [] } = {}) {
  return {
    'no-restricted-imports': ['error', { paths: confinedPaths(ownerDir), patterns }],
  };
}

const DOMAIN_PATTERNS = [
  {
    group: [
      '@/components/*',
      '@/routes/*',
      '@/store/*',
      '@/data/*',
      '@/audio/*',
      '@/app/*',
      '@/exercises/*',
    ],
    message: 'src/domain must not import the app, UI, store, data or audio layers. It is pure.',
  },
  {
    group: ['react', 'react-dom', 'react-router', 'react/*', 'react-dom/*', 'react-router/*'],
    message: 'src/domain must not import React. It is pure logic.',
  },
];

const DOMAIN_PURITY_RULES = {
  'no-restricted-globals': [
    'error',
    { name: 'window', message: 'src/domain is pure — no DOM.' },
    { name: 'document', message: 'src/domain is pure — no DOM.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
      message: 'src/domain must use the injected seeded Rng, never Math.random().',
    },
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message: 'src/domain must take time as a parameter, never read the clock.',
    },
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'src/domain must take time as a parameter, never read the clock.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      // Source material, not our code.
      'design_handoff_fretwork',
    ],
  },

  js.configs.recommended,

  // Type-aware linting applies to TypeScript sources only.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // --- Layer boundaries (docs/plan/01-ARCHITECTURE.md) ---
  // Ordered general → specific; the last matching block wins.

  { files: ['src/**/*.{ts,tsx}'], rules: restrictImports() },

  {
    files: ['src/exercises/**/*.{ts,tsx}'],
    rules: restrictImports({
      patterns: [
        {
          group: ['@/routes/*', '@/store/*', '@/data/*'],
          message:
            'Exercise definitions are pure: domain, shared generators and components only.',
        },
      ],
    }),
  },

  // A session is framework-free, and reaches audio only through the port it is
  // given: importing '@/audio' at runtime would put Tone on the first-paint path.
  {
    files: ['src/session/**/*.{ts,tsx}'],
    ignores: ['src/session/**/__tests__/**'],
    rules: restrictImports({
      patterns: [
        {
          group: ['@/store', '@/store/*', '@/routes/*', '@/components/*', 'react', 'zustand'],
          message:
            'A practice session is framework-free: the store adapts it, not the reverse.',
        },
        {
          group: ['@/audio', '@/audio/*'],
          allowTypeImports: true,
          message: 'A session gets audio through its AudioPort; import types only.',
        },
      ],
    }),
  },

  {
    files: ['src/audio/**/*.{ts,tsx}'],
    rules: restrictImports({ ownerDir: 'src/audio' }),
  },

  {
    files: ['src/data/**/*.{ts,tsx}'],
    rules: restrictImports({ ownerDir: 'src/data' }),
  },

  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: { ...restrictImports({ patterns: DOMAIN_PATTERNS }), ...DOMAIN_PURITY_RULES },
  },

  {
    files: ['src/domain/music/**/*.{ts,tsx}'],
    rules: {
      ...restrictImports({ ownerDir: 'src/domain/music', patterns: DOMAIN_PATTERNS }),
      ...DOMAIN_PURITY_RULES,
    },
  },

  // shadcn components export their cva variants alongside the component, which
  // is its convention and not worth restructuring generated files over.
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Plain JS (this config file) gets no type-aware rules.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Config and test files run in Node.
  {
    files: ['*.config.{ts,js}', 'test/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  prettier,
);
