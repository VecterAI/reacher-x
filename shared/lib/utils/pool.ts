/**
 * Minimal promise pool with concurrency and basic 429 backoff handling.
 * Designed for client-side fan-out of LLM chunk filtering calls.
 */

export type PoolWorker<I, O> = (input: I) => Promise<O>;

export interface PoolOptions<O = unknown> {
  concurrency?: number; // default 4
  onProgress?: (done: number, total: number) => void;
  onItem?: (result: O, index: number) => void; // streaming callback per completed item
}

export async function runPool<I, O>(
  inputs: I[],
  worker: PoolWorker<I, O>,
  options: PoolOptions<O> = {}
): Promise<O[]> {
  const { concurrency = 4, onProgress, onItem } = options;
  const queue: Array<{ value: I; index: number }> = inputs.map((v, i) => ({
    value: v,
    index: i,
  }));
  const results: O[] = [];
  let completed = 0;

  async function runOne(): Promise<void> {
    const next = queue.shift();
    if (!next) return;
    const { value, index } = next;
    try {
      const res = await worker(value);
      results.push(res);
      try {
        onItem?.(res, index);
      } catch {}
    } catch (e: unknown) {
      // Basic 429/Rate limit handling: small jittered backoff then retry once
      const msg =
        typeof (e as { message?: string })?.message === "string"
          ? (e as { message: string }).message
          : "";
      if (/429/.test(msg)) {
        const delay = 400 + Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, delay));
        try {
          const res = await worker(value);
          results.push(res);
          try {
            onItem?.(res, index);
          } catch {}
        } catch {
          // Swallow final failure; caller can decide how to treat missing slot
        }
      }
    } finally {
      completed += 1;
      onProgress?.(completed, inputs.length);
      if (queue.length > 0) {
        await runOne();
      }
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, inputs.length) },
    () => runOne()
  );
  await Promise.all(runners);
  return results;
}
