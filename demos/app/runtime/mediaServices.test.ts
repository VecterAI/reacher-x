import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { POST, GET } from "../app/api/upload/route";
import { createAppServices } from "./appServices";
import {
  isRenderableLinkedInImageUrl,
  normalizeLinkedInMediaType,
} from "./demoMediaHelpers";
import { isRenderableLinkedInImageUrl as productionImageUrl } from "../../../shared/lib/linkedin/media";

test("manual images, video and documents survive upload, finalization and workspace search", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (url: string) =>
    GET(new Request(new URL(url, "http://demo.test")))
  );
  const { client, state } = createAppServices("outreach-with-images-and-video");
  const workspaceId = state.selectedWorkspaceId;
  assert.equal(
    await client.mutation(api.mediaUploadMutations.generateUploadUrl, {
      workspaceId,
    }),
    "/api/upload"
  );
  for (const [fileName, mimeType] of [
    ["client-feedback.png", "image/png"],
    ["client-feedback.mp4", "video/mp4"],
    ["notes.txt", "text/plain"],
  ]) {
    const bytes =
      fileName === "notes.txt"
        ? new TextEncoder().encode("Sample attachment")
        : await readFile(
            new URL(`../public/media/${fileName}`, import.meta.url)
          );
    const upload = await POST(
      new NextRequest("http://demo.test/api/upload", {
        method: "POST",
        body: new Uint8Array(bytes),
        headers: { "content-type": mimeType },
      })
    );
    assert.equal(upload.status, 200);
    const { storageId } = await upload.json();
    const result = await client.action(api.mediaUpload.processUploadedMedia, {
      storageId,
      workspaceId,
      fileName,
      mimeType: "text/html",
      size: 1,
    });
    assert.equal(
      result.mimeType,
      mimeType,
      "stored metadata must override caller claims"
    );
    assert.equal(result.size, bytes.length);
    assert.ok(result.mediaUrl);
    const downloaded = await GET(
      new Request(new URL(result.mediaUrl, "http://demo.test"))
    );
    assert.deepEqual(
      new Uint8Array(await downloaded.arrayBuffer()),
      new Uint8Array(bytes)
    );
    assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
    if (mimeType === "image/png") {
      assert.equal(isRenderableLinkedInImageUrl(result.mediaUrl), true);
      assert.equal(
        normalizeLinkedInMediaType("image", result.mediaUrl),
        "image"
      );
      assert.equal(productionImageUrl(result.mediaUrl), false);
      assert.equal(
        isRenderableLinkedInImageUrl(`https://other.test${result.mediaUrl}`),
        false
      );
    }
    const matches = client
      .watchQuery(api.mediaMentions.searchMentionEntities, {
        workspaceId,
        query: fileName,
        allowedKinds: ["attachment"],
      })
      .localQueryResult();
    assert.ok(matches?.some((item) => item.attachmentUrl === result.mediaUrl));
    await assert.rejects(
      client.action(api.mediaUpload.processUploadedMedia, {
        storageId,
        workspaceId: "another_workspace" as Id<"workspaces">,
        fileName,
        mimeType,
        size: bytes.length,
      }),
      /another workspace/
    );
    const otherWorkspace = client
      .watchQuery(api.mediaMentions.searchMentionEntities, {
        workspaceId: "another_workspace" as Id<"workspaces">,
        query: fileName,
        allowedKinds: ["attachment"],
      })
      .localQueryResult();
    assert.equal(
      otherWorkspace?.some((item) => item.attachmentUrl === result.mediaUrl),
      false
    );
  }
  t.mock.timers.tick(10 * 60 * 1000);
  await assert.rejects(
    client.action(api.mediaUpload.processUploadedMedia, {
      storageId: "missing" as Id<"_storage">,
      workspaceId,
      fileName: "missing.png",
      mimeType: "image/png",
      size: 1,
    }),
    /expired/
  );
});

test("demo upload rejects active content types", async () => {
  for (const mimeType of [
    "text/html",
    "image/svg+xml",
    "application/javascript",
  ]) {
    const response = await POST(
      new NextRequest("http://demo.test/api/upload", {
        method: "POST",
        body: "sample",
        headers: { "content-type": mimeType },
      })
    );
    assert.equal(response.status, 400);
  }
});
