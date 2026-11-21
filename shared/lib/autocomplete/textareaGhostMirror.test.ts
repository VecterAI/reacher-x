// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import {
  buildTextareaGhostMirrorStyle,
  isSameTextareaGhostMirrorStyle,
} from "@/shared/lib/autocomplete/textareaGhostMirror";

afterEach(() => {
  document.body.innerHTML = "";
});

function mountTextarea(box: {
  offsetWidth: number;
  clientWidth: number;
  offsetHeight: number;
}) {
  const textarea = document.createElement("textarea");
  Object.assign(textarea.style, {
    fontFamily: "Inter",
    fontSize: "14px",
    lineHeight: "20px",
    letterSpacing: "0.1px",
    paddingTop: "8px",
    paddingRight: "12px",
    paddingBottom: "8px",
    paddingLeft: "12px",
    borderLeftWidth: "1px",
    borderRightWidth: "1px",
    borderStyle: "solid",
    color: "rgb(10, 10, 10)",
  });
  document.body.appendChild(textarea);
  for (const [key, value] of Object.entries(box)) {
    Object.defineProperty(textarea, key, { value, configurable: true });
  }
  return textarea;
}

describe("textarea ghost mirror", () => {
  test("wraps like the textarea: same box, padding, font and pre-wrap", () => {
    const textarea = mountTextarea({
      offsetWidth: 320,
      clientWidth: 318,
      offsetHeight: 60,
    });

    const style = buildTextareaGhostMirrorStyle(textarea);

    expect(style).toMatchObject({
      position: "absolute",
      width: 320,
      height: 60,
      boxSizing: "border-box",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
      overflow: "hidden",
      pointerEvents: "none",
      paddingLeft: "12px",
      paddingRight: 12,
      borderLeftWidth: "1px",
      borderRightWidth: "1px",
      borderColor: "transparent",
      fontFamily: "Inter",
      fontSize: "14px",
      lineHeight: "20px",
      letterSpacing: "0.1px",
      color: "rgb(10, 10, 10)",
    });
    // Never the clipped single-line overlay the old ghost used.
    expect(style.whiteSpace).not.toBe("nowrap");
    expect(style).not.toHaveProperty("maskImage");
  });

  test("adds the textarea's scrollbar width to the right padding", () => {
    const textarea = mountTextarea({
      offsetWidth: 320,
      clientWidth: 303,
      offsetHeight: 240,
    });

    // 320 - 303 - 1 - 1 = 15px scrollbar: wrap column stays the same.
    expect(buildTextareaGhostMirrorStyle(textarea).paddingRight).toBe(27);
  });

  test("style equality ignores identity", () => {
    const textarea = mountTextarea({
      offsetWidth: 320,
      clientWidth: 318,
      offsetHeight: 60,
    });
    const a = buildTextareaGhostMirrorStyle(textarea);
    const b = buildTextareaGhostMirrorStyle(textarea);
    expect(isSameTextareaGhostMirrorStyle(a, b)).toBe(true);
    expect(isSameTextareaGhostMirrorStyle(a, { ...b, height: 80 })).toBe(false);
    expect(isSameTextareaGhostMirrorStyle(a, null)).toBe(false);
    expect(isSameTextareaGhostMirrorStyle(null, null)).toBe(true);
  });
});
