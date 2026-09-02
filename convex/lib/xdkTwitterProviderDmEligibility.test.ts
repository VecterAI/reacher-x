import { describe, expect, it } from "vitest";
import { getLegacyUserDmEligibility } from "./xdkTwitterProvider";

describe("X/Twitter receives_your_dm mapping", () => {
  it.each([
    [{ receives_your_dm: true }, true],
    [{ receivesYourDm: false }, false],
    [{ can_dm: true }, true],
  ] as const)("preserves an explicit boolean", (user, expected) => {
    expect(getLegacyUserDmEligibility(user)).toBe(expected);
  });

  it("keeps an omitted value unknown instead of treating it as false", () => {
    expect(getLegacyUserDmEligibility({ username: "avery" })).toBeUndefined();
    expect(
      getLegacyUserDmEligibility({ receives_your_dm: "false" })
    ).toBeUndefined();
  });
});
