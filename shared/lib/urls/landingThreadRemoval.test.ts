import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../../proxy";
import sitemap from "../../../app/sitemap";
import nextConfig from "../../../next.config.mjs";

const mocks = vi.hoisted(() => ({
  authkit: vi.fn(),
  handleAuthkitProxy: vi.fn(),
}));
vi.mock("@workos-inc/authkit-nextjs", () => mocks);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authkit.mockResolvedValue({
    session: { user: null },
    headers: new Headers(),
    authorizationUrl: "https://auth.example/sign-in",
  });
});

describe("routing after public thread removal", () => {
  test("sitemap has no thread entries and performs no backend requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const entries = await sitemap();
      expect(entries.map((entry) => entry.url)).toEqual([
        "https://reacherx.com",
        "https://reacherx.com/home",
        "https://reacherx.com/use-cases",
        "https://reacherx.com/pricing",
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("legacy redirects do not send visitors to removed thread pages", async () => {
    const redirects = await nextConfig.redirects!();
    expect(
      redirects.some(
        (redirect) =>
          redirect.source.includes("threads") ||
          redirect.destination.includes("threads")
      )
    ).toBe(false);
    expect(redirects).toContainEqual({
      source: "/home/pricing",
      destination: "/pricing",
      permanent: true,
    });
  });

  test.each([
    "/home",
    "/home/v0",
    "/pricing",
    "/use-cases",
    "/login",
    "/signup",
    "/callback",
    "/post/x/123",
  ])("preserves public access to %s", async (path) => {
    const request = new NextRequest(`https://reacherx.com${path}`);
    await proxy(request);
    expect(mocks.handleAuthkitProxy).toHaveBeenCalledWith(
      request,
      expect.any(Headers)
    );
  });

  test.each([
    "/threads",
    "/threads/123",
    "/threads/123/nested",
    "/agent/setup",
  ])("applies the existing protected-path policy to %s", async (path) => {
    const request = new NextRequest(`https://reacherx.com${path}`);
    await proxy(request);
    expect(mocks.handleAuthkitProxy).toHaveBeenCalledWith(
      request,
      expect.any(Headers),
      { redirect: "https://auth.example/sign-in" }
    );
  });

  test("authenticated retired URLs pass through to Next's missing-route handling", async () => {
    mocks.authkit.mockResolvedValue({
      session: { user: { id: "test-user" } },
      headers: new Headers(),
    });
    const request = new NextRequest("https://reacherx.com/threads/123");
    await proxy(request);
    expect(mocks.handleAuthkitProxy).toHaveBeenCalledWith(
      request,
      expect.any(Headers)
    );
  });

  test("anonymous homepage redirects preserve query parameters", async () => {
    const request = new NextRequest("https://reacherx.com/?utm_source=test");
    await proxy(request);
    expect(mocks.handleAuthkitProxy).toHaveBeenCalledWith(
      request,
      expect.any(Headers),
      { redirect: new URL("https://reacherx.com/home?utm_source=test") }
    );
  });
});
