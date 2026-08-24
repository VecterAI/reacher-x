import assert from "node:assert/strict";
import test from "node:test";
import {
  inferAttachmentMediaKind,
  isVisionAttachmentMediaKind,
} from "../shared/lib/utils/media/inferAttachmentMediaKind";
import { getBestMp4VariantUrl } from "../shared/lib/twitter/mediaVariants";

test("inferAttachmentMediaKind detects MIME-based image, gif, and video attachments", () => {
  assert.equal(inferAttachmentMediaKind({ mimeType: "image/png" }), "image");
  assert.equal(inferAttachmentMediaKind({ mimeType: "image/gif" }), "gif");
  assert.equal(inferAttachmentMediaKind({ mimeType: "video/mp4" }), "video");
});

test("inferAttachmentMediaKind falls back to URL/file extension heuristics", () => {
  assert.equal(
    inferAttachmentMediaKind({
      mimeType: "application/octet-stream",
      url: "https://cdn.example.com/screenshots/prospect-flow.webp?sig=123",
    }),
    "image"
  );
  assert.equal(
    inferAttachmentMediaKind({
      url: "operator-upload/follow-up-demo.mov",
    }),
    "video"
  );
  assert.equal(
    inferAttachmentMediaKind({
      url: "vision-reference.gif",
    }),
    "gif"
  );
  assert.equal(
    inferAttachmentMediaKind({
      url: "notes.txt",
    }),
    null
  );
});

test("file visual inference keeps a concrete video filename authoritative over a blob URL", async () => {
  const { inferFileVisualKind } = await import(
    "../shared/lib/utils/media/inferFileVisualKind"
  );

  assert.equal(
    inferFileVisualKind({
      fileName: "Screen_Recording_2026-08-24.mov",
      mimeType: "application/octet-stream",
      url: "blob:http://localhost:3000/decrypted-xchat-media",
    }),
    "video"
  );
});

test("progressive video selection accepts XChat QuickTime blobs while preferring MP4", () => {
  assert.equal(
    getBestMp4VariantUrl([
      {
        content_type: "video/quicktime",
        url: "blob:http://localhost/decrypted-mov",
      },
    ]),
    "blob:http://localhost/decrypted-mov"
  );
  assert.equal(
    getBestMp4VariantUrl([
      {
        content_type: "video/quicktime",
        url: "blob:http://localhost/decrypted-mov",
        bitrate: 10_000_000,
      },
      {
        content_type: "video/mp4",
        url: "https://video.twimg.com/playable.mp4",
        bitrate: 1_000_000,
      },
    ]),
    "https://video.twimg.com/playable.mp4"
  );
});

test("isVisionAttachmentMediaKind only enables true visual media", () => {
  assert.equal(isVisionAttachmentMediaKind("image"), true);
  assert.equal(isVisionAttachmentMediaKind("gif"), true);
  assert.equal(isVisionAttachmentMediaKind("video"), false);
  assert.equal(isVisionAttachmentMediaKind(null), false);
});
