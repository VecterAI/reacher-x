import { formatRelativeTime } from "@/shared/lib/utils";

/** "Connected · 9h" when a date exists; plain "Connected" when it does not. */
export function formatConnectedRelativeLabel(connectedAt?: Date): string {
  if (!connectedAt) {
    return "Connected";
  }
  const relative = formatRelativeTime(connectedAt.toISOString());
  return relative ? `Connected · ${relative}` : "Connected";
}
