import { describe, expect, test } from "vitest";
import {
  buildLegacyWorkspaceTargetingSpec,
  getAllowedDiscoveryStages,
  getStricterDiscoveryStage,
  normalizeWorkspaceTargetingSpec,
  shouldUseLinkedInPeopleDiscovery,
  type WorkspaceTargetingSpec,
} from "./targetingSpecCore";

function exampleSpec(): WorkspaceTargetingSpec {
  return {
    version: 1,
    summary: "Find organizers seeking sponsors for technology events.",
    criteria: [
      {
        id: "Event organizer",
        label: "Organizes technology events",
        description: "The person organizes a relevant event.",
        kind: "preferred",
        category: "profile_fit",
        evidence: "either",
        weight: 3,
        terms: ["conference organizer", "event host"],
      },
      {
        id: "Event organizer",
        label: "Currently seeking sponsors",
        description: "Recent activity asks for sponsors or partners.",
        kind: "required",
        category: "intent",
        evidence: "activity",
        weight: 5,
        terms: ["seeking sponsors"],
      },
    ],
    searchHints: {
      entities: ["Technology events"],
      activityPhrases: ["seeking sponsors"],
      roleTitles: ["Event organizer"],
      locations: ["United States"],
      industries: ["Events Services"],
      companyNames: [],
      languageCodes: ["en"],
      exclusionTerms: [],
    },
    searchFilters: {
      twitter: { language: "en", location: "United States" },
      linkedinPeople: {
        location: "United States",
        profileLanguage: "en",
      },
      linkedinPosts: { authorJobTitle: "Event organizer" },
    },
  };
}

