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
    const next = (queues.get(id) ?? Promise.resolve()).then(work, work);
    queues.set(
      id,
      next.catch(() => undefined),
    );
    return next;
  };
}
