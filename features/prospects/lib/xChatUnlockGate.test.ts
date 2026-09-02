import { describe, expect, it } from "vitest";
import { getXChatUnlockGateMode } from "./xChatUnlockGate";

describe("getXChatUnlockGateMode", () => {
  it.each(["unknown", "checking", "unlocking"] as const)(
    "renders %s as loading without a PIN prompt",
    (status) => {
      expect(getXChatUnlockGateMode(status)).toBe("loading");
    }
  );

  it("shows the PIN form only when XChat is locked", () => {
    expect(getXChatUnlockGateMode("locked")).toBe("pin");
  });

  it.each([
    ["configuration_required", "configuration_required"],
    ["dm_restricted", "dm_restricted"],
    ["attempts_exhausted", "attempts_exhausted"],
    ["error", "error"],
    ["rate_limited", "error"],
    ["unlocked", "hidden"],
    ["unavailable", "hidden"],
  ] as const)("maps %s to %s", (status, mode) => {
    expect(getXChatUnlockGateMode(status)).toBe(mode);
  });
});
