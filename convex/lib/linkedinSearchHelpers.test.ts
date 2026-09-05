import { describe, expect, test } from "vitest";
import {
  buildLinkedInPeopleSearchAttempts,
  extractLinkedInGeoId,
  normalizeLinkedInPostAuthorJobTitle,
} from "./linkedinSearchHelpers";

describe("LinkedIn provider filters", () => {
  test("extracts a LinkdAPI geo ID from documented lookup shapes", () => {
    expect(
      extractLinkedInGeoId({
        results: [{ id: "103644278", name: "United States" }],
      })
    ).toBe("103644278");
    expect(
      extractLinkedInGeoId([
        { urn: "urn:li:fs_geo:90009706", name: "San Francisco Bay Area" },
      ])
    ).toBe("90009706");
  });

  test("tries provider filters first and then retries without them", () => {
    expect(
      buildLinkedInPeopleSearchAttempts({
        searchModes: ["title", "keyword"],
        geoUrn: "103644278",
        profileLanguage: "en",
      })
    ).toEqual([
      {
        searchMode: "title",
        geoUrn: "103644278",
        profileLanguage: "en",
      },
      {
        searchMode: "keyword",
        geoUrn: "103644278",
        profileLanguage: "en",
      },
      { searchMode: "title" },
      { searchMode: "keyword" },
    ]);
  });

  test("does not create redundant fallback attempts without filters", () => {
    expect(
      buildLinkedInPeopleSearchAttempts({ searchModes: ["keyword"] })
    ).toEqual([{ searchMode: "keyword" }]);
  });

  test("only forwards a single documented LinkedIn post author title", () => {
    expect(
      normalizeLinkedInPostAuthorJobTitle("  Chief Financial Officer  ")
    ).toBe("Chief Financial Officer");
    expect(
      normalizeLinkedInPostAuthorJobTitle(
        "CFO OR Finance Director OR Head of Finance"
      )
    ).toBeUndefined();
    expect(
      normalizeLinkedInPostAuthorJobTitle("CFO AND SaaS leader")
    ).toBeUndefined();
    expect(
      normalizeLinkedInPostAuthorJobTitle("Research and Development Director")
    ).toBe("Research and Development Director");
    expect(
      normalizeLinkedInPostAuthorJobTitle("CFO or Finance Director")
    ).toBeUndefined();
    expect(
      normalizeLinkedInPostAuthorJobTitle("CFO Or Finance Director")
    ).toBeUndefined();
    expect(normalizeLinkedInPostAuthorJobTitle("   ")).toBeUndefined();
  });
});
