/**
 * Feature flag helpers
 */

export function isLlmFilterDisabled(): boolean {
  try {
    const raw = process.env.NEXT_PUBLIC_DISABLE_LLM_FILTER;
    if (!raw) return false;
    const value = String(raw).trim().toLowerCase();
    return (
      value === "1" || value === "true" || value === "yes" || value === "on"
    );
  } catch {
    return false;
  }
}
