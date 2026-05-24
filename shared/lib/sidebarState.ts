export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const SIDEBAR_WIDTH = "16rem";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_WIDTH_MOBILE = "18rem";

export const DEFAULT_SIDEBAR_OPEN = true;

export function parseSidebarOpenState(
  value: string | null | undefined
): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return DEFAULT_SIDEBAR_OPEN;
}
