import { WORKSPACE_NAME_CONSTRAINTS } from "../../shared/lib/utils/validation/validation";

const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
const LEADING_FORMATTING_ARTIFACTS_REGEX = /^[\s::\-–—*_#>~|`"'.,;!?()[\]{}]+/;

export function normalizeWorkspaceName(rawName: string): string {
  const collapsedWhitespaceName = rawName
    .replace(MULTIPLE_WHITESPACE_REGEX, " ")
    .trim();

  // Strip common leading formatting artifacts from AI output, e.g. ": Name".
  return collapsedWhitespaceName
    .replace(LEADING_FORMATTING_ARTIFACTS_REGEX, "")
    .trimStart();
}

export function validateWorkspaceName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (name.length < WORKSPACE_NAME_CONSTRAINTS.MIN_LENGTH) {
    return {
      isValid: false,
      error: "Workspace name is required.",
    };
  }

  if (name.length > WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Workspace name must not exceed ${WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH} characters.`,
    };
  }

  return { isValid: true };
}

export function assertValidWorkspaceName(rawName: string): string {
  const normalizedName = normalizeWorkspaceName(rawName);
  const validation = validateWorkspaceName(normalizedName);

  if (!validation.isValid) {
    throw new Error(validation.error ?? "Invalid workspace name.");
  }

  return normalizedName;
}

export function normalizeWorkspaceNameForSuggestion(
  rawName: string,
  fallback: string = "Workspace"
): string {
  const fallbackNormalized = normalizeWorkspaceName(fallback);
  const normalized = normalizeWorkspaceName(rawName);
  const candidate = normalized || fallbackNormalized || "Workspace";

  if (candidate.length <= WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH) {
    return candidate;
  }

  return candidate.slice(0, WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH).trimEnd();
}
