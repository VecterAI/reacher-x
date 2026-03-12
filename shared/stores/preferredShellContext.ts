import { atom } from "nanostores";

export type PreferredShellContext = "workspace" | "setup_session";

const STORAGE_KEY = "reacherx.preferred-shell-context";

function parsePreferredShellContext(
  value: string | null
): PreferredShellContext | null {
  if (value === "workspace" || value === "setup_session") {
    return value;
  }

  return null;
}

function readStoredPreferredShellContext(): PreferredShellContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parsePreferredShellContext(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export const $preferredShellContext = atom<PreferredShellContext | null>(
  readStoredPreferredShellContext()
);

export function setPreferredShellContext(
  nextContext: PreferredShellContext | null
): void {
  $preferredShellContext.set(nextContext);

  if (typeof window === "undefined") {
    return;
  }

  try {
    if (nextContext === null) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, nextContext);
  } catch {
    // Ignore storage write failures and keep the in-memory preference.
  }
}
