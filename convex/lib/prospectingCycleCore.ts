import type { Infer } from "convex/values";
import {
  prospectingCycleStatusValidator,
  prospectPlatformValidator,
} from "../validators";

export type ProspectingPlatform = Infer<typeof prospectPlatformValidator>;

export type ProspectingCycleOutcome = {
  status: Infer<typeof prospectingCycleStatusValidator>;
  reason?: string;
  prospectsFound: number;
  twitterSaved: number;
  linkedinSaved: number;
  failedPlatforms?: ProspectingPlatform[];
  shouldContinue: boolean;
};

export function buildProspectingCycleOutcome(args: {
  twitterSaved: number;
  linkedinSaved: number;
  failedPlatforms: ProspectingPlatform[];
}): ProspectingCycleOutcome {
  const prospectsFound = args.twitterSaved + args.linkedinSaved;

  if (args.failedPlatforms.length > 0) {
    const platformNames = args.failedPlatforms.map((platform) =>
      platform === "twitter" ? "X/Twitter" : "LinkedIn"
    );

    return {
      status: "error",
      reason: `${platformNames.join(" and ")} search failed and will be retried`,
      prospectsFound,
      twitterSaved: args.twitterSaved,
      linkedinSaved: args.linkedinSaved,
      failedPlatforms: args.failedPlatforms,
      shouldContinue: true,
    };
  }

  return {
    status: "completed",
    prospectsFound,
    twitterSaved: args.twitterSaved,
    linkedinSaved: args.linkedinSaved,
    shouldContinue: true,
  };
}
