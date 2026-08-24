import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaUpload } from "../types";
import { materializeBrowserMediaFile } from "./browserMediaFile";

function createUpload(file: File): MediaUpload {
  return {
    id: "media-1",
    file,
    url: "https://storage.example.test/media.png",
    serverUrl: "https://storage.example.test/media.png",
    type: "image",
    mediaKind: "image",
    status: "completed",
    progress: 100,
  };
}

describe("materializeBrowserMediaFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a user-selected file without fetching it again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const upload = createUpload(
      new File([new Uint8Array([1])], "media.png", { type: "image/png" })
    );

    await expect(materializeBrowserMediaFile(upload)).resolves.toBe(upload);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads a server-backed placeholder before browser processing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        })
      )
    );
    const upload = createUpload(
      new File([], "media.png", { type: "image/png" })
    );

    const result = await materializeBrowserMediaFile(upload);

    expect(result.file.size).toBe(3);
    expect(result.file.type).toBe("image/png");
    expect(result.size).toBe(3);
  });

  it("rejects insecure cross-origin attachment URLs", async () => {
    const upload = {
      ...createUpload(new File([], "media.png", { type: "image/png" })),
      serverUrl: "http://storage.example.test/media.png",
    };

    await expect(materializeBrowserMediaFile(upload)).rejects.toThrow(
      "must use HTTPS"
    );
  });
});
