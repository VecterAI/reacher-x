import { afterEach, describe, expect, test, vi } from "vitest";
import {
  downloadConversationAttachment,
  getConversationAttachmentDownloadItems,
  getConversationAttachmentDownloadUrl,
} from "./conversationAttachmentDownload";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("conversation attachment downloads", () => {
  test("keeps downloadable media and excludes rich links and unavailable rows", () => {
    const items = getConversationAttachmentDownloadItems([
      {
        id: "image-1",
        type: "image",
        url: "https://example.com/photo",
        mimeType: "image/jpeg",
      },
      {
        id: "post-1",
        type: "linkedin_post",
        url: "https://www.linkedin.com/posts/example",
      },
      {
        id: "missing-1",
        type: "file",
        unavailable: true,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "image-1",
      label: "Image 1",
      fileName: "image-1.jpg",
      sourceUrl: "https://example.com/photo",
    });
  });

  test("selects the highest bitrate downloadable media variant", () => {
    const sourceUrl = getConversationAttachmentDownloadUrl({
      type: "video",
      previewUrl: "https://example.com/poster.jpg",
      variants: [
        {
          url: "https://example.com/playlist.m3u8",
          mimeType: "application/x-mpegURL",
          bitrate: 3_000_000,
        },
        {
          url: "https://example.com/video-small.mp4",
          mimeType: "video/mp4",
          bitrate: 256_000,
        },
        {
          url: "https://example.com/video-large.mp4",
          mimeType: "video/mp4",
          bitrate: 2_000_000,
        },
      ],
    });

    expect(sourceUrl).toBe("https://example.com/video-large.mp4");
  });

  test("downloads XChat blob URLs without a network round trip", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const link = { click, download: "", href: "", rel: "", remove, style: {} };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", {
      body: { append },
      createElement: vi.fn(() => link),
    });
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:3000" } });

    await downloadConversationAttachment({
      sourceUrl: "blob:http://127.0.0.1:3000/decrypted-media",
      fileName: "voice/note.m4a",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(link.href).toBe("blob:http://127.0.0.1:3000/decrypted-media");
    expect(link.download).toBe("voice_note.m4a");
    expect(append).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });

  test("converts cross-origin bytes to a browser-owned Blob URL", async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn(() => "blob:http://127.0.0.1:3000/download");
    const link = { click, download: "", href: "", rel: "", remove, style: {} };
    const response = new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/pdf" },
    });
    const fetchMock = vi.fn(async () => response);
    class BrowserUrl extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal("URL", BrowserUrl);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", {
      body: { append },
      createElement: vi.fn(() => link),
    });
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:3000" },
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
    });

    await downloadConversationAttachment({
      sourceUrl: "https://storage.example.com/report.pdf",
      fileName: "report.pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.example.com/report.pdf",
      { credentials: "omit", redirect: "follow" }
    );
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(link.href).toBe("blob:http://127.0.0.1:3000/download");
    expect(link.download).toBe("report.pdf");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://127.0.0.1:3000/download"
    );
  });
});
