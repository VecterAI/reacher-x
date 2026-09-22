import { afterEach, describe, expect, test, vi } from "vitest";
import { logRagSearch, ragSearchCallers } from "./ragSearchHelpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logRagSearch", () => {
  test("registers unique caller labels for every RAG search site", () => {
    expect(ragSearchCallers.length).toBeGreaterThan(0);
    expect(new Set(ragSearchCallers).size).toBe(ragSearchCallers.length);
  });

  test("emits one attributable log line per vector search", () => {
    const consoleSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    logRagSearch({
      caller: "discovery_semantic_duplicate_screening",
      workspaceId: "ws-1",
      namespace: "queries",
      limit: 3,
      resultCount: 2,
      durationMs: 12,
      outcome: "success",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const line = String(consoleSpy.mock.calls[0]?.[0]);
    expect(line).toContain('"caller":"discovery_semantic_duplicate_screening"');
    expect(line).toContain('"workspaceId":"ws-1"');
    expect(line).toContain('"namespace":"queries"');
    expect(line).toContain('"limit":3');
    expect(line).toContain('"resultCount":2');
    expect(line).toContain('"durationMs":12');
    expect(line).toContain('"outcome":"success"');
  });

  test("emits failed searches with a zero result count", () => {
    const consoleSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    logRagSearch({
      caller: "prospect_search_unified",
      workspaceId: "ws-2",
      namespace: "prospect_search",
      limit: 120,
      resultCount: 0,
      durationMs: 40,
      outcome: "error",
    });

    const line = String(consoleSpy.mock.calls[0]?.[0]);
    expect(line).toContain('"caller":"prospect_search_unified"');
    expect(line).toContain('"outcome":"error"');
  });
});
