import { afterEach, describe, expect, test, vi } from "vitest";
import type { ActionCtx } from "../../_generated/server";
import { ProviderCircuitOpenError } from "../../lib/providerReliability";
import {
  isTregLinkedInProvider,
  resolveLinkedInDataProvider,
} from "./providerConfig";
import {
  parseTregCostUsd,
  requestTregWithFallback,
  shouldFailoverTregError,
  TregRequestError,
} from "./tregClient";
import {
  filterLinkedInPostsByDatePosted,
  filterLinkedInPostsByKeyword,
  mapDatePostedToAnyApi,
  mapDatePostedToHarvestLimit,
  mapDatePostedToScrapeCreators,
  mapSortByToHarvest,
  normalizeTregCompany,
  normalizeTregContactEnrichment,
  normalizeTregGeoLookup,
  normalizeTregPeopleSearchPage,
  normalizeTregPostCommentsPage,
  normalizeTregProfilePostsPage,
  normalizeTregSearchPostsPage,
  normalizeTregUserProfile,
} from "./tregNormalizers";

describe("providerConfig", () => {
  test("respects explicit LINKEDIN_DATA_PROVIDER override", () => {
    expect(
      resolveLinkedInDataProvider({
        LINKEDIN_DATA_PROVIDER: "linkdapi",
        TREG_API_KEY: "token",
      })
    ).toBe("linkdapi");
    expect(
      resolveLinkedInDataProvider({
        LINKEDIN_DATA_PROVIDER: "TREG",
      })
    ).toBe("treg");
  });

  test("defaults to treg when TREG_API_KEY is set and linkdapi otherwise", () => {
    expect(resolveLinkedInDataProvider({ TREG_API_KEY: "token" })).toBe("treg");
    expect(isTregLinkedInProvider({ TREG_API_KEY: "token" })).toBe(true);
    expect(resolveLinkedInDataProvider({})).toBe("linkdapi");
    expect(isTregLinkedInProvider({})).toBe(false);
  });
});

describe("tregClient helpers", () => {
  test("parseTregCostUsd reads micro-USD header or _treg.charged_micro", () => {
    expect(parseTregCostUsd("2000", null)).toBeCloseTo(0.002);
    expect(parseTregCostUsd("0", null)).toBe(0);
    expect(
      parseTregCostUsd(null, { _treg: { charged_micro: 1500 } })
    ).toBeCloseTo(0.0015);
    expect(parseTregCostUsd("not-a-number", {})).toBe(0);
  });

  test("shouldFailoverTregError fails over on 429/5xx/timeouts and stops on 4xx/circuit-open", () => {
    expect(
      shouldFailoverTregError(
        new TregRequestError({
          message: "share_busy",
          toolId: "harvestapi.linkedin.post.search",
          status: 429,
          retryable: true,
          errorCode: "share_busy",
        })
      )
    ).toBe(true);

    expect(
      shouldFailoverTregError(
        new TregRequestError({
          message: "upstream 503",
          toolId: "fetchinio.linkedin.user.profile",
          status: 503,
          retryable: true,
        })
      )
    ).toBe(true);

    for (const status of [400, 401, 402, 403, 404, 422]) {
      expect(
        shouldFailoverTregError(
          new TregRequestError({
            message: `HTTP ${status}`,
            toolId: "treg.people.search",
            status,
            retryable: false,
          })
        )
      ).toBe(false);
    }

    expect(
      shouldFailoverTregError(
        new ProviderCircuitOpenError({
          provider: "linkdapi",
          reason: "rate_limit",
        })
      )
    ).toBe(false);

    expect(shouldFailoverTregError(new Error("fetch failed"))).toBe(true);
  });
});

