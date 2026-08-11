import assert from "node:assert/strict";
import test from "node:test";
import type { Id } from "../convex/_generated/dataModel";
import {
  assertOutreachMediaCapability,
  getMediaCapabilityErrorMessage,
  withAttachmentNames,
  type ResolvedOutreachMedia,
} from "../convex/lib/mediaCapabilityCore";

function media(
  overrides: Partial<ResolvedOutreachMedia> = {}
): ResolvedOutreachMedia {
  return {
    uploadId: "test-upload" as Id<"mediaUploads">,
    url: "https://example.com/demo.mp4",
    fileName: "demo.mp4",
    mimeType: "video/mp4",
    size: 10 * 1024 * 1024,
    kind: "video",
    ...overrides,
  };
}

test("LinkedIn comments accept photos and GIFs but reject video", () => {
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "linkedin",
        surface: "comment",
        media: [media()],
      }),
    /LinkedIn comments do not support video attachments/
  );

  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "comment",
      media: [
        media({
          fileName: "demo.gif",
          mimeType: "image/gif",
          size: 1024,
          kind: "gif",
        }),
      ],
    })
  );

  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "dm",
      media: [media()],
    })
  );
});

test("LinkedIn messages enforce the provider's 15 MB per-file limit", () => {
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "linkedin",
        surface: "dm",
        media: [media({ size: 16 * 1024 * 1024 })],
      }),
    /allows up to 15 MB/
  );
  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "dm",
      media: [media({ size: 15 * 1024 * 1024 })],
    })
  );
});

test("LinkedIn messages use LinkedIn file types rather than X file types", () => {
  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "dm",
      media: [
        media({
          fileName: "proof.bmp",
          mimeType: "image/bmp",
          size: 1024,
          kind: "image",
        }),
      ],
    })
  );
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "linkedin",
        surface: "dm",
        media: [
          media({
            fileName: "proof.webp",
            mimeType: "image/webp",
            size: 1024,
            kind: "image",
          }),
        ],
      }),
    /file type \(image\/webp\) is not supported/
  );
});

test("PDFs are allowed in LinkedIn DMs and rejected for X/Twitter", () => {
  const pdf = media({
    fileName: "results.pdf",
    mimeType: "application/pdf",
    size: 1024,
    kind: "file",
  });
  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "dm",
      media: [pdf],
    })
  );
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "twitter",
        surface: "dm",
        media: [pdf],
      }),
    /cannot be attached to X\/Twitter/
  );
});

test("LinkedIn DMs accept supported office documents while X/Twitter rejects them", () => {
  const document = media({
    fileName: "case-study.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 1024,
    kind: "file",
  });
  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "dm",
      media: [document],
    })
  );
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "twitter",
        surface: "dm",
        media: [document],
      }),
    /cannot be attached to X\/Twitter/
  );
});

test("LinkedIn messages enforce the combined attachment limit", () => {
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "linkedin",
        surface: "dm",
        media: [media({ size: 11 * 1024 * 1024 }), media()],
      }),
    /up to 20 MB total/
  );
});

test("X replies allow four images or one video, but not a mixed selection", () => {
  const image = media({
    fileName: "proof.png",
    mimeType: "image/png",
    size: 1024,
    kind: "image",
  });
  assert.doesNotThrow(() =>
    assertOutreachMediaCapability({
      platform: "twitter",
      surface: "comment",
      media: [image, image, image, image],
    })
  );
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "twitter",
        surface: "comment",
        media: [image, media()],
      }),
    /cannot mix images with a GIF or video/
  );
});

test("X DMs reject more than one attachment", () => {
  assert.throws(
    () =>
      assertOutreachMediaCapability({
        platform: "twitter",
        surface: "dm",
        media: [media(), media()],
      }),
    /at most one media attachment/
  );
});

test("task descriptions show selected filenames without duplicating labels", () => {
  const attachment = media();
  assert.equal(
    withAttachmentNames("Send the demo", [attachment]),
    "Send the demo\nAttachment: demo.mp4"
  );
  assert.equal(
    withAttachmentNames("Send the demo\nAttachment: old.mp4", [attachment]),
    "Send the demo\nAttachment: demo.mp4"
  );
  assert.equal(
    withAttachmentNames("Send the demo\nAttachment: old.mp4", []),
    "Send the demo"
  );
});

test("capability errors expose a clean user-facing message", () => {
  let thrown: unknown;
  try {
    assertOutreachMediaCapability({
      platform: "linkedin",
      surface: "comment",
      media: [media()],
    });
  } catch (error) {
    thrown = error;
  }
  assert.equal(
    getMediaCapabilityErrorMessage(thrown),
    "LinkedIn comments do not support video attachments. Use a photo or GIF, send the video in a LinkedIn DM, or post the comment without media."
  );
});
