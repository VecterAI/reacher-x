type MessageTextPart = {
  type?: string;
  text?: unknown;
};

type MessageWithDisplayText = {
  text?: string | null;
  parts?: MessageTextPart[] | null;
};

export function getUIMessageDisplayText(
  message: MessageWithDisplayText
): string {
  if (message.text) {
    return message.text;
  }

  const textParts = message.parts
    ?.map((part) =>
      part.type === "text" && typeof part.text === "string" ? part.text : ""
    )
    .filter(Boolean);

  return textParts?.join("\n") ?? "";
}
