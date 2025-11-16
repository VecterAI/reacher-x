// shared/lib/utils/linkedinQuery.ts
// LinkedIn "keyword" param builder aligned with current product behavior:
// - Exact match toggle only (wrap whole query in quotes when enabled)
// - No advanced boolean UI for now; we still normalize basic +/- if present inadvertently.
// References:
// - LinkedIn Boolean search: https://www.linkedin.com/help/linkedin/answer/a524335
// - Package.json stack: Next.js 15, React 19, Convex 1.x (no extra deps)

export function buildLinkedInKeyword(raw: string, exact: boolean): string {
  let q = (raw || "").trim().replace(/\s+/g, " ");
  if (!q) return q;

  // Defensive cleanup: remove unsupported wildcards/brackets
  q = q.replace(/[\*\?\[\]\{\}<>]/g, "");

  // Normalize incidental '+'/'-' usage into AND/NOT tokens, but we will not
  // advertise boolean in the UI yet.
  q = q.replace(/\s*\+\s*/g, " AND ");
  q = q.replace(/(^|\s)-(\w+)/g, (_m, pre, term) => `${pre} NOT ${term}`);
  q = q.replace(/\b(and|or|not)\b/gi, (m) => m.toUpperCase());

  // Current product parity: exact match uses quotes when there are no explicit boolean ops
  const hasBoolean = /\b(AND|OR|NOT)\b|\(|\)/.test(q);
  if (exact && !hasBoolean) {
    // Wrap entire string in quotes for phrase match (LinkedIn honors quotes)
    q = `"${q}"`;
  }

  // Clamp length to our UI budget (Twitter parity)
  if (q.length > 512) q = q.slice(0, 512);
  return q;
}
