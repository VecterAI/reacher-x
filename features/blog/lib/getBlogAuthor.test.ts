import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  options: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    constructor(_url: string, options: unknown) {
      mocks.options(options);
    }
    action = mocks.action;
  },
}));
import { getBlogAuthor } from "./getBlogAuthor";
import { BLOG_AUTHOR_FALLBACK } from "./blogAuthorHelpers";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
});
test("uses the public profile action inside a shared hourly cache", async () => {
  const profile = {
    name: "First",
    screen_name: "ReacherXfounder",
    verified: true,
    profile_image_url_https: "https://pbs.twimg.com/a.jpg",
  };
  mocks.action.mockResolvedValueOnce({ profile }).mockResolvedValueOnce({
    profile: {
      ...profile,
      name: "Updated",
      profile_image_url_https: "https://pbs.twimg.com/b.jpg",
    },
  });
  expect((await getBlogAuthor()).name).toBe("First");
  expect((await getBlogAuthor()).image).toBe("https://pbs.twimg.com/b.jpg");
  expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
  expect(mocks.cacheTag).toHaveBeenCalledWith("blog-author");
  expect(mocks.action.mock.calls[0][1]).toEqual({
    username: "ReacherXfounder",
  });
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}"));
  await mocks.options.mock.calls[0][0].fetch(
    "https://example.convex.cloud",
    {}
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    })
  );
  fetchMock.mockRestore();
});
test("missing deployment produces the fallback without network work", async () => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
  expect(await getBlogAuthor()).toEqual(BLOG_AUTHOR_FALLBACK);
  expect(mocks.action).not.toHaveBeenCalled();
  expect(mocks.cacheLife).toHaveBeenCalledTimes(1);
});
test.each([
  new Error("provider unavailable"),
  new DOMException("Timed out", "TimeoutError"),
])("provider failures keep the article available", async (error) => {
  mocks.action.mockRejectedValue(error);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await getBlogAuthor()).toEqual(BLOG_AUTHOR_FALLBACK);
  expect(mocks.cacheLife).toHaveBeenCalledTimes(1);
  expect(mocks.cacheLife).toHaveBeenLastCalledWith({
    stale: 60,
    revalidate: 60,
    expire: 300,
  });
  warn.mockRestore();
});
