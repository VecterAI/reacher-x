// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * The inline suggestion ghost is drawn with the muted-foreground role on the
 * background role (app/globals.css). Ghost text is readable content the user
 * may accept, so it must meet WCAG AA for normal text (4.5:1) in both themes.
 */

const css = readFileSync(
  fileURLToPath(new URL("../../../app/globals.css", import.meta.url)),
  "utf8"
);

function readHslToken(block: string, name: string) {
  const match = new RegExp(
    `--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`
  ).exec(block);
  if (!match) {
    throw new Error(`--${name} not found`);
  }
  return match.slice(1, 4).map(Number) as [number, number, number];
}

function themeBlock(selector: ":root" | ".dark") {
  const start = css.indexOf(`${selector} {`, css.indexOf("@layer base"));
  if (start < 0) {
    throw new Error(`${selector} block not found`);
  }
  return css.slice(start, css.indexOf("}", start));
}

function hslToRgb([h, s, l]: [number, number, number]) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]) {
  const [hi, lo] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort(
    (x, y) => y - x
  );
  return (hi + 0.05) / (lo + 0.05);
}

describe("inline suggestion ghost contrast", () => {
  test("the ghost rule uses the muted-foreground role without opacity", () => {
    const rule = /\[data-inline-suggestion\]::after\s*{([^}]*)}/.exec(css)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain("color: hsl(var(--muted-foreground))");
    expect(rule).not.toMatch(/opacity/);
  });

  for (const selector of [":root", ".dark"] as const) {
    test(`muted-foreground on background meets AA in ${selector}`, () => {
      const block = themeBlock(selector);
      const ratio = contrast(
        readHslToken(block, "muted-foreground"),
        readHslToken(block, "background")
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
