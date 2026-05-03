/** Formats ISO-ish DM timestamps for conversation UI (matches locale time style). */
export function formatDmMessageTime(timestamp?: string): string {
  if (!timestamp) return "";
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
