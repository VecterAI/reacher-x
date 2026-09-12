export function getPlanUsageNoticeKey(cycleKey: string, limit: number) {
  return `plan-usage:${cycleKey}:${limit}`;
}

export function getUsageProgress(used: number, limit: number) {
  const safeUsed = Number.isFinite(used) ? Math.max(0, used) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(0, limit) : 0;
  return {
    used: safeUsed,
    remaining: Math.max(0, safeLimit - safeUsed),
    fraction: safeLimit > 0 ? Math.min(1, safeUsed / safeLimit) : 0,
  };
}
