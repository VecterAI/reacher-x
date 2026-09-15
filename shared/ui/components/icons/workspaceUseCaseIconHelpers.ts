import type { FC, SVGProps } from "react";
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
} from "./index";

export const workspaceUseCaseIcons: Record<
  WorkspaceUseCaseKey,
  FC<SVGProps<SVGSVGElement>>
> = {
  customer_prospecting: LeadsCustomersUsersIcon,
  recruiting: CandidatesIcon,
  partnership_outreach: PartnershipsIcon,
  investor_outreach: InvestorsIcon,
  user_research_recruitment: ResearchParticipantsIcon,
  creator_outreach: CreatorsIcon,
  community_growth: CommunityMembersIcon,
  podcast_speaker_sourcing: PodcastGuestsIcon,
  general_outreach: LeadsCustomersUsersIcon,
};
