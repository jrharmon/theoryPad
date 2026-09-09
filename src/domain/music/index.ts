/**
 * The music layer. `tonal` is imported here and nowhere else in the app —
 * ESLint enforces it — so the rest of the codebase sees branded types,
 * exhaustive unions, and spelling that has already been made conventional.
 */
export * from './types';
export * from './pitch';
export * from './spelling';
export * from './scale';
export * from './chords';
export * from './keySignature';
