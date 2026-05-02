import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import {
  LeadsCustomersUsersIcon,
  PartnershipsIcon,
  InvestorsIcon,
  CandidatesIcon,
  CommunityMembersIcon,
  CreatorsIcon,
  PodcastGuestsIcon,
  ResearchParticipantsIcon,
} from "./icons";

const useCaseIllustrationByKey: Record<
  WorkspaceUseCaseKey,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  customer_prospecting: LeadsCustomersUsersIcon,
  partnership_outreach: PartnershipsIcon,
  investor_outreach: InvestorsIcon,
  recruiting: CandidatesIcon,
  user_research_recruitment: ResearchParticipantsIcon,
  creator_outreach: CreatorsIcon,
  community_growth: CommunityMembersIcon,
  podcast_speaker_sourcing: PodcastGuestsIcon,
};

export function UseCaseIllustration({
  useCaseKey,
}: {
  useCaseKey: WorkspaceUseCaseKey;
}) {
  const Cmp = useCaseIllustrationByKey[useCaseKey];
  return (
    <div className="border-border flex size-16 shrink-0 items-center justify-center rounded-xl border">
      <Cmp className="text-foreground size-12" />
    </div>
  );
}
