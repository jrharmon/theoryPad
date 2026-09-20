/**
 * Writes that run one at a time per row.
 *
 * Every store update is a read-modify-write of the whole row, so two
 * overlapping ones let the slower reply win and lose the earlier change. A
 * failed write does not stall the ones queued behind it.
 */
export function serialWrites(): <T>(id: string, work: () => Promise<T>) => Promise<T> {
  const queues = new Map<string, Promise<unknown>>();
  return (id, work) => {
    // With nothing in flight the write starts here, in the caller's turn, not
    // a microtask later: a setting saved as the page unloads has no turn left.
    const running = queues.get(id);
    const next = running ? running.then(work, work) : start(work);
    queues.set(
      id,
      next.catch(() => undefined),
    );
    return next;
  };
}

/** Run now, turning a synchronous throw into a rejection like the queued path. */
function start<T>(work: () => Promise<T>): Promise<T> {
  try {
    return work();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}
