import { startOfMonth, subMonths } from "date-fns";
import type { Doc } from "@/convex/_generated/dataModel";
import { makeProspect } from "@/features/landing/ui/components/use-case-demo/useCaseDemoData";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { getNestedRecord } from "@/convex/lib/typeGuards";
import { applyDemoPortrait } from "./portraitHelpers";
import portraits from "./portraitAssets.json";
import {
  getWorkspaceUseCase,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";

const outcomes: Record<WorkspaceUseCaseKey, string> = {
  customer_prospecting:
    "Tried the feedback app on a client project and became a customer.",
  recruiting:
    "Accepted the offer after the interview and agreed on a start date.",
  partnership_outreach:
    "Agreed on the referral terms and started the partnership.",
  investor_outreach:
    "Committed to the round after reviewing the deck and speaking with the founders.",
  user_research_recruitment:
    "Passed the screening questions and confirmed a research session.",
  creator_outreach: "Agreed on the content brief, fee, and publication date.",
  community_growth: "Accepted the invitation and joined the community.",
  podcast_speaker_sourcing:
    "Confirmed the episode topic and booked a recording slot.",
  general_outreach: "Accepted the invitation and confirmed the next step.",
};

/** Earlier contacts fill history pages without changing the people in the walkthrough. */
export function createBackgroundProspects(
  workspaces: Doc<"workspaces">[],
  people: Doc<"prospects">[]
) {
  const usedNames = new Set(people.map((person) => person.displayName));
  const names = Object.keys(portraits).filter((name) => !usedNames.has(name));
  const now = getCurrentUTCTimestamp();
  return workspaces.flatMap((workspace, workspaceIndex) => {
    const example = people.find(
      (person) => person.workspaceId === workspace._id
    )!;
    return [0, 1, 2].map((monthsAgo): Doc<"prospects"> => {
      const displayName = names[workspaceIndex * 3 + monthsAgo];
      const archived = monthsAgo === 1;
      const createdAt = +subMonths(
        Math.max(+startOfMonth(now), now - 6 * 3600000),
        monthsAgo
      );
      const person = applyDemoPortrait(
        makeProspect({
          key: `history_${workspaceIndex}_${monthsAgo}`,
          platform: example.platform,
          displayName,
          handle: `fictional-${displayName.toLowerCase().replaceAll(" ", "-")}`,
          title: example.title ?? "Independent professional",
          briefIntro: archived
            ? "Asked to pause the conversation because the timing no longer worked."
            : outcomes[getWorkspaceUseCase(workspace.useCaseKey).key],
          signal:
            example.briefIntro ??
            workspace.description ??
            "Shared relevant professional experience.",
          qualificationScore: archived ? 78 : 91,
          hoursAgo: 6,
          matchedKeywords: [],
        })
      );
      // These are older contacts, without an invented public post to inspect.
      person.evidencePosts = [];
      person.discoverySource = "search_people";
      person.data =
        person.platform === "linkedin"
          ? { author: getNestedRecord(person.data, "author") }
          : { user: getNestedRecord(person.data, "user") };
      return {
        ...person,
        workspaceId: workspace._id,
        userId: workspace.userId,
        _creationTime: createdAt,
        updatedAt: createdAt + 3600000,
        qualifiedAt: createdAt,
        enrichedAt: createdAt,
        readyAt: createdAt,
        enrichmentStatus: "enriched",
        status: archived ? "archived" : "converted",
        pipelineStage: archived ? "archived" : "converted",
      };
    });
  });
}
