/**
 * Allowlisted labels that external contributors may apply to their own issues
 * via the issue form "Areas" checkboxes or a `/label ...` comment command.
 * Priority, triage, and resolution labels (such as `P2`, `help wanted`,
 * `good first issue`, `duplicate`, `invalid`, `wontfix`) stay maintainer-only.
 */
export const ALLOWED_LABELS = new Set([
  "bug",
  "enhancement",
  "documentation",
  "question",
  "backend",
  "ui",
  "prospecting",
  "benchmark",
  "performance",
  "architecture",
]);

export const MAX_LABELS_PER_COMMENT = 5;

const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/**
 * Normalizes a raw candidate token and returns it only if it is allowlisted.
 */
function normalizeAllowedLabel(raw) {
  const token = raw
    .trim()
    .toLowerCase()
    .replace(/^`+|`+$/g, "")
    .replace(/[.,;:]+$/g, "");
  return ALLOWED_LABELS.has(token) ? token : null;
}

/**
 * Extracts checked allowlisted labels from the `### Areas` section rendered by
 * GitHub Issue Forms (`- [x] backend` or `- [x] backend - description`).
 */
export function extractLabelsFromIssueBody(body) {
  if (typeof body !== "string" || body.length === 0) {
    return [];
  }

  const lines = body.split(/\r?\n/);
  const found = new Set();
  let inAreasSection = false;

  for (const line of lines) {
    if (/^###\s+areas\s*$/i.test(line.trim())) {
      inAreasSection = true;
      continue;
    }

    if (inAreasSection && /^#{1,6}\s+/.test(line.trim())) {
      break;
    }

    if (!inAreasSection) {
      continue;
    }

    const match = /^\s*-\s*\[[xX]\]\s+(.+)$/.exec(line);
    if (!match) {
      continue;
    }

    // Take the leading label token before any optional description text.
    const leadingToken = match[1].split(/\s+[-(]/)[0] ?? "";
    const normalized = normalizeAllowedLabel(leadingToken);
    if (normalized) {
      found.add(normalized);
    }
  }

  return [...found];
}

/**
 * Extracts allowlisted labels from `/label <tags>` lines in an issue comment.
 * Supports comma- or space-separated tags (for example `/label backend, ui`).
 */
export function extractLabelsFromComment(body) {
  if (typeof body !== "string" || body.length === 0) {
    return [];
  }

  const lines = body.split(/\r?\n/);
  const found = new Set();

  for (const line of lines) {
    const match = /^\s*\/label\s+(.+)$/i.exec(line);
    if (!match) {
      continue;
    }

    const tokens = match[1].split(/[,\s]+/);
    for (const token of tokens) {
      const normalized = normalizeAllowedLabel(token);
      if (normalized) {
        found.add(normalized);
        if (found.size >= MAX_LABELS_PER_COMMENT) {
          return [...found];
        }
      }
    }
  }

  return [...found];
}

/**
 * Allows `/label` comments only from the issue author or repo collaborators.
 */
export function canAuthorApplyCommentLabels({
  commentAuthorId,
  issueAuthorId,
  authorAssociation,
}) {
  if (
    typeof commentAuthorId === "number" &&
    typeof issueAuthorId === "number" &&
    commentAuthorId === issueAuthorId
  ) {
    return true;
  }

  return (
    typeof authorAssociation === "string" &&
    TRUSTED_ASSOCIATIONS.has(authorAssociation)
  );
}

/**
 * Intersects requested labels with labels that actually exist on the repository
 * (preserving canonical repo casing) and skips labels already on the issue.
 */
export function selectLabelsToAdd({
  requestedLabels,
  existingIssueLabels,
  repoLabels,
}) {
  const repoLabelByLower = new Map();
  for (const name of repoLabels) {
    repoLabelByLower.set(name.toLowerCase(), name);
  }

  const existingLower = new Set(
    existingIssueLabels.map((name) => name.toLowerCase())
  );

  const toAdd = [];
  for (const label of requestedLabels) {
    const lower = label.toLowerCase();
    if (!ALLOWED_LABELS.has(lower) || existingLower.has(lower)) {
      continue;
    }
    const canonical = repoLabelByLower.get(lower);
    if (canonical) {
      toAdd.push(canonical);
      existingLower.add(lower);
    }
  }

  return toAdd;
}
