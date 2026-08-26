import { describe, expect, it } from "vitest";
import { formatProspectPlatformSummary } from "./prospectPlatformSummary";

describe("formatProspectPlatformSummary", () => {
  it.each([
    [12, 8, "X/Twitter + LinkedIn"],
    [12, 0, "X/Twitter"],
    [0, 8, "LinkedIn"],
    [0, 0, null],
  ])(
    "formats X/Twitter count %i and LinkedIn count %i as %s",
    (twitterProspectsCount, linkedInProspectsCount, expected) => {
      expect(
        formatProspectPlatformSummary({
          twitterProspectsCount,
          linkedInProspectsCount,
        })
      ).toBe(expected);
    }
  );
});
