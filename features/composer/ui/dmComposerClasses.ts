/** Card uses `p-2` for 8px inset from border; editor stays pt-0 so we do not stack Lexical py-2 on top of that. */
export const DM_COMPOSER_CONTENT_EDITABLE_CLASS =
  "ContentEditable__root relative block overflow-auto px-0 pt-0 pb-2 text-sm leading-5 wrap-break-word whitespace-pre-wrap focus:outline-hidden";

export const DM_COMPOSER_PLACEHOLDER_CLASS =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-0 pt-0 pb-2 text-sm leading-5 text-ellipsis select-none";

/** Read-only inline preview: ~3 lines max (leading-5 x 3), muted draft text. */
export const COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS =
  "ContentEditable__root relative block max-h-[3.75rem] overflow-hidden px-0 pt-0 pb-0 text-sm leading-5 text-muted-foreground wrap-break-word break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] focus:outline-hidden pointer-events-none select-none";

/** Preview placeholder aligns with the clamped preview body. */
export const COMPOSER_PREVIEW_PLACEHOLDER_CLASS =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-0 pt-0 pb-0 text-sm leading-5 text-ellipsis select-none";

export const DM_COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS =
  COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS;
