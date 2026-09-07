import type { Infer } from "convex/values";
import type { syntheticProfileExampleValidator } from "../validators";

export type SyntheticProfileExample = Infer<
  typeof syntheticProfileExampleValidator
>;

type ProfileWithExamples = {
  title?: string;
  description?: string;
  syntheticExamples?: SyntheticProfileExample[];
};

/** Examples are embedded in their owning ICP, never in the real prospects table. */
export function hasSyntheticProfileExamples(
  profile: ProfileWithExamples
): boolean {
  const examples = profile.syntheticExamples;
  return Boolean(
    examples?.length === 2 &&
    examples.filter((example) => example.platform === "twitter").length === 1 &&
    examples.filter((example) => example.platform === "linkedin").length ===
      1 &&
    examples.every(
      (example) =>
        example.displayName.trim().length > 0 &&
        example.displayName.length <= 80 &&
        example.title.trim().length > 0 &&
        example.title.length <= 160 &&
        example.bio.trim().length > 0 &&
        example.bio.length <= (example.platform === "twitter" ? 160 : 300)
    )
  );
}

export function validateSyntheticProfileExamples(
  profiles: ProfileWithExamples[]
): void {
  if (
    profiles.length === 0 ||
    profiles.some((profile) => !hasSyntheticProfileExamples(profile))
  ) {
    throw new Error(
      "Each ideal profile requires one X/Twitter example and one LinkedIn example."
    );
  }
}

/** Names are deliberately omitted: illustrative bios guide interpretation, never evidence. */
export function formatSyntheticTargetingExamples(
  profiles: ProfileWithExamples[]
): string {
  const groups = profiles
    .filter((profile) => profile.syntheticExamples?.length)
    .map(
      (profile) =>
        `Owning ICP: ${profile.title ?? "Unspecified"}\nICP criteria: ${profile.description ?? "Use the targeting specification"}\n${profile.syntheticExamples!.map((example) => `${example.platform}: ${example.title} — ${example.bio}`).join("\n")}`
    );
  if (!groups.length) return "";
  return `Fictional targeting illustrations (not evidence or extra requirements; never search for invented identities):
The owning ICP and targeting specification control fit. These bios only illustrate possible members. Do not require matching roles, wording, interests, circumstances, or buying intent merely because an example contains them. A real prospect may qualify with a different bio. Evaluate only real evidence against the targeting specification.\n${groups.join("\n\n")}`;
}
