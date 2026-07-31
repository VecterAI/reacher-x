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
export { LinkedInProfileSummaryHeader } from "./LinkedInProfileSummaryHeader";
export type {
  LinkedInProfileSummaryData,
  LinkedInProfileSummaryHeaderProps,
} from "./LinkedInProfileSummaryHeader";

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
export { ProspectAgentPanel } from "./ProspectAgentPanel";
export type { ProspectAgentPanelProps } from "./ProspectAgentPanel";

export {
  ProspectCard,
  ProspectCardSkeleton,
  ProspectCardHeader,
  ProspectCardBody,
  ProspectCardFooter,
  ProspectCardMenu,
} from "./prospect-card";

export { PendingProspectsFeedBar } from "./PendingProspectsFeedBar";
export { ProspectListEmptyState } from "./ProspectListEmptyState";
export type { ProspectListEmptyStateProps } from "./ProspectListEmptyState";
export { ProspectWaitingState } from "./ProspectWaitingState";
export type { ProspectWaitingStateProps } from "./ProspectWaitingState";
export { ProspectListFilterPanel } from "./ProspectListFilterPanel";
export { ProspectListSortPanel } from "./ProspectListSortPanel";
export { ProspectsToolbar } from "./ProspectsToolbar";
export type {
  ProspectsToolbarProps,
  ProspectsToolbarTab,
  ProspectsToolbarStageCounts,
  ProspectsToolbarTabAttention,
} from "./ProspectsToolbar";

export {
  IdealCustomerProfileCard,
  IdealCustomerProfileCardSkeleton,
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
} from "./ideal-customer-profile";
export type {
  IdealCustomerProfileCardData,
  IdealCustomerProfileCardProps,
} from "./ideal-customer-profile";

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
