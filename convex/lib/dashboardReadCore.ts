export const DASHBOARD_READ_CHUNK_DAYS = 31;

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardDayChunk = {
  startDayStartUtcMs: number;
  endDayStartUtcMs: number;
};

/**
 * Split an inclusive UTC-day range into bounded query transactions.
 *
 * Daily dashboard rows can have one baseline plus 32 active stripes per day.
 * Keeping each transaction to 31 days caps either daily model at 1,023 rows.
 */
export function splitDashboardDayRange(args: {
  startDayStartUtcMs: number;
  endDayStartUtcMs: number;
  chunkDays?: number;
}): DashboardDayChunk[] {
  const chunkDays = Math.max(
    1,
    Math.floor(args.chunkDays ?? DASHBOARD_READ_CHUNK_DAYS)
  );
  const orderedStart = Math.min(args.startDayStartUtcMs, args.endDayStartUtcMs);
  const orderedEnd = Math.max(args.startDayStartUtcMs, args.endDayStartUtcMs);
  const chunks: DashboardDayChunk[] = [];

  for (
    let chunkStart = orderedStart;
    chunkStart <= orderedEnd;
    chunkStart += chunkDays * UTC_DAY_MS
  ) {
    chunks.push({
      startDayStartUtcMs: chunkStart,
      endDayStartUtcMs: Math.min(
        orderedEnd,
        chunkStart + (chunkDays - 1) * UTC_DAY_MS
      ),
    });
  }

  return chunks;
}

export function getDashboardChunkWorstCaseRows(args: {
  chunkDays?: number;
  stripesPerDay: number;
  includeBaseline?: boolean;
}): number {
  const chunkDays = Math.max(
    1,
    Math.floor(args.chunkDays ?? DASHBOARD_READ_CHUNK_DAYS)
  );
  return (
    chunkDays *
    (Math.max(0, Math.floor(args.stripesPerDay)) +
      (args.includeBaseline === false ? 0 : 1))
  );
}

export async function mapDashboardChunksSequentially<T>(args: {
  chunks: DashboardDayChunk[];
  load: (chunk: DashboardDayChunk) => Promise<T>;
  index?: number;
}): Promise<T[]> {
  const index = args.index ?? 0;
  const chunk = args.chunks[index];
  if (!chunk) return [];

  const current = await args.load(chunk);
  const remaining = await mapDashboardChunksSequentially({
    ...args,
    index: index + 1,
  });
  return [current, ...remaining];
}
