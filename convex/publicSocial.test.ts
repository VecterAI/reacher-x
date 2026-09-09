/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("testimonials after public thread removal", () => {
  test("replacement trims and deduplicates IDs, preserves ordering, and supports clearing", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("publicTestimonials", {
        tweetId: "old",
        position: 0,
        isActive: true,
      });
    });
    expect(
      await t.mutation(
        internal.publicSocial.replacePublicSocialConfigInternal,
        {
          testimonialTweetIds: [" 200 ", "", "100", "200", "   "],
        }
      )
    ).toEqual({ testimonials: 2 });
    expect(
      await t.query(
        internal.publicSocial.getPublicTestimonialsConfigInternal,
        {}
      )
    ).toEqual(["200", "100"]);
    expect(
      await t.query(internal.publicSocial.getPublicTestimonialsConfigInternal, {
        limit: 1,
      })
    ).toEqual(["200"]);
    await t.mutation(internal.publicSocial.replacePublicSocialConfigInternal, {
      testimonialTweetIds: [],
    });
    expect(
      await t.query(
        internal.publicSocial.getPublicTestimonialsConfigInternal,
        {}
      )
    ).toEqual([]);
  });

  test("inactive testimonials are excluded and invalid limits preserve existing behavior", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const row of [
        { tweetId: "hidden", position: 0, isActive: false },
        { tweetId: "later", position: 3, isActive: true },
        { tweetId: "first", position: 1, isActive: true },
      ])
        await ctx.db.insert("publicTestimonials", row);
    });
    for (const limit of [undefined, 0, -1]) {
      expect(
        await t.query(
          internal.publicSocial.getPublicTestimonialsConfigInternal,
          { limit }
        )
      ).toEqual(["first", "later"]);
    }
    expect(
      await t.query(internal.publicSocial.getPublicTestimonialsConfigInternal, {
        limit: 1.9,
      })
    ).toEqual(["first"]);
  });

  test("anonymous testimonial reads hydrate X text, author, quote and media in configured order", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.publicSocial.replacePublicSocialConfigInternal, {
      testimonialTweetIds: ["200", "100", "missing"],
    });
    vi.stubEnv("X_API_BEARER_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "100", text: "Second", author_id: "author" },
            {
              id: "200",
              text: "First",
              author_id: "author",
              attachments: { media_keys: ["photo"] },
              referenced_tweets: [{ type: "quoted", id: "quote" }],
            },
          ],
          includes: {
            users: [{ id: "author", name: "Test author", username: "tester" }],
            tweets: [{ id: "quote", text: "Quoted post", author_id: "author" }],
            media: [
              {
                media_key: "photo",
                type: "photo",
                url: "https://pbs.twimg.com/media/test.jpg",
                width: 800,
                height: 600,
              },
            ],
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await t.action(api.publicSocial.getPublicTestimonials, {});
    expect(result.tweets.map((tweet) => tweet.id_str)).toEqual(["200", "100"]);
    expect(result.tweets[0]).toMatchObject({
      full_text: "First",
      user: { screen_name: "tester" },
      quoted_status: { full_text: "Quoted post" },
      entities: {
        media: [
          {
            type: "photo",
            media_url_https: "https://pbs.twimg.com/media/test.jpg",
          },
        ],
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/2/tweets?");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/users/");
  });

  test("empty config makes no provider request; missing credentials and provider failures return empty testimonials", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("X_API_BEARER_TOKEN", "");
    expect(await t.action(api.publicSocial.getPublicTestimonials, {})).toEqual({
      tweets: [],
    });
    await t.mutation(internal.publicSocial.replacePublicSocialConfigInternal, {
      testimonialTweetIds: ["100"],
    });
    expect(await t.action(api.publicSocial.getPublicTestimonials, {})).toEqual({
      tweets: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("X_API_BEARER_TOKEN", "test-token");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })
    );
    expect(await t.action(api.publicSocial.getPublicTestimonials, {})).toEqual({
      tweets: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("agent thread cleanup still works without a publicThreads schema", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.publicSocial.replacePublicSocialConfigInternal, {
      testimonialTweetIds: ["keep"],
    });
    expect(
      await t.mutation(
        internal.lib.deleteWorkspaceCore.deleteThreadLocalRowsInternal,
        { threadId: "absent-agent-thread" }
      )
    ).toEqual({ deleted: 0 });
    expect(
      await t.query(
        internal.publicSocial.getPublicTestimonialsConfigInternal,
        {}
      )
    ).toEqual(["keep"]);
  });
});
