import { describe, expect, it } from "vitest";
import { shouldRefreshUnipileClientCache } from "./unipileClient";

describe("shouldRefreshUnipileClientCache", () => {
  const currentConfig = {
    baseUrl: "https://api37.unipile.com:16798",
    apiKey: "old-token",
  };

  it("reuses the client while its environment-backed configuration is stable", () => {
    expect(
      shouldRefreshUnipileClientCache(currentConfig, { ...currentConfig })
    ).toBe(false);
  });

  it("refreshes the client after a DSN rotation", () => {
    expect(
      shouldRefreshUnipileClientCache(currentConfig, {
        ...currentConfig,
        baseUrl: "https://api24.unipile.com:15439",
      })
    ).toBe(true);
  });

  it("refreshes the client after an API-key rotation", () => {
    expect(
      shouldRefreshUnipileClientCache(currentConfig, {
        ...currentConfig,
        apiKey: "renewed-token",
      })
    ).toBe(true);
  });
});
