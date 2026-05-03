import type { SerializedEditorState } from "lexical";

/** Minimal Lexical root state from plain text (single paragraph). */
export function buildSerializedTextState(
  text: string
): SerializedEditorState | undefined {
  const value = text.trim();
  if (!value) return undefined;

  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children: [
        {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction: "ltr",
          children: [
            {
              type: "text",
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              version: 1,
              text: value,
            },
          ],
        },
      ],
    },
  } as unknown as SerializedEditorState;
}
