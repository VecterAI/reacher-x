import assert from "node:assert/strict";
import test from "node:test";
import type { ActionCtx } from "../convex/_generated/server";
import {
  isLinkdApiNoDataError,
  LinkdApiRequestError,
  requestLinkdApiData,
} from "../convex/integrations/linkedin/linkdapiClient";

type RecordedMutation = Record<string, unknown>;

function createActionContext(recordedMutations: RecordedMutation[]): ActionCtx {
  return {
    runMutation: async (_reference: unknown, args: RecordedMutation) => {
      recordedMutations.push(args);
      return recordedMutations.length === 1
        ? { allowed: true, reason: undefined, retryAfterAt: undefined }
        : null;
    },
    runAction: async () => ({ waitMs: 0 }),
  } as unknown as ActionCtx;
}

test("LinkdAPI client pagination and circuit evidence", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.LINKDAPI_API_KEY;
  process.env.LINKDAPI_API_KEY = "test-key";

  try {
    await t.test("sends urn, cursor, and start zero together", async () => {
      const recordedMutations: RecordedMutation[] = [];
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/api/v1/posts/all");
        assert.equal(url.searchParams.get("urn"), "ACoAA-profile");
        assert.equal(url.searchParams.get("cursor"), "next-page");
        assert.equal(url.searchParams.get("start"), "0");
        return new Response(
          JSON.stringify({
            success: true,
            statusCode: 200,
            data: { posts: [{ urn: "post-1" }], cursor: "after-page" },
          }),
          { status: 200 }
        );
      };

      const result = await requestLinkdApiData<{
        posts: Array<{ urn: string }>;
        cursor: string;
      }>(createActionContext(recordedMutations), {
        path: "/api/v1/posts/all",
        query: { urn: "ACoAA-profile", cursor: "next-page", start: 0 },
        consumer: "test.profilePosts",
      });

      assert.deepEqual(result, {
        posts: [{ urn: "post-1" }],
        cursor: "after-page",
      });
      assert.equal(recordedMutations[1]?.outcome, "success");
      assert.equal(recordedMutations[1]?.healthEvidence, true);
    });

    await t.test(
      "treats an HTTP 200 profile-data failure as provider health evidence",
      async () => {
        const recordedMutations: RecordedMutation[] = [];
        globalThis.fetch = async () =>
          new Response(
            JSON.stringify({
              success: false,
              statusCode: 200,
              message:
                "the data cannot be displayed or it doesn't exist, make sure the URN is correct",
              data: null,
            }),
            { status: 200 }
          );

        await assert.rejects(
          requestLinkdApiData(createActionContext(recordedMutations), {
            path: "/api/v1/posts/all",
            query: { urn: "ACoAA-profile", start: 0 },
            consumer: "test.profilePosts",
          }),
          LinkdApiRequestError
        );

        assert.equal(recordedMutations[1]?.outcome, "error");
        assert.equal(recordedMutations[1]?.httpStatus, 200);
        assert.equal(recordedMutations[1]?.circuitReason, "unknown");
        assert.equal(recordedMutations[1]?.healthEvidence, true);
        assert.equal(
          isLinkdApiNoDataError(
            new LinkdApiRequestError({
              message:
                "the data cannot be displayed or it doesn't exist, make sure the URN is correct",
              status: 200,
            })
          ),
          true
        );
      }
    );

    await t.test("does not mistake real provider failures for no data", () => {
      assert.equal(
        isLinkdApiNoDataError(
          new LinkdApiRequestError({
            message: "Invalid API key",
            status: 401,
          })
        ),
        false
      );
      assert.equal(
        isLinkdApiNoDataError(
          new LinkdApiRequestError({
            message: "Temporarily unavailable",
            status: 503,
          })
        ),
        false
      );
    });

    await t.test(
      "still marks authentication and server failures as circuit failures",
      async () => {
        for (const failure of [
          {
            responseStatus: 200,
            statusCode: 401,
            message: "Invalid API key",
            reason: "authentication",
          },
          {
            responseStatus: 503,
            statusCode: 503,
            message: "Temporarily unavailable",
            reason: "transient",
          },
        ]) {
          const recordedMutations: RecordedMutation[] = [];
          globalThis.fetch = async () =>
            new Response(
              JSON.stringify({
                success: false,
                statusCode: failure.statusCode,
                message: failure.message,
              }),
              { status: failure.responseStatus }
            );

          await assert.rejects(
            requestLinkdApiData(createActionContext(recordedMutations), {
              path: "/api/v1/posts/all",
              query: { urn: "ACoAA-profile", start: 0 },
              consumer: "test.profilePosts",
            }),
            LinkdApiRequestError
          );

          assert.equal(recordedMutations[1]?.circuitReason, failure.reason);
          assert.equal(recordedMutations[1]?.healthEvidence, false);
        }
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.LINKDAPI_API_KEY;
    } else {
      process.env.LINKDAPI_API_KEY = originalApiKey;
    }
  }
});
