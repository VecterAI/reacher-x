import { describe, expect, test } from "vitest";
import {
  normalizeLinkedInProfileQueryUrn,
  requireLinkedInProfileQueryUrn,
  resolveLinkedInProspectProfileIdentifiers,
} from "./profileIdentity";

describe("LinkedIn profile query URNs", () => {
  test("keeps LinkdAPI profile URNs unchanged", () => {
    expect(normalizeLinkedInProfileQueryUrn(" ACoAA-profile ")).toBe(
      "ACoAA-profile"
    );
  });

  test("strips LinkedIn profile URN wrappers", () => {
    expect(
      normalizeLinkedInProfileQueryUrn("urn:li:fsd_profile:ACoAA-profile")
    ).toBe("ACoAA-profile");
    expect(
      normalizeLinkedInProfileQueryUrn("URN:LI:MEMBER:ACoAA-profile")
    ).toBe("ACoAA-profile");
  });

  test("rejects post URNs and empty profile wrappers", () => {
    expect(
      normalizeLinkedInProfileQueryUrn("urn:li:activity:123456")
    ).toBeUndefined();
    expect(
      normalizeLinkedInProfileQueryUrn("urn:li:fsd_profile:   ")
    ).toBeUndefined();
    expect(() => requireLinkedInProfileQueryUrn("urn:li:share:123")).toThrow(
      "LinkedIn profile URN required"
    );
  });

  test("normalizes wrapped prospect profile identifiers", () => {
    expect(
      resolveLinkedInProspectProfileIdentifiers({
        linkedinUserUrn: "urn:li:fsd_profile:ACoAA-prospect",
      })
    ).toEqual({
      username: undefined,
      profileUrn: "ACoAA-prospect",
    });
  });
});
