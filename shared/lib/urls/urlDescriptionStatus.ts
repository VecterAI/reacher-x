/**
 * Shared status copy for URL → description auto-fill (Exa) and related
 * loading states. Used by landing acquisition and setup step 2.
 */

export const URL_DESCRIPTION_AUTO_FILL_STATUS =
  "Auto-filling description..." as const;

export const URL_DESCRIPTION_GENERATING_PROFILES_STATUS =
  "Generating ideal profiles..." as const;

export function resolveUrlDescriptionStatusText(args: {
  isReadingUrl: boolean;
  isGeneratingProfiles?: boolean;
}): string | null {
  if (args.isReadingUrl) {
    return URL_DESCRIPTION_AUTO_FILL_STATUS;
  }
  if (args.isGeneratingProfiles) {
    return URL_DESCRIPTION_GENERATING_PROFILES_STATUS;
  }
  return null;
}
