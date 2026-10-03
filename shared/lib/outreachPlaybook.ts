// shared/lib/outreachPlaybook.ts
// Outreach playbook context injected into prospect conversations.
//
// The playbook text is the published ReacherX outreach guide, fetched from the
// live site so blog updates reach the agent without code changes. The copy ban
// list below is code-owned and always applies, even when the guide is
// temporarily unavailable.

export const OUTREACH_PLAYBOOK_URL =
  "https://www.reacherx.com/blog/reach-out-and-get-replies/markdown";

const OUTREACH_COPY_BAN_LIST = `## Outreach Copy Rules (CRITICAL)
These rules apply to every piece of outreach copy you write: plan tasks, comments, DMs, replies, and drafts. They always apply, even when a personal writing style is also present.

## Banned AI-sounding patterns (never use)
- Never use em dashes (—) or en dashes (–) in outreach copy. Use commas, periods, or line breaks instead.
- Never open a message with "Your point", "Your point about", "Saw you", "Saw your", "Saw your post", "I saw your profile", "I came across your profile", or "Hope this finds you well".
- Avoid formulaic AI phrases: "I wanted to reach out", "I hope this message finds you well", "I just came across", "This resonated with me", "Keep up the great work", "Love what you're doing".
- Do not stack buzzwords ("thrilled", "game-changer", "synergy") or open with flattery that could apply to anyone.
- When you mention the person's work, be specific: name the actual topic, claim, or situation from their post. "You mentioned losing weekends to invoicing in your post" works because it is specific; "Saw your post" is a template and is banned.`;

// The guide is stable between deploys; re-fetching rarely keeps both the HTTP
// cost and the prompt-cache prefix stable. Failed fetches get a short retry
// window so a transient outage does not hide the guide for hours.
const PLAYBOOK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PLAYBOOK_FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;
const PLAYBOOK_FETCH_TIMEOUT_MS = 5_000;
// The published guide is a few KB. Anything far beyond that is not the guide
// (proxy error page, changed route) and would bloat every agent prompt.
const PLAYBOOK_MAX_CHARS = 64_000;

let cachedPlaybook: {
  text: string | null;
  fetchedAt: number;
  ttlMs: number;
} | null = null;

type FetchLike = typeof fetch;

/**
 * Builds the playbook system-context text. The ban list is always included;
 * the blog guide section is appended when its text is available.
 */
export function buildOutreachPlaybookMessage(
  playbookMarkdown: string | null
): string {
  const playbookSection = playbookMarkdown?.trim()
    ? `## Outreach Playbook

The tactics below are the published ReacherX outreach guide. They are the default playbook for every plan, comment, reply, or DM you draft. When a personal writing style is present, apply the playbook first and then adapt wording to that voice. When no writing style is present, follow the playbook as your voice and mention naturally in your reply that this draft used your default voice.

${playbookMarkdown.trim()}`
    : null;

  return [OUTREACH_COPY_BAN_LIST, playbookSection].filter(Boolean).join("\n\n");
}

/** Fetch the guide markdown from the live site, or null when unavailable. */
export async function fetchOutreachPlaybookMarkdown(
  fetchImpl: FetchLike = fetch
): Promise<string | null> {
  try {
    const response = await fetchImpl(OUTREACH_PLAYBOOK_URL, {
      signal: AbortSignal.timeout(PLAYBOOK_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > PLAYBOOK_MAX_CHARS
    ) {
      return null;
    }
    const text = await response.text();
    return text.trim().length > 0 && text.length <= PLAYBOOK_MAX_CHARS
      ? text
      : null;
  } catch {
    return null;
  }
}

/**
 * Returns the outreach playbook system-context message content. Never null:
 * when the guide cannot be fetched, the copy ban list is returned on its own.
 * Results are cached per runtime so repeat turns skip the network.
 */
export async function getOutreachPlaybookMessage(
  fetchImpl: FetchLike = fetch
): Promise<string> {
  if (
    cachedPlaybook &&
    Date.now() - cachedPlaybook.fetchedAt < cachedPlaybook.ttlMs
  ) {
    return buildOutreachPlaybookMessage(cachedPlaybook.text);
  }

  const text = await fetchOutreachPlaybookMarkdown(fetchImpl);
  cachedPlaybook = {
    text,
    fetchedAt: Date.now(),
    ttlMs: text ? PLAYBOOK_CACHE_TTL_MS : PLAYBOOK_FAILURE_CACHE_TTL_MS,
  };
  if (!text) {
    console.warn(
      "[outreachPlaybook] Outreach guide unavailable; proceeding with the copy ban list only."
    );
  }
  return buildOutreachPlaybookMessage(text);
}
