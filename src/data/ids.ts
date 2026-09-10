import type { Uuid } from './entities';

/**
 * Client-generated ids. Never auto-increment: two devices must be able to
 * create rows without colliding, or sync becomes a merge problem.
 */
export function newId(): Uuid {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Older environments and some test runners.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
