import { describe, expect, it } from 'vitest';
import { serialWrites } from '../util';

describe('serialWrites', () => {
  it('runs one row’s writes in order, past a failure, without holding up other rows', async () => {
    const queued = serialWrites();
    const log: string[] = [];
    const slow = (label: string, ms: number) => () =>
      new Promise<string>((resolve) =>
        setTimeout(() => {
          log.push(label);
          resolve(label);
        }, ms),
      );

    // The first write for a row starts at once; the rest queue behind it.
    let started = false;
    void queued('started', () => {
      started = true;
      return Promise.resolve();
    });
    expect(started).toBe(true);

    const first = queued('a', slow('a1', 20));
    const failed = queued('a', () => Promise.reject(new Error('write failed')));
    const third = queued('a', slow('a3', 0));
    const other = queued('b', slow('b1', 5));

    await expect(failed).rejects.toThrow('write failed');
    expect(await Promise.all([first, third, other])).toEqual(['a1', 'a3', 'b1']);
    expect(log).toEqual(['b1', 'a1', 'a3']);
  });
});
