import { DESCRIPTION_CONSTRAINTS } from "@/shared/lib/utils";

export type HelpVariant = "default" | "warning" | "error";

export function getDescriptionHelpText(charCount: number): {
  text: string;
  variant: HelpVariant;
} {
  const MIN_CHARS = DESCRIPTION_CONSTRAINTS.MIN_LENGTH;
  const MAX_CHARS = DESCRIPTION_CONSTRAINTS.MAX_LENGTH;

  if (charCount === 0) {
    return {
      text: "↳ Required for keyword suggestions and filtering.",
      variant: "default",
    };
  }
  if (charCount < MIN_CHARS) {
    return { text: "↳ Describe more.", variant: "warning" };
  }
  if (charCount >= MAX_CHARS) {
    return { text: "↳ Character limit reached.", variant: "error" };
  }
  return {
    text: "↳ Keywords will be suggested based on this description.",
    variant: "default",
  };
}
