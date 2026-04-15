const CARET_MIRROR_STYLE_PROPS = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "MozTabSize",
  "direction",
] as const;

export type TextareaCaretCoordinates = {
  top: number;
  left: number;
  lineHeight: number;
};

export function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): TextareaCaretCoordinates {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";

  for (const property of CARET_MIRROR_STYLE_PROPS) {
    const value = (computed as any)[property] as string | undefined;
    if (typeof value === "string" && value.length > 0) {
      (mirror.style as any)[property] = value;
    }
  }

  mirror.textContent = textarea.value.slice(0, position);

  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight =
    Number.parseFloat(computed.lineHeight) ||
    Number.parseFloat(computed.fontSize) ||
    20;
  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;

  document.body.removeChild(mirror);

  return { top, left, lineHeight };
}
