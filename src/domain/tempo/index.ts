/**
 * Tempo.
 *
 * `targetTempo` is the exercise's configured, intended tempo. It is persisted,
 * and changing it is always an explicit user action — never automatic, and
 * never a side effect of practicing.
 *
 * `currentTempo` is transient session state: what the metronome is actually
 * running at now. The player moves it freely, up to test themselves or down to
 * woodshed, and it is never written back to `targetTempo`.
 *
 * `maxTempo` is manually entered, record-keeping only. Nothing reads it.
 */
export interface TempoConfig {
  targetTempo: number | null;
  maxTempo: number | null;
}

/** How an exercise derives its starting tempo from `targetTempo`. */
export type TempoPlan =
  | { kind: 'target' }
  | { kind: 'percent'; pct: number }
  | { kind: 'ladder'; startPct: number; stepBpm: number; everyReps: number }
  | { kind: 'none' };

export const DEFAULT_TEMPO_PLAN: TempoPlan = { kind: 'target' };

/** Sane bounds; the UI clamps to these and so does anything derived. */
export const MIN_TEMPO = 30;
export const MAX_TEMPO = 300;

export function clampTempo(bpm: number): number {
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));
}

/**
 * The tempo a rep starts at. Null means no pulse — a theory exercise, or an
 * exercise running in free time.
 */
export function resolveStartTempo(
  config: TempoConfig,
  plan: TempoPlan = DEFAULT_TEMPO_PLAN,
  repIndex = 0,
): number | null {
  if (plan.kind === 'none' || config.targetTempo === null) return null;

  switch (plan.kind) {
    case 'target':
      return clampTempo(config.targetTempo);
    case 'percent':
      return clampTempo(config.targetTempo * plan.pct);
    case 'ladder': {
      const steps = Math.floor(repIndex / Math.max(1, plan.everyReps));
      return clampTempo(config.targetTempo * plan.startPct + steps * plan.stepBpm);
    }
  }
}

/** Whether the player has moved away from the configured tempo. */
export function isOffTarget(config: TempoConfig, currentTempo: number | null): boolean {
  if (config.targetTempo === null || currentTempo === null) return false;
  return currentTempo !== config.targetTempo;
}
