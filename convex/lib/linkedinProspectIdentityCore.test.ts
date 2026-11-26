import { describe, expect, test } from "vitest";
import {
  isLinkedInCompanyIdentity,
  normalizeLinkedInCompanyId,
  resolveLinkedInCompanyLookupArgs,
} from "./linkedinProspectIdentityCore";

describe("linkedinProspectIdentityCore", () => {
  test("normalizeLinkedInCompanyId handles fsd_company, organization, company, and raw numeric IDs", () => {
    expect(normalizeLinkedInCompanyId("urn:li:fsd_company:36941")).toBe(
      "36941"
    );
    expect(normalizeLinkedInCompanyId("urn:li:organization:119384088")).toBe(
      "119384088"
    );
    expect(normalizeLinkedInCompanyId("urn:li:company:1035")).toBe("1035");
    expect(normalizeLinkedInCompanyId("1035")).toBe("1035");
    expect(
      normalizeLinkedInCompanyId("urn:li:fsd_profile:ACoAAAEkwwAB9KEc2TrQgOLEQ")
    ).toBeUndefined();
    expect(
      normalizeLinkedInCompanyId("amadeus-capital-partners")
    ).toBeUndefined();
  });

  test("isLinkedInCompanyIdentity detects company URNs, company URLs, and organization prospect types", () => {
    expect(
      isLinkedInCompanyIdentity({
        providerId: "urn:li:fsd_company:36941",
        profileUrl:
          "https://www.linkedin.com/company/amadeus-capital-partners/",
      })
    ).toBe(true);
    expect(
      isLinkedInCompanyIdentity({
        profileUrl: "https://linkedin.com/company/hadleypointcapital/posts/",
      })
    ).toBe(true);
    expect(
      isLinkedInCompanyIdentity({
        prospectType: "organization",
      })
    ).toBe(true);
    expect(
      isLinkedInCompanyIdentity({
        authorType: "company",
      })
    ).toBe(true);
    expect(
      isLinkedInCompanyIdentity({
        providerId: "urn:li:fsd_profile:ACoAAAEkwwAB9KEc2TrQgOLEQ",
        profileUrl: "https://www.linkedin.com/in/satyanadella/",
        prospectType: "person",
      })
    ).toBe(false);
  });

  test("resolveLinkedInCompanyLookupArgs returns numeric id + slug when available, else name fallback", () => {
    expect(
      resolveLinkedInCompanyLookupArgs({
        providerId: "urn:li:fsd_company:36941",
        username: "amadeus-capital-partners",
        displayName: "Amadeus Capital Partners",
      })
    ).toEqual({
      id: "36941",
      name: "amadeus-capital-partners",
    });

    expect(
      resolveLinkedInCompanyLookupArgs({
        username: "hadleypointcapital",
        displayName: "Hadley Point Capital",
      })
    ).toEqual({
      name: "hadleypointcapital",
    });

    expect(
      resolveLinkedInCompanyLookupArgs({
        displayName: "Hadley Point Capital",
      })
    ).toEqual({
      name: "Hadley Point Capital",
    });
  });
});
