import { describe, expect, it } from "vitest";
import { truncateText } from "./truncateText";

describe("truncateText", () => {
  it("does not split a surrogate pair at the truncation boundary", () => {
    const value = `${"a".repeat(278)}\ud835\ude01tail`;
    const result = truncateText(value, 280);

    expect(result).toBe(`${"a".repeat(278)}…`);
    expect(result.length).toBeLessThanOrEqual(280);
    expect(result).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/u);
  });

  it("keeps a complete surrogate pair when it fits before the ellipsis", () => {
    const value = `${"a".repeat(277)}\ud835\ude01tail`;
    const result = truncateText(value, 280);

    expect(result).toBe(`${"a".repeat(277)}\ud835\ude01…`);
    expect(result.length).toBe(280);
  });

  it("preserves short text and handles zero-length budgets", () => {
    expect(truncateText("  short text  ", 20)).toBe("short text");
    expect(truncateText("long", 1)).toBe("…");
    expect(truncateText("long", 0)).toBe("");
  });
});
