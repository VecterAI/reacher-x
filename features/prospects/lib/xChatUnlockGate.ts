import type { XChatBrowserSessionState } from "@/features/agent/lib/xChatBrowserSession";

export type XChatUnlockGateMode =
  | "loading"
  | "pin"
  | "configuration_required"
  | "dm_restricted"
  | "attempts_exhausted"
  | "error"
  | "hidden";

export function getXChatUnlockGateMode(
  status: XChatBrowserSessionState["status"]
): XChatUnlockGateMode {
  switch (status) {
    case "unknown":
    case "checking":
    case "unlocking":
      return "loading";
    case "locked":
      return "pin";
    case "configuration_required":
      return "configuration_required";
    case "dm_restricted":
      return "dm_restricted";
    case "attempts_exhausted":
      return "attempts_exhausted";
    case "error":
    case "rate_limited":
      return "error";
    case "unlocked":
    case "unavailable":
      return "hidden";
  }
}
