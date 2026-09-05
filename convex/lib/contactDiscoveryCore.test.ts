import { afterEach, describe, expect, test, vi } from "vitest";
import { discoverPublicContactInfo } from "./contactDiscoveryCore";

describe("public website contact evidence", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("does not turn arbitrary website numbers into a phone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<p>Registration 68 608 721 562</p>", {
            headers: { "content-type": "text/html" },
          })
      )
    );
    const result = await discoverPublicContactInfo({
      platform: "twitter",
      websiteUrls: ["https://example.com/"],
    });
    expect(result.phone).toBeUndefined();
  });

  test("preserves explicit website telephone links", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            '<p>Call us: <a href="tel:+14155552671">+1 415 555 2671</a></p>',
            { headers: { "content-type": "text/html" } }
          )
      )
    );
    const result = await discoverPublicContactInfo({
      platform: "twitter",
      websiteUrls: ["https://example.com/"],
    });
    expect(result.phone?.value).toBe("+14155552671");
  });

  test("does not crawl shared-host contact pages outside a profile subtree", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          '<p>Creator page</p><a href="/trust-center/report">Contact support</a>',
          { headers: { "content-type": "text/html" } }
        )
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await discoverPublicContactInfo({
      platform: "twitter",
      websiteUrls: ["https://example.com/creator"],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ email: undefined, phone: undefined });
  });
});
