import type { ComponentType } from "react";
import type { WorkspaceUseCaseKey } from "@/shared/lib/workspaceUseCases";
import { SharedUseCaseIllustrationSvg } from "./SharedUseCaseIllustrationSvg";

/** Swap this component’s markup when you add the final artwork. */
export function CustomerProspectingIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function PartnershipOutreachIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function InvestorOutreachIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function RecruitingIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function CommunityGrowthIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function CreatorOutreachIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function PodcastSpeakerSourcingIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

export function UserResearchRecruitmentIllustration() {
  return <SharedUseCaseIllustrationSvg />;
}

const useCaseIllustrationByKey: Record<WorkspaceUseCaseKey, ComponentType> = {
  customer_prospecting: CustomerProspectingIllustration,
  recruiting: RecruitingIllustration,
  partnership_outreach: PartnershipOutreachIllustration,
  investor_outreach: InvestorOutreachIllustration,
  user_research_recruitment: UserResearchRecruitmentIllustration,
  creator_outreach: CreatorOutreachIllustration,
  community_growth: CommunityGrowthIllustration,
  podcast_speaker_sourcing: PodcastSpeakerSourcingIllustration,
};

export function UseCaseIllustration({
  useCaseKey,
}: {
  useCaseKey: WorkspaceUseCaseKey;
}) {
  const Cmp = useCaseIllustrationByKey[useCaseKey];
  return <Cmp />;
}