describe("tregNormalizers", () => {
  test("maps LinkdAPI query filters to HarvestAPI and AnyAPI enums", () => {
    expect(mapDatePostedToHarvestLimit("past-24h")).toBe("24h");
    expect(mapDatePostedToHarvestLimit("past-week")).toBe("week");
    expect(mapDatePostedToHarvestLimit("past-month")).toBe("month");
    expect(mapDatePostedToHarvestLimit("past-year")).toBe("year");
    expect(mapDatePostedToHarvestLimit(undefined)).toBeUndefined();

    expect(mapDatePostedToAnyApi("past-week")).toBe("last-week");
    expect(mapSortByToHarvest("date_posted")).toBe("date");
    expect(mapSortByToHarvest("relevance")).toBe("relevance");
  });

  test("normalizes geo lookup from harvestapi.linkedin.geo.search", () => {
    expect(
      normalizeTregGeoLookup({
        elements: [{ geoId: "90000084", title: "San Francisco Bay Area" }],
      })
    ).toBe("90000084");
    expect(normalizeTregGeoLookup({ elements: [] })).toBeUndefined();
  });

  test("normalizes treg.people.search and harvestapi.linkedin.profile.search", () => {
    const routedPage = normalizeTregPeopleSearchPage(
      {
        output: {
          people: [
            {
              name: "Sara Du",
              title: "Founder",
              company: "Ando",
              location: "San Francisco Bay Area",
              profile_url: "https://linkedin.com/in/saradu",
            },
          ],
          next_cursor: "cursor-2",
          count: 25,
        },
      },
      { start: 0, count: 25 }
    );

    expect(routedPage.people).toHaveLength(1);
    expect(routedPage.people[0]).toMatchObject({
      firstName: "Sara",
      lastName: "Du",
      fullName: "Sara Du",
      headline: "Founder at Ando",
      location: "San Francisco Bay Area",
      profileID: "saradu",
      url: "https://linkedin.com/in/saradu",
    });
    expect(routedPage.hasMore).toBe(true);
    expect(routedPage.nextCursor).toBe("cursor-2");

    const harvestPage = normalizeTregPeopleSearchPage(
      {
        elements: [
          {
            id: "ACoAAD5_D4QBS2zhx2cay-MWm61d7y8pmRN__pA",
            name: "Cher Assia Zhang",
            position: "Founder",
            location: { linkedinText: "San Francisco Bay Area" },
            linkedinUrl:
              "https://www.linkedin.com/in/cher-assia-zhang-23018b253",
            publicIdentifier: "cher-assia-zhang-23018b253",
          },
        ],
        pagination: {
          totalElements: 10,
          totalPages: 2,
          pageNumber: 1,
          totalResultCount: 175755,
        },
      },
      { start: 0, count: 10 }
    );

    expect(harvestPage.people[0]).toMatchObject({
      urn: "urn:li:fsd_profile:ACoAAD5_D4QBS2zhx2cay-MWm61d7y8pmRN__pA",
      profileID: "ACoAAD5_D4QBS2zhx2cay-MWm61d7y8pmRN__pA",
      headline: "Founder",
      location: "San Francisco Bay Area",
    });
    expect(harvestPage.total).toBe(175755);
    expect(harvestPage.hasMore).toBe(true);
  });

  test("normalizes harvestapi.linkedin.post.search", () => {
    const page = normalizeTregSearchPostsPage(
      {
        elements: [
          {
            id: "7531688431618367488",
            linkedinUrl:
              "https://www.linkedin.com/posts/alex_crm-activity-7531688431618367488-sJ32",
            content: "Looking for a simpler CRM for our team.",
            author: {
              id: "ACoAA123",
              urn: "urn:li:fsd_profile:ACoAA123",
              name: "Alex Rivera",
              info: "Founder at Acme",
              linkedinUrl: "https://www.linkedin.com/in/alexrivera",
              avatar: { url: "https://cdn.example.com/alex.jpg" },
            },
            postedAt: {
              timestamp: 1795694454102,
              date: "2026-11-26T12:00:54.102Z",
            },
            engagement: {
              likes: 12,
              comments: 4,
              shares: 2,
            },
            postImages: [{ url: "https://cdn.example.com/post.png" }],
          },
        ],
        pagination: {
          totalElements: 397,
          totalPages: 8,
          pageNumber: 1,
          paginationToken: "tok-2",
        },
      },
      { start: 0 }
    );

    expect(page.posts).toHaveLength(1);
    expect(page.posts[0]).toMatchObject({
      urn: "urn:li:activity:7531688431618367488",
      postID: "7531688431618367488",
      text: "Looking for a simpler CRM for our team.",
      author: {
        name: "Alex Rivera",
        headline: "Founder at Acme",
        urn: "urn:li:fsd_profile:ACoAA123",
        id: "ACoAA123",
        profilePictureURL: "https://cdn.example.com/alex.jpg",
      },
      engagements: {
        totalReactions: 12,
        commentsCount: 4,
        repostsCount: 2,
      },
      mediaContent: [
        { type: "image", url: "https://cdn.example.com/post.png" },
      ],
    });
    expect(page.hasMore).toBe(true);
    expect(page.nextPaginationToken).toBe("tok-2");
  });

  test("normalizes fetchinio.linkedin.user.profile with supplemental overview and websites", () => {
    const { profile, supplemental } = normalizeTregUserProfile({
      id: "urn:li:fsd_profile:ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
      memberId: "19186432",
      profileId: "ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
      publicIdentifier: "satyanadella",
      url: "https://www.linkedin.com/in/satyanadella/",
      firstName: "Satya",
      lastName: "Nadella",
      title: "Chairman and CEO at Microsoft",
      description: "Building AI infrastructure.",
      geoLocationName: "Redmond, Washington, United States",
      geoCountryName: "United States",
      countryCode: "US",
      creator: true,
      premium: true,
      followerCount: 12349598,
      connectionsCount: 833,
      profilePictureUrl: "https://cdn.example.com/satya.jpg",
      coverImageUrl: "https://cdn.example.com/cover.jpg",
      experiences: [
        {
          name: "Microsoft",
          jobTitle: "Chairman and CEO",
          dateRange: "Feb 2014 - Present",
          locationName: "Greater Seattle Area",
        },
      ],
      websites: [{ url: "https://snscratchpad.com/", category: "COMPANY" }],
      skills: ["Cloud Computing"],
    });

    expect(profile).toMatchObject({
      id: 19186432,
      urn: "urn:li:fsd_profile:ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ",
      username: "satyanadella",
      firstName: "Satya",
      lastName: "Nadella",
      headline: "Chairman and CEO at Microsoft",
      summary: "Building AI infrastructure.",
      isCreator: true,
      isPremium: true,
      geo: {
        city: "Redmond",
        country: "United States",
        countryCode: "US",
        full: "Redmond, Washington, United States",
      },
    });
    expect(profile.position[0]).toMatchObject({
      companyName: "Microsoft",
      title: "Chairman and CEO",
      start: { year: 2014, month: 2, day: 0 },
      end: { year: 0, month: 0, day: 0 },
    });
    expect(supplemental).toEqual({
      followerCount: 12349598,
      connectionsCount: 833,
      backgroundImageUrl: "https://cdn.example.com/cover.jpg",
      contactInfo: {
        emailAddress: null,
        phoneNumber: null,
        websites: [{ url: "https://snscratchpad.com/", category: "COMPANY" }],
      },
    });
  });

  test("normalizes fetchinio.linkedin.user.posts and post comments", () => {
    const postsPage = normalizeTregProfilePostsPage(
      {
        posts: [
          {
            id: "urn:li:activity:7530839822152708096",
            content: "Outcome per dollar is the frontier.",
            date: "2026-11-24T03:48:49.839Z",
            reactionCount: 400,
            commentCount: 50,
            sharesCount: 25,
            shareUrl:
              "https://www.linkedin.com/feed/update/urn:li:activity:7530839822152708096/",
          },
        ],
        paginationToken: "next-posts-tok",
      },
      { maxPosts: 10 }
    );

    expect(postsPage.posts).toHaveLength(1);
    expect(postsPage.posts[0]).toMatchObject({
      urn: "urn:li:activity:7530839822152708096",
      text: "Outcome per dollar is the frontier.",
      engagements: {
        totalReactions: 400,
        commentsCount: 50,
        repostsCount: 25,
      },
    });
    expect(postsPage.nextCursor).toBe("next-posts-tok");

    const commentsPage = normalizeTregPostCommentsPage({
      comments: [
        {
          urn: "urn:li:comment:(activity:7530839822152708096,7530844556771385345)",
          text: "Congrats on the launch!",
          date: "2026-11-24T04:00:00.000Z",
          reactionCount: 7,
          replyCount: 2,
          author: {
            id: "ACoAA999",
            name: "Jordan Lee",
            headline: "VP Engineering",
            url: "https://www.linkedin.com/in/jordanlee",
            profilePictureUrl: "https://cdn.example.com/jordan.jpg",
          },
        },
      ],
      paginationToken: "next-comments-tok",
    });

    expect(commentsPage.cursor).toBe("next-comments-tok");
    expect(commentsPage.comments[0]).toMatchObject({
      id: "urn:li:comment:(activity:7530839822152708096,7530844556771385345)",
      text: "Congrats on the launch!",
      engagements: { totalReactions: 7, commentsCount: 2 },
      author: {
        id: "ACoAA999",
        name: "Jordan Lee",
        headline: "VP Engineering",
        profilePictureURL: "https://cdn.example.com/jordan.jpg",
      },
    });
  });

  test("normalizes fetchinio.linkedin.company.profile and contact enrichment", () => {
    const company = normalizeTregCompany({
      id: "urn:li:fsd_company:1035",
      companyId: "1035",
      name: "Microsoft",
      publicIdentifier: "microsoft",
      url: "https://www.linkedin.com/company/microsoft/",
      websiteUrl: "https://news.microsoft.com/",
      industry: "Software Development",
      employeeCount: 230402,
      employeeCountRange: { start: 10001 },
      headquarter: {
        line1: "1 Microsoft Way",
        city: "Redmond",
        geographicArea: "Washington",
        country: "US",
        headquarter: true,
      },
      followerCount: 29598380,
      logoUrl: "https://cdn.example.com/msft.png",
    });

    expect(company).toMatchObject({
      id: "1035",
      name: "Microsoft",
      universalName: "microsoft",
      staffCount: 230402,
      staffCountRange: "10001+",
      industriesV2: ["Software Development"],
      followerCount: 29598380,
      images: { logo: "https://cdn.example.com/msft.png", cover: "" },
    });

    expect(
      normalizeTregContactEnrichment({
        output: {
          work_email: "alex@acme.com",
          phone: "+1-555-0100",
          websites: [{ url: "https://acme.com", category: "COMPANY" }],
        },
      })
    ).toEqual({
      emailAddress: "alex@acme.com",
      phoneNumber: "+1-555-0100",
      websites: [{ url: "https://acme.com", category: "COMPANY" }],
    });
  });

  test("filters user posts locally by keyword", () => {
    const posts = normalizeTregSearchPostsPage(
      {
        elements: [
          {
            id: "1000000000001",
            content: "Switching our CRM away from HubSpot this quarter.",
            author: { name: "Alex", info: "Founder" },
          },
          {
            id: "1000000000002",
            content: "Happy Friday everyone!",
            author: { name: "Alex", info: "Founder" },
          },
        ],
      },
      { start: 0 }
    ).posts;

    const hits = filterLinkedInPostsByKeyword(posts, '"HubSpot" CRM');
    expect(hits).toHaveLength(1);
    expect(hits[0].postID).toBe("1000000000001");
  });

  test("normalizes ScrapeCreators URL-only posts and rejects out-of-range timestamps", () => {
    const page = normalizeTregSearchPostsPage(
      {
        posts: [
          {
            url: "https://www.linkedin.com/posts/alex_ai-activity-7531688431618367488-abc1",
            description: "Looking for an AI SDR replacement.",
            datePublished: "2026-11-25T10:00:00.000Z",
          },
          {
            id: "1000000000099",
            content: "Huge timestamp should not crash Date.toISOString",
            postedAt: 9_000_000_000_000_000,
          },
        ],
      },
      { start: 0 }
    );

    expect(page.posts).toHaveLength(2);
    expect(page.posts[0]).toMatchObject({
      urn: "urn:li:activity:7531688431618367488",
      postID: "7531688431618367488",
      text: "Looking for an AI SDR replacement.",
      postedAt: {
        fullDate: "2026-11-25T10:00:00.000Z",
      },
    });
    expect(Number.isFinite(Date.parse(page.posts[1].postedAt.fullDate))).toBe(
      true
    );
    expect(mapDatePostedToScrapeCreators("past-week")).toBe("last-week");
    expect(mapDatePostedToScrapeCreators("past-24h")).toBe("last-day");
  });

  test("filters user posts locally by datePosted window", () => {
    const nowMs = Date.parse("2026-11-26T12:00:00.000Z");
    const posts = normalizeTregSearchPostsPage(
      {
        elements: [
          {
            id: "1000000000001",
            content: "Recent post",
            postedAt: Date.parse("2026-11-24T12:00:00.000Z"),
          },
          {
            id: "1000000000002",
            content: "Old post",
            postedAt: Date.parse("2026-09-01T12:00:00.000Z"),
          },
        ],
      },
      { start: 0 }
    ).posts;

    expect(
      filterLinkedInPostsByDatePosted(posts, "past-week", nowMs)
    ).toHaveLength(1);
    expect(
      filterLinkedInPostsByDatePosted(posts, undefined, nowMs)
    ).toHaveLength(2);
  });
});

