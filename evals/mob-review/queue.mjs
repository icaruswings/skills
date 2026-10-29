/** Drain planned rows without releasing ownership while workers still run. */
export async function drainQueue(rows, { jobs, shouldStop, run }) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  if (!Number.isInteger(jobs) || jobs < 1) throw new TypeError('jobs must be a positive integer');
  if (typeof shouldStop !== 'function') throw new TypeError('shouldStop must be a function');
  if (typeof run !== 'function') throw new TypeError('run must be a function');
  let cursor = 0, stopped = false;
  const results = [];
  async function worker() {
    try {
      while (!stopped && cursor < rows.length) {
        if (await shouldStop()) { stopped = true; return; }
        if (stopped || cursor >= rows.length) return;
        const row = rows[cursor++];
        results.push(await run(row));
      }
    } catch (error) {
      stopped = true;
      throw error;
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: Math.min(jobs, rows.length) }, worker));
  const errors = settled.filter(result => result.status === 'rejected').map(result => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Queue workers failed');
  return results;
}
