/**
 * Barrel exports for prospect UI components
 */
export { ProspectProfilePanel } from "./ProspectProfilePanel";
export type {
  ProspectProfilePanelProps,
  ProspectProfileData,
} from "./ProspectProfilePanel";

export { ProspectProfileHeader } from "./ProspectProfileHeader";
export type { ProspectProfileHeaderProps } from "./ProspectProfileHeader";
export { LinkedInProfilePanel } from "./LinkedInProfilePanel";
export type { LinkedInProfilePanelProps } from "./LinkedInProfilePanel";
export { LinkedInCommentComposerPanel } from "./LinkedInCommentComposerPanel";
export type { LinkedInCommentComposerPanelProps } from "./LinkedInCommentComposerPanel";

export { PipelineTimeline } from "./PipelineTimeline";
export type {
  PipelineTimelineProps,
  PipelineStage,
  PipelineStageData,
} from "./PipelineTimeline";

export { ProspectDetailsCard } from "./ProspectDetailsCard";
export type { ProspectDetailsCardProps } from "./ProspectDetailsCard";

export { PainSolutionGrid } from "./PainSolutionGrid";
export type { PainSolutionGridProps, PainPoint } from "./PainSolutionGrid";

export { SocialProfileLinks } from "./SocialProfileLinks";
export type {
  SocialProfileLinksProps,
  SocialProfiles,
} from "./SocialProfileLinks";

export { EvidencePostsPanel } from "./EvidencePostsPanel";
export type { EvidencePostsPanelProps } from "./EvidencePostsPanel";

export { ProspectPanelRenderer } from "./ProspectPanelRenderer";
export type { ProspectPanelRendererProps } from "./ProspectPanelRenderer";

export {
  ProspectCard,
  ProspectCardSkeleton,
  ProspectCardHeader,
  ProspectCardBody,
  ProspectCardFooter,
  ProspectCardMenu,
} from "./prospect-card";

export { PendingProspectsFeedBar } from "./PendingProspectsFeedBar";
export { ProspectListFilterPanel } from "./ProspectListFilterPanel";
export { ProspectListSortPanel } from "./ProspectListSortPanel";

export { IdealCustomerProfileCard } from "./ideal-customer-profile/IdealCustomerProfileCard";
export type {
  IdealCustomerProfileCardData,
  IdealCustomerProfileCardProps,
} from "./ideal-customer-profile/IdealCustomerProfileCard";

// Outreach components
export { OutreachPlanSection } from "./OutreachPlanSection";
export type { OutreachPlanSectionProps } from "./OutreachPlanSection";
export {
  OutreachPlanCard,
  TaskItem,
  type OutreachPlanCardProps,
  type OutreachPlanCardTask,
  type OutreachPlanCardVariant,
  type TaskItemProps,
  type TaskItemMode,
} from "./outreach-plan";

// Tab components
export { OverviewTab, ActivityLogTab } from "./tabs";
export type { OverviewTabProps, ActivityLogTabProps } from "./tabs";