describe("requestTregWithFallback behavior", () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TREG_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) {
      delete process.env.TREG_API_KEY;
    } else {
      process.env.TREG_API_KEY = originalToken;
    }
    vi.restoreAllMocks();
  });

  function makeMockCtx(options: { failTelemetry?: boolean } = {}): ActionCtx {
    let mutationCall = 0;
    const runQuery = vi.fn().mockResolvedValue({ status: "closed" });
    const runMutation = vi.fn().mockImplementation(async () => {
      mutationCall += 1;
      // First mutation call is assertProviderRequestAllowed; later calls are telemetry writes.
      if (mutationCall === 1) {
        return { allowed: true };
      }
      if (options.failTelemetry) {
        throw new Error("OCC write conflict");
      }
      return null;
    });
    return {
      runQuery,
      runMutation,
    } as unknown as ActionCtx;
  }

  test("does not fail over on 401 even if reading the response body fails", async () => {
    process.env.TREG_API_KEY = "test-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: vi.fn().mockRejectedValue(new Error("body stream timeout")),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      requestTregWithFallback(makeMockCtx(), {
        consumer: "test.401-body-fail",
        attempts: [
          { toolId: "provider.a", parse: (raw) => raw },
          { toolId: "provider.b", parse: (raw) => raw },
        ],
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not retry a paid 200 response if telemetry persistence fails", async () => {
    process.env.TREG_API_KEY = "test-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "x-treg-cost-micro": "1500" }),
      text: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await requestTregWithFallback(
      makeMockCtx({ failTelemetry: true }),
      {
        consumer: "test.telemetry-fail",
        attempts: [
          { toolId: "provider.a", parse: (raw) => raw },
          { toolId: "provider.b", parse: (raw) => raw },
        ],
      }
    );

    expect(result.data).toEqual({ ok: true });
    expect(result.costUsd).toBeCloseTo(0.0015);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("throws permanent 402 instead of returning an earlier empty result", async () => {
    process.env.TREG_API_KEY = "test-token";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "x-treg-cost-micro": "0" }),
        text: vi.fn().mockResolvedValue(JSON.stringify({ items: [] })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 402,
        headers: new Headers(),
        text: vi
          .fn()
          .mockResolvedValue(
            JSON.stringify({ message: "Insufficient balance" })
          ),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      requestTregWithFallback(makeMockCtx(), {
        consumer: "test.empty-then-402",
        attempts: [
          {
            toolId: "provider.a",
            parse: () => [] as string[],
            isEmpty: (rows) => rows.length === 0,
          },
          { toolId: "provider.b", parse: () => ["x"] },
        ],
      })
    ).rejects.toMatchObject({ status: 402 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