describe("workspace targeting specification", () => {
  test.each([
    ["US", "business owners"],
    ["NY", "company founders"],
    ["東京", "東京都 founders"],
  ])("does not infer mandatory %s from a substring", (hint, description) => {
    const spec = exampleSpec();
    spec.searchFilters = undefined;
    spec.searchHints.locations = [hint];
    spec.criteria = [
      { ...spec.criteria[0], kind: "required", description, terms: [] },
    ];
    const result = normalizeWorkspaceTargetingSpec(spec);
    expect(result.searchFilters?.twitter?.location).toBeUndefined();
    expect(result.searchFilters?.linkedinPeople?.location).toBeUndefined();
  });

  test.each(["US", "New York", "東京", "A+B"])(
    "preserves an explicit complete %s hint",
    (hint) => {
      const spec = exampleSpec();
      spec.searchFilters = undefined;
      spec.searchHints.locations = [hint];
      spec.criteria = [
        {
          ...spec.criteria[0],
          kind: "required",
          description: `${hint}-based founders`,
          terms: [hint],
        },
      ];
      expect(
        normalizeWorkspaceTargetingSpec(spec).searchFilters?.linkedinPeople
          ?.location
      ).toBe(hint);
    }
  );
  test("normalizes only model-provided values without inventing use-case rules", () => {
    const spec = exampleSpec();
    spec.criteria = Array.from({ length: 15 }, (_, index) => ({
      ...spec.criteria[index % spec.criteria.length],
    }));
    spec.searchHints.locations = [" United States ", "united states"];

    const normalized = normalizeWorkspaceTargetingSpec(spec);

    expect(normalized.criteria).toHaveLength(12);
    expect(new Set(normalized.criteria.map((item) => item.id)).size).toBe(12);
    expect(normalized.searchHints.locations).toEqual(["United States"]);
    expect(normalized.searchHints.activityPhrases).toEqual([
      "seeking sponsors",
    ]);
    expect(normalized.searchHints.exclusionTerms).toEqual([]);
    expect(normalized.searchFilters?.linkedinPeople).toEqual({
      location: "United States",
      profileLanguage: "en",
    });
  });

  test("drops an undocumented Boolean expression from a single-value provider filter", () => {
    const spec = exampleSpec();
    spec.searchFilters = {
      ...spec.searchFilters!,
      linkedinPosts: {
        authorJobTitle: "CFO OR Finance Director OR Head of Finance",
      },
    };

    expect(
      normalizeWorkspaceTargetingSpec(spec).searchFilters?.linkedinPosts
    ).toEqual({ authorJobTitle: undefined, datePosted: undefined });

    spec.searchFilters.linkedinPosts.authorJobTitle = "CFO AND SaaS leader";
    expect(
      normalizeWorkspaceTargetingSpec(spec).searchFilters?.linkedinPosts
        .authorJobTitle
    ).toBeUndefined();
  });

  test("applies supported filters only for one required extracted value", () => {
    const spec = exampleSpec();
    spec.criteria.push({
      id: "required_location",
      label: "Located in the United States",
      description: "The person must be located in the United States.",
      kind: "required",
      category: "profile_fit",
      evidence: "profile",
      weight: 5,
      terms: ["United States"],
    });
    spec.searchFilters = {
      twitter: {},
      linkedinPeople: {},
      linkedinPosts: {},
    };

    const normalized = normalizeWorkspaceTargetingSpec(spec);

    expect(normalized.searchFilters).toEqual({
      twitter: { language: undefined, location: "United States" },
      linkedinPeople: {
        location: "United States",
        profileLanguage: undefined,
      },
      linkedinPosts: {
        authorJobTitle: undefined,
        datePosted: undefined,
      },
    });

    spec.criteria = spec.criteria.map((criterion) => ({
      ...criterion,
      kind: "preferred" as const,
    }));
    expect(
      normalizeWorkspaceTargetingSpec(spec).searchFilters?.linkedinPeople
        .location
    ).toBeUndefined();
  });

  test("does not guess a single-value provider filter from multiple hints", () => {
    const spec = exampleSpec();
    spec.searchHints.locations = ["United States", "Canada"];
    spec.searchHints.roleTitles = ["Event organizer", "Conference producer"];
    spec.searchFilters = {
      twitter: {},
      linkedinPeople: {},
      linkedinPosts: {},
    };

    const normalized = normalizeWorkspaceTargetingSpec(spec);

    expect(normalized.searchFilters?.twitter.location).toBeUndefined();
    expect(normalized.searchFilters?.linkedinPeople.location).toBeUndefined();
    expect(
      normalized.searchFilters?.linkedinPosts.authorJobTitle
    ).toBeUndefined();
  });

  test("broadens discovery only after earlier bootstrap cycles", () => {
    expect(getAllowedDiscoveryStages({ bootstrapCycleCount: 0 })).toEqual([
      "strict",
    ]);
    expect(getAllowedDiscoveryStages({ bootstrapCycleCount: 1 })).toEqual([
      "strict",
      "balanced",
    ]);
    expect(getAllowedDiscoveryStages({ bootstrapCycleCount: 2 })).toEqual([
      "strict",
      "balanced",
      "broad",
    ]);
    expect(getAllowedDiscoveryStages({ bootstrapCompletedAt: 1 })).toEqual([
      "strict",
      "balanced",
      "broad",
    ]);
  });

  test("keeps the strictest stage when a query serves multiple providers", () => {
    expect(getStricterDiscoveryStage("broad", "strict")).toBe("strict");
    expect(getStricterDiscoveryStage("balanced", "broad")).toBe("balanced");
  });

  test("uses people discovery only when profile data can satisfy all requirements", () => {
    expect(shouldUseLinkedInPeopleDiscovery(exampleSpec())).toBe(false);

    const profileOnlySpec = exampleSpec();
    profileOnlySpec.criteria = profileOnlySpec.criteria.map((criterion) => ({
      ...criterion,
      evidence: "profile" as const,
    }));
    expect(shouldUseLinkedInPeopleDiscovery(profileOnlySpec)).toBe(true);
    expect(shouldUseLinkedInPeopleDiscovery(undefined)).toBe(true);
  });

  test("builds a compatibility spec entirely from an existing workspace", () => {
    const legacy = buildLegacyWorkspaceTargetingSpec({
      description: "Find restaurant owners preparing a second location.",
      profiles: [
        {
          title: "Expanding restaurant owners",
          painPoints: ["Opening another location"],
          qualificationKeywords: ["second location"],
        },
      ],
    });

    expect(legacy.summary).toBe(
      "Find restaurant owners preparing a second location."
    );
    expect(legacy.searchHints.activityPhrases).toEqual(
      expect.arrayContaining(["Opening another location", "second location"])
    );
    expect(legacy.searchHints.locations).toEqual([]);
    expect(legacy.searchHints.exclusionTerms).toEqual([]);
    expect(legacy.searchFilters).toEqual({
      twitter: {},
      linkedinPeople: {},
      linkedinPosts: {},
    });
  });
});
