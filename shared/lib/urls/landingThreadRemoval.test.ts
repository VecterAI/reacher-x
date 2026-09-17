import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "../../../proxy";
import sitemap from "../../../app/sitemap";
import nextConfig from "../../../next.config.mjs";

const mocks = vi.hoisted(() => ({
  authkit: vi.fn(),
  handleAuthkitProxy: vi.fn(),
}));
vi.mock("@workos-inc/authkit-nextjs", () => ({
  ...mocks,
  partitionAuthkitHeaders: () => ({
    requestHeaders: new Headers(),
    responseHeaders: new Headers(),
  }),
  applyResponseHeaders: (response: Response) => response,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handleAuthkitProxy.mockImplementation(() => NextResponse.next());
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
      expect(entries.map((entry) => entry.url)).toEqual(
        expect.arrayContaining([
          "https://reacherx.com/home",
          "https://reacherx.com/use-cases",
          "https://reacherx.com/pricing",
          "https://reacherx.com/blog",
          "https://reacherx.com/use-cases/investors",
        ])
      );
      expect(
        entries.some(
          (entry) =>
            entry.url.includes("/threads") || entry.url.includes("/preview")
        )
      ).toBe(false);
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
    expect(
      redirects.some((r) => /\/home\/(?:v\d+|preview)/.test(r.source))
    ).toBe(false);
    expect(redirects).toContainEqual({
      source: "/home/pricing",
      destination: "/pricing",
      permanent: true,
    });
  });

  test.each([
    "/home",
    "/pricing",
    "/use-cases",
    "/use-cases/investors",
    "/product",
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

describe("marketing routes reject invalid paths before streaming", () => {
  test.each([
    "/use-cases/not-real",
    "/use-cases/customers/extra",
    "/use-cases/__proto__",
    "/use-cases/missing.png",
    "/home/v0",
    "/home/v2",
    "/home/v2/nested",
    "/home/preview",
    "/home/preview/network",
    "/home/preview/missing",
    "/home/preview/describe",
    "/home/preview/goals",
    "/home/preview/describe/extra",
  ])("returns a real 404 for %s", async (path) => {
    const response = await proxy(
      new NextRequest(`https://reacherx.com${path}`)
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(await response.text()).toContain("Explore use cases");
    expect(mocks.handleAuthkitProxy).not.toHaveBeenCalled();
  });
});

test("authenticated root still opens the dashboard", async () => {
  mocks.authkit.mockResolvedValue({
    session: { user: { id: "test-user" } },
    headers: new Headers(),
  });
  const request = new NextRequest("https://reacherx.com/");
  await proxy(request);
  expect(mocks.handleAuthkitProxy).toHaveBeenCalledWith(
    request,
    expect.any(Headers)
  );
});

test("retired homepage variants also return 404 when authenticated", async () => {
  mocks.authkit.mockResolvedValue({
    session: { user: { id: "test-user" } },
    headers: new Headers(),
  });
  for (const path of [
    "/home/v0",
    "/home/v2",
    "/home/preview",
    "/home/preview/network",
  ]) {
    const response = await proxy(
      new NextRequest(`https://reacherx.com${path}`)
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  }
});

describe("agent format negotiation preserves auth and Next.js protocols", () => {
  test.each(["/home", "/product", "/pricing", "/use-cases/investors", "/blog"])(
    "negotiates public Markdown at %s",
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://reacherx.com${path}?utm_source=qa`, {
          headers: { Accept: "text/markdown" },
        })
      );
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        `https://reacherx.com/markdown${path}?utm_source=qa`
      );
      expect(response.headers.get("vary")).toMatch(/Accept/);
      expect(response.headers.get("link")).toContain('type="text/markdown"');
    }
  );
  test.each<{ method: string; headers: Record<string, string> }>([
    { method: "GET", headers: { Accept: "text/markdown", RSC: "1" } },
    { method: "POST", headers: { Accept: "text/markdown" } },
    {
      method: "POST",
      headers: { Accept: "text/markdown", "next-action": "action-id" },
    },
  ])("preserves RSC and server-action requests: %j", async (init) => {
    const response = await proxy(
      new NextRequest("https://reacherx.com/home", init)
    );
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });
  test("authenticated root remains the app when Markdown is requested", async () => {
    mocks.authkit.mockResolvedValue({
      session: { user: { id: "test-user" } },
      headers: new Headers(),
    });
    const response = await proxy(
      new NextRequest("https://reacherx.com/", {
        headers: { Accept: "text/markdown" },
      })
    );
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
    expect(mocks.handleAuthkitProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.any(Headers)
    );
  });
});
