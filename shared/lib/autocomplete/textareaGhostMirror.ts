import type { CSSProperties } from "react";

/**
 * Computed textarea properties copied onto the ghost mirror so the mirror's
 * text lays out (and wraps) exactly like the textarea's.
 */
const MIRRORED_TEXT_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSizeAdjust",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textAlign",
  "textIndent",
  "textTransform",
  "tabSize",
  "direction",
  "wordBreak",
  "color",
] as const;

function px(value: string | null | undefined) {
  return Number.parseFloat(value ?? "") || 0;
}

/**
 * Style for a div laid exactly over `textarea` (same box, padding, font and
 * wrap width) that renders the textarea's text plus the ghost suggestion in
 * the text flow. The mirror is the textarea's previous sibling inside a
 * `position: relative` wrapper, so `offsetTop/offsetLeft` place it.
 *
 * A vertical scrollbar narrows the textarea's content box; that width is
 * added to the right padding so both wrap at the same column.
 */
export function buildTextareaGhostMirrorStyle(
  textarea: HTMLTextAreaElement
): CSSProperties {
  const computed =
    textarea.ownerDocument.defaultView?.getComputedStyle(textarea);
  if (!computed) {
    return { display: "none" };
  }

  const borderLeft = px(computed.borderLeftWidth);
  const borderRight = px(computed.borderRightWidth);
  const scrollbarWidth = Math.max(
    0,
    textarea.offsetWidth - textarea.clientWidth - borderLeft - borderRight
  );

  const style: Record<string, string | number> = {
    position: "absolute",
    top: textarea.offsetTop,
    left: textarea.offsetLeft,
    width: textarea.offsetWidth,
    height: textarea.offsetHeight,
    boxSizing: "border-box",
    margin: 0,
    paddingTop: computed.paddingTop,
    paddingRight: px(computed.paddingRight) + scrollbarWidth,
    paddingBottom: computed.paddingBottom,
    paddingLeft: computed.paddingLeft,
    borderStyle: "solid",
    borderColor: "transparent",
    borderTopWidth: computed.borderTopWidth,
    borderRightWidth: computed.borderRightWidth,
    borderBottomWidth: computed.borderBottomWidth,
    borderLeftWidth: computed.borderLeftWidth,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    overflow: "hidden",
    pointerEvents: "none",
    userSelect: "none",
  };

  for (const property of MIRRORED_TEXT_PROPERTIES) {
    const value = computed[property];
    if (typeof value === "string" && value.length > 0) {
      style[property] = value;
    }
  }

  return style as CSSProperties;
}

/** True when two mirror styles would render identically. */
export function isSameTextareaGhostMirrorStyle(
  a: CSSProperties | null,
  b: CSSProperties | null
) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aKeys = Object.keys(a) as (keyof CSSProperties)[];
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every((key) => a[key] === b[key])
  );
}
