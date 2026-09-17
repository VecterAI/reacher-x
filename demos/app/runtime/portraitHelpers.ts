import type { Doc } from "@/convex/_generated/dataModel";
import { getNestedRecord } from "@/convex/lib/typeGuards";
import portraits from "./portraitAssets.json";

const assets: Record<string, { path: string }> = portraits;

/** Keep a fictional person's portrait consistent in profiles and evidence. */
export function applyDemoPortrait(prospect: Doc<"prospects">) {
  const portrait = assets[prospect.displayName ?? ""];
  if (!portrait)
    throw new Error(`Missing demo portrait: ${prospect.displayName}`);
  const person = structuredClone(prospect);
  for (const data of [person.data, ...(person.evidencePosts ?? [])]) {
    const author = getNestedRecord(data, "author");
    if (author) author.profilePictureURL = portrait.path;
    const user = getNestedRecord(data, "user");
    if (user) user.profile_image_url_https = portrait.path;
  }
  return person;
}
