/**
 * Progress: everything the report, the heatmap and the fretboard explorer
 * show, as pure functions over logged reps and the per-day rollup.
 *
 * Windowed questions ("this week") read the reps in range. All-time ones
 * ("every fret I have ever played") read the rollup, which is rebuildable from
 * the reps. Nothing here touches the database.
 */
export * from './types';
export * from './days';
export * from './frets';
export * from './rollup';
export * from './calendar';
export * from './log';
export * from './coverage';
