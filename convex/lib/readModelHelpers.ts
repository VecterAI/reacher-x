import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  extractLinkedInUsername,
  extractTwitterUsername,
} from "../../shared/lib/utils/url/socialProfiles";
import {
  normalizeTwitterUrlEntities,
  selectProfileWebsiteHref,
  type TwitterUrlEntity,
} from "../../shared/lib/twitter/profileLinks";
import { extractAvatarUrl, extractDisplayName } from "./notificationHelpers";
import {
  inferProspectReadyAtFromState,
  isProspectActionableReady,
  isProspectReadyQualifiedEnriched,
} from "./prospectAnalyticsCore";
import { getNestedRecord, getStringProperty } from "./typeGuards";
import { buildProspectSearchText } from "./prospectSearchText";

export {
  isProspectActionableReady,
  isProspectReadyQualifiedEnriched,
} from "./prospectAnalyticsCore";

export const ANALYTICS_HOURS_PER_DAY = 24;

type ProspectStage = "contacted" | "in_progress" | "converted";

type ProspectSource = Pick<
  Doc<"prospects">,
  | "_id"
  | "_creationTime"
  | "workspaceId"
  | "userId"
  | "platform"
  | "origin"
  | "setupSessionId"
  | "setupRevision"
  | "previewSelectedAt"
  | "previewRank"
  | "status"
  | "qualificationStatus"
  | "qualifiedAt"
  | "disqualifiedAt"
  | "qualificationScore"
  | "enrichedAt"
  | "enrichmentStatus"
  | "readyAt"
  | "planGenerationStatus"
  | "displayName"
  | "title"
  | "briefIntro"
  | "matchedKeywords"
  | "discoverySource"
  | "discoveryContext"
  | "location"
  | "finance"
  | "prospectType"
  | "data"
  | "socialProfiles"
  | "stageTimestamps"
  | "pipelineStage"
  | "updatedAt"
  | "company"
  | "websiteUrl"
  | "websiteHref"
  | "websiteDisplayText"
  | "bioUrlEntities"
  | "qualificationKeywords"
  | "notes"
  | "tags"
  | "painPoints"
  | "evidencePosts"
>;

type NotificationSource = Pick<Doc<"outreachNotifications">, "status">;

type ActivityLogSource = Pick<
  Doc<"prospectActivityLog">,
  "_creationTime" | "workspaceId" | "type"
>;

type PlanSource = Pick<
  Doc<"outreachPlans">,
  "_creationTime" | "workspaceId" | "status" | "updatedAt"
>;

type TaskSource = Pick<
  Doc<"outreachTasks">,
  "_creationTime" | "status" | "executedAt"
>;

const STAGE_RANK: Record<
  Exclude<Doc<"prospects">["status"], "archived">,
  number
> = {
  new: 0,
  contacted: 1,
  in_progress: 2,
  converted: 3,
};

const WORKSPACE_STATS_NUMERIC_FIELDS = [
  "totalProspectsCount",
  "newProspectsCount",
  "contactedProspectsCount",
  "inProgressProspectsCount",
  "convertedProspectsCount",
  "archivedProspectsCount",
  "twitterProspectsCount",
  "linkedInProspectsCount",
  "qualifiedProspectsCount",
  "enrichedProspectsCount",
  "plansGeneratedCount",
  "readyQualifiedEnrichedCount",
  "actionableReadyCount",
  "qualificationScoreSum",
  "qualificationScoreCount",
  "pendingNotificationCount",
] as const;

const WORKSPACE_ANALYTICS_NUMERIC_FIELDS = [
  "newProspectsCount",
  "reachedContactedProspectsCount",
  "reachedInProgressProspectsCount",
  "reachedConvertedProspectsCount",
  "fitScore0To49Count",
  "fitScore50To69Count",
  "fitScore70To79Count",
  "fitScore80To100Count",
  "qualificationQualifiedCount",
  "qualificationDisqualifiedCount",
  "actionableReadyCount",
  "qualifiedEventsCount",
  "disqualifiedEventsCount",
  "readyEventsCount",
  "twitterProspectsCount",
  "linkedInProspectsCount",
  "contactedEventsCount",
  "respondedEventsCount",
  "draftPlansCount",
  "pendingApprovalTasksCount",
  "pausedPlansCount",
  "blockedAuthPlansCount",
  "failedTasksCount",
] as const;

const WORKSPACE_ANALYTICS_HOURLY_FIELDS = [
  "hourlyNewProspectsCounts",
  "hourlyReachedContactedProspectsCounts",
  "hourlyReachedInProgressProspectsCounts",
  "hourlyReachedConvertedProspectsCounts",
  "hourlyFitScore0To49Counts",
  "hourlyFitScore50To69Counts",
  "hourlyFitScore70To79Counts",
  "hourlyFitScore80To100Counts",
  "hourlyQualificationQualifiedCounts",
  "hourlyQualificationDisqualifiedCounts",
  "hourlyActionableReadyCounts",
  "hourlyTwitterProspectsCounts",
  "hourlyLinkedInProspectsCounts",
  "hourlyContactedEventsCounts",
  "hourlyRespondedEventsCounts",
  "hourlyDraftPlansCounts",
  "hourlyPendingApprovalTasksCounts",
  "hourlyPausedPlansCounts",
  "hourlyBlockedAuthPlansCounts",
  "hourlyFailedTasksCounts",
] as const;

export interface ProspectSummaryRecord {
  prospectId: Id<"prospects">;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  platform: Doc<"prospects">["platform"];
  origin: Doc<"prospects">["origin"];
  setupSessionId: Doc<"prospects">["setupSessionId"];
  setupRevision: Doc<"prospects">["setupRevision"];
  previewSelectedAt: Doc<"prospects">["previewSelectedAt"];
  previewRank: Doc<"prospects">["previewRank"];
  status: Doc<"prospects">["status"];
  pipelineStage: Doc<"prospects">["pipelineStage"];
  stageTimestamps: Doc<"prospects">["stageTimestamps"];
  qualificationStatus: Doc<"prospects">["qualificationStatus"];
  qualifiedAt: Doc<"prospects">["qualifiedAt"];
  enrichmentStatus: Doc<"prospects">["enrichmentStatus"];
  planGenerationStatus: Doc<"prospects">["planGenerationStatus"];
  readyQualifiedEnriched: boolean;
  actionableReady?: boolean;
  readyAt: Doc<"prospects">["readyAt"];
  sortQualificationScore: number;
  qualificationScore: number | undefined;
  prospectCreatedAt: number;
  updatedAt: number;
  displayName: string;
  title: string | undefined;
  briefIntro: string | undefined;
  websiteUrl: string | undefined;
  websiteHref: string | undefined;
  websiteDisplayText: string | undefined;
  bioUrlEntities: TwitterUrlEntity[] | undefined;
  matchedKeywords: string[] | undefined;
  location: string | undefined;
  financeDisplayValue: string | undefined;
  prospectType: Doc<"prospects">["prospectType"];
  avatarUrl: string | undefined;
  profileUrl: string | undefined;
  twitterUsername: string | undefined;
  linkedInUsername: string | undefined;
  verified: boolean;
  conversationPlaceholderLabel: string;
  discoverySource: Doc<"prospects">["discoverySource"];
  searchText: string;
}

export interface WorkspaceStatsContribution {
  totalProspectsCount: number;
  newProspectsCount: number;
  contactedProspectsCount: number;
  inProgressProspectsCount: number;
  convertedProspectsCount: number;
  archivedProspectsCount: number;
  twitterProspectsCount: number;
  linkedInProspectsCount: number;
  qualifiedProspectsCount: number;
  enrichedProspectsCount: number;
  plansGeneratedCount: number;
  readyQualifiedEnrichedCount: number;
  actionableReadyCount: number;
  qualificationScoreSum: number;
  qualificationScoreCount: number;
  pendingNotificationCount: number;
}

export interface WorkspaceStatsRecord extends WorkspaceStatsContribution {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  avgQualificationScore: number;
  updatedAt: number;
}

export interface WorkspaceAnalyticsContribution {
  newProspectsCount: number;
  reachedContactedProspectsCount: number;
  reachedInProgressProspectsCount: number;
  reachedConvertedProspectsCount: number;
  fitScore0To49Count: number;
  fitScore50To69Count: number;
  fitScore70To79Count: number;
  fitScore80To100Count: number;
  qualificationQualifiedCount: number;
  qualificationDisqualifiedCount: number;
  actionableReadyCount: number;
  qualifiedEventsCount: number;
  disqualifiedEventsCount: number;
  readyEventsCount: number;
  twitterProspectsCount: number;
  linkedInProspectsCount: number;
  contactedEventsCount: number;
  respondedEventsCount: number;
  draftPlansCount: number;
  pendingApprovalTasksCount: number;
  pausedPlansCount: number;
  blockedAuthPlansCount: number;
  failedTasksCount: number;
  hourlyNewProspectsCounts: number[];
  hourlyReachedContactedProspectsCounts: number[];
  hourlyReachedInProgressProspectsCounts: number[];
  hourlyReachedConvertedProspectsCounts: number[];
  hourlyFitScore0To49Counts: number[];
  hourlyFitScore50To69Counts: number[];
  hourlyFitScore70To79Counts: number[];
  hourlyFitScore80To100Counts: number[];
  hourlyQualificationQualifiedCounts: number[];
  hourlyQualificationDisqualifiedCounts: number[];
  hourlyActionableReadyCounts: number[];
  hourlyTwitterProspectsCounts: number[];
  hourlyLinkedInProspectsCounts: number[];
  hourlyContactedEventsCounts: number[];
  hourlyRespondedEventsCounts: number[];
  hourlyDraftPlansCounts: number[];
  hourlyPendingApprovalTasksCounts: number[];
  hourlyPausedPlansCounts: number[];
  hourlyBlockedAuthPlansCounts: number[];
  hourlyFailedTasksCounts: number[];
}

export interface WorkspaceAnalyticsDailyRecord extends WorkspaceAnalyticsContribution {
  workspaceId: Id<"workspaces">;
  dayStartUtcMs: number;
  dayKey: string;
  updatedAt: number;
}

export interface TargetedWorkspaceAnalyticsContribution {
  workspaceId: Id<"workspaces">;
  dayStartUtcMs: number;
  dayKey: string;
  contribution: WorkspaceAnalyticsContribution;
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function normalizeQualificationScore(score?: number): number {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, score));
}

export function getUtcDayStartTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getUtcDayKeyFromStart(dayStartUtcMs: number): string {
  const date = new Date(dayStartUtcMs);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function getUtcHourIndex(timestamp: number): number {
  return new Date(timestamp).getUTCHours();
}

export function createEmptyHourlyAnalyticsCounts(): number[] {
  return Array.from({ length: ANALYTICS_HOURS_PER_DAY }, () => 0);
}

function normalizeHourlyAnalyticsCounts(counts?: number[]): number[] {
  const normalized = createEmptyHourlyAnalyticsCounts();
  if (!Array.isArray(counts)) {
    return normalized;
  }

  for (let index = 0; index < ANALYTICS_HOURS_PER_DAY; index += 1) {
    normalized[index] = clampCount(counts[index] ?? 0);
  }

  return normalized;
}

function addHourlyCount(
  counts: number[] | undefined,
  hour: number,
  delta: number
): number[] {
  const next = normalizeHourlyAnalyticsCounts(counts);
  if (hour < 0 || hour >= ANALYTICS_HOURS_PER_DAY) {
    return next;
  }

  next[hour] = clampCount(next[hour] + delta);
  return next;
}

function createEmptyWorkspaceStatsContribution(): WorkspaceStatsContribution {
  return {
    totalProspectsCount: 0,
    newProspectsCount: 0,
    contactedProspectsCount: 0,
    inProgressProspectsCount: 0,
    convertedProspectsCount: 0,
    archivedProspectsCount: 0,
    twitterProspectsCount: 0,
    linkedInProspectsCount: 0,
    qualifiedProspectsCount: 0,
    enrichedProspectsCount: 0,
    plansGeneratedCount: 0,
    readyQualifiedEnrichedCount: 0,
    actionableReadyCount: 0,
    qualificationScoreSum: 0,
    qualificationScoreCount: 0,
    pendingNotificationCount: 0,
  };
}

export function createEmptyWorkspaceStatsRecord(args: {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
}): WorkspaceStatsRecord {
  return {
    workspaceId: args.workspaceId,
    userId: args.userId,
    ...createEmptyWorkspaceStatsContribution(),
    avgQualificationScore: 0,
    updatedAt: getCurrentUTCTimestamp(),
  };
}

function createEmptyWorkspaceAnalyticsContribution(): WorkspaceAnalyticsContribution {
  return {
    newProspectsCount: 0,
    reachedContactedProspectsCount: 0,
    reachedInProgressProspectsCount: 0,
    reachedConvertedProspectsCount: 0,
    fitScore0To49Count: 0,
    fitScore50To69Count: 0,
    fitScore70To79Count: 0,
    fitScore80To100Count: 0,
    qualificationQualifiedCount: 0,
    qualificationDisqualifiedCount: 0,
    actionableReadyCount: 0,
    qualifiedEventsCount: 0,
    disqualifiedEventsCount: 0,
    readyEventsCount: 0,
    twitterProspectsCount: 0,
    linkedInProspectsCount: 0,
    contactedEventsCount: 0,
    respondedEventsCount: 0,
    draftPlansCount: 0,
    pendingApprovalTasksCount: 0,
    pausedPlansCount: 0,
    blockedAuthPlansCount: 0,
    failedTasksCount: 0,
    hourlyNewProspectsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyReachedContactedProspectsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyReachedInProgressProspectsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyReachedConvertedProspectsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyFitScore0To49Counts: createEmptyHourlyAnalyticsCounts(),
    hourlyFitScore50To69Counts: createEmptyHourlyAnalyticsCounts(),
    hourlyFitScore70To79Counts: createEmptyHourlyAnalyticsCounts(),
    hourlyFitScore80To100Counts: createEmptyHourlyAnalyticsCounts(),
    hourlyQualificationQualifiedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyQualificationDisqualifiedCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyActionableReadyCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyTwitterProspectsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyLinkedInProspectsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyContactedEventsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyRespondedEventsCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyDraftPlansCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyPendingApprovalTasksCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyPausedPlansCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyBlockedAuthPlansCounts: createEmptyHourlyAnalyticsCounts(),
    hourlyFailedTasksCounts: createEmptyHourlyAnalyticsCounts(),
  };
}

export function createEmptyWorkspaceAnalyticsDailyRecord(args: {
  workspaceId: Id<"workspaces">;
  dayStartUtcMs: number;
}): WorkspaceAnalyticsDailyRecord {
  return {
    workspaceId: args.workspaceId,
    dayStartUtcMs: args.dayStartUtcMs,
    dayKey: getUtcDayKeyFromStart(args.dayStartUtcMs),
    ...createEmptyWorkspaceAnalyticsContribution(),
    updatedAt: getCurrentUTCTimestamp(),
  };
}

/**
 * Legacy `workspaceAnalyticsDaily` rows may omit qualification counters; merge
 * logic expects full numeric fields.
 */
export function coerceWorkspaceAnalyticsDailyForMerge(
  doc: Doc<"workspaceAnalyticsDaily">
): Doc<"workspaceAnalyticsDaily"> & WorkspaceAnalyticsDailyRecord {
  return {
    ...doc,
    qualificationQualifiedCount: doc.qualificationQualifiedCount ?? 0,
    qualificationDisqualifiedCount: doc.qualificationDisqualifiedCount ?? 0,
    actionableReadyCount: doc.actionableReadyCount ?? 0,
    qualifiedEventsCount: doc.qualifiedEventsCount ?? 0,
    disqualifiedEventsCount: doc.disqualifiedEventsCount ?? 0,
    readyEventsCount: doc.readyEventsCount ?? 0,
    hourlyNewProspectsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyNewProspectsCounts
    ),
    hourlyReachedContactedProspectsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyReachedContactedProspectsCounts
    ),
    hourlyReachedInProgressProspectsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyReachedInProgressProspectsCounts
    ),
    hourlyReachedConvertedProspectsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyReachedConvertedProspectsCounts
    ),
    hourlyFitScore0To49Counts: normalizeHourlyAnalyticsCounts(
      doc.hourlyFitScore0To49Counts
    ),
    hourlyFitScore50To69Counts: normalizeHourlyAnalyticsCounts(
      doc.hourlyFitScore50To69Counts
    ),
    hourlyFitScore70To79Counts: normalizeHourlyAnalyticsCounts(
      doc.hourlyFitScore70To79Counts
    ),
    hourlyFitScore80To100Counts: normalizeHourlyAnalyticsCounts(
      doc.hourlyFitScore80To100Counts
    ),
    hourlyQualificationQualifiedCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyQualificationQualifiedCounts
    ),
    hourlyQualificationDisqualifiedCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyQualificationDisqualifiedCounts
    ),
    hourlyActionableReadyCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyActionableReadyCounts
    ),
    hourlyTwitterProspectsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyTwitterProspectsCounts
    ),
    hourlyLinkedInProspectsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyLinkedInProspectsCounts
    ),
    hourlyContactedEventsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyContactedEventsCounts
    ),
    hourlyRespondedEventsCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyRespondedEventsCounts
    ),
    hourlyDraftPlansCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyDraftPlansCounts
    ),
    hourlyPendingApprovalTasksCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyPendingApprovalTasksCounts
    ),
    hourlyPausedPlansCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyPausedPlansCounts
    ),
    hourlyBlockedAuthPlansCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyBlockedAuthPlansCounts
    ),
    hourlyFailedTasksCounts: normalizeHourlyAnalyticsCounts(
      doc.hourlyFailedTasksCounts
    ),
  } as Doc<"workspaceAnalyticsDaily"> & WorkspaceAnalyticsDailyRecord;
}

export function isProspectSummaryActionableReady(
  summary: Pick<Doc<"prospectSummaries">, "readyQualifiedEnriched"> & {
    actionableReady?: boolean;
  }
): boolean {
  return summary.actionableReady ?? summary.readyQualifiedEnriched;
}

export function getWorkspaceStatsActionableReadyCount(
  stats: Pick<Doc<"workspaceStats">, "readyQualifiedEnrichedCount"> & {
    actionableReadyCount?: number;
  }
): number {
  return typeof stats.actionableReadyCount === "number"
    ? stats.actionableReadyCount
    : stats.readyQualifiedEnrichedCount;
}

export function coerceWorkspaceStatsRecord(
  doc: Doc<"workspaceStats">
): WorkspaceStatsRecord {
  return {
    ...doc,
    actionableReadyCount: getWorkspaceStatsActionableReadyCount(doc),
  } as WorkspaceStatsRecord;
}

export function hasReachedProspectStage(
  prospect: Pick<
    Doc<"prospects">,
    "stageTimestamps" | "pipelineStage" | "status"
  >,
  targetStage: ProspectStage
): boolean {
  const timestamp = prospect.stageTimestamps?.[targetStage];
  if (typeof timestamp === "number") {
    return true;
  }

  const currentStage = prospect.pipelineStage ?? prospect.status;
  if (
    currentStage !== "new" &&
    currentStage !== "contacted" &&
    currentStage !== "in_progress" &&
    currentStage !== "converted"
  ) {
    return false;
  }

  return STAGE_RANK[currentStage] >= STAGE_RANK[targetStage];
}

export function getQualificationScoreBucket(
  score?: number
): "0-49" | "50-69" | "70-79" | "80-100" {
  const normalized = normalizeQualificationScore(score);
  if (normalized < 50) return "0-49";
  if (normalized < 70) return "50-69";
  if (normalized < 80) return "70-79";
  return "80-100";
}

function buildLinkedInProfileUrl(
  username: string,
  prospectType: Doc<"prospects">["prospectType"]
): string {
  if (prospectType === "organization") {
    return `https://www.linkedin.com/company/${username}`;
  }
  return `https://www.linkedin.com/in/${username}`;
}

function getProspectDisplaySnapshot(prospect: ProspectSource) {
  const socialProfiles = prospect.socialProfiles;
  const data = prospect.data;
  const user = getNestedRecord(data, "user");
  const author = getNestedRecord(data, "author");

  let avatarUrl = extractAvatarUrl(data);
  let displayName =
    prospect.displayName || extractDisplayName(data) || "Unknown";
  let profileUrl =
    socialProfiles?.twitter?.url || socialProfiles?.linkedin?.url || undefined;
  let twitterUsername =
    socialProfiles?.twitter?.username || getStringProperty(user, "screen_name");
  let linkedInUsername =
    socialProfiles?.linkedin?.username || getStringProperty(author, "username");
  let verified = false;

  if (prospect.platform === "twitter") {
    const rawAvatarUrl = getStringProperty(user, "profile_image_url_https");
    const rawDisplayName = getStringProperty(user, "name");
    avatarUrl = rawAvatarUrl || avatarUrl;
    displayName = prospect.displayName || rawDisplayName || displayName;
    twitterUsername =
      socialProfiles?.twitter?.username ||
      getStringProperty(user, "screen_name") ||
      undefined;
    verified = user?.verified === true;
    profileUrl =
      socialProfiles?.twitter?.url ||
      (twitterUsername ? `https://x.com/${twitterUsername}` : profileUrl);
  } else if (prospect.platform === "linkedin") {
    const rawDisplayName = getStringProperty(author, "name");
    const rawLinkedInUrl = getStringProperty(author, "url");
    avatarUrl = avatarUrl || getStringProperty(author, "profilePictureURL");
    displayName = prospect.displayName || rawDisplayName || displayName;
    profileUrl = socialProfiles?.linkedin?.url || rawLinkedInUrl || profileUrl;
  }

  twitterUsername = twitterUsername || extractTwitterUsername(profileUrl || "");
  linkedInUsername =
    linkedInUsername || extractLinkedInUsername(profileUrl || "");

  if (!profileUrl && linkedInUsername) {
    profileUrl = buildLinkedInProfileUrl(
      linkedInUsername,
      prospect.prospectType
    );
  }

  const conversationPlaceholderLabel =
    prospect.platform === "twitter"
      ? twitterUsername
        ? `@${twitterUsername}`
        : displayName
      : linkedInUsername || displayName;

  return {
    avatarUrl,
    displayName,
    profileUrl,
    twitterUsername,
    linkedInUsername,
    verified,
    conversationPlaceholderLabel,
  };
}

export function buildProspectSummaryRecord(
  prospect: ProspectSource
): ProspectSummaryRecord {
  const display = getProspectDisplaySnapshot(prospect);
  const qualificationScore =
    typeof prospect.qualificationScore === "number" &&
    Number.isFinite(prospect.qualificationScore)
      ? prospect.qualificationScore
      : undefined;

  const searchText = buildProspectSearchText(prospect, {
    profileUrl: display.profileUrl,
    twitterUsername: display.twitterUsername,
    linkedInUsername: display.linkedInUsername,
  });

  return {
    prospectId: prospect._id,
    workspaceId: prospect.workspaceId,
    userId: prospect.userId,
    platform: prospect.platform,
    origin: prospect.origin,
    setupSessionId: prospect.setupSessionId,
    setupRevision: prospect.setupRevision,
    previewSelectedAt: prospect.previewSelectedAt,
    previewRank: prospect.previewRank,
    status: prospect.status,
    pipelineStage: prospect.pipelineStage,
    stageTimestamps: prospect.stageTimestamps,
    qualificationStatus: prospect.qualificationStatus,
    qualifiedAt: prospect.qualifiedAt,
    enrichmentStatus: prospect.enrichmentStatus,
    planGenerationStatus: prospect.planGenerationStatus,
    readyQualifiedEnriched: isProspectReadyQualifiedEnriched(prospect),
    actionableReady: isProspectActionableReady(prospect),
    readyAt: prospect.readyAt ?? inferProspectReadyAtFromState(prospect),
    sortQualificationScore: normalizeQualificationScore(
      prospect.qualificationScore
    ),
    qualificationScore,
    prospectCreatedAt: prospect._creationTime,
    updatedAt: prospect.updatedAt ?? prospect._creationTime,
    displayName: display.displayName,
    title: prospect.title,
    briefIntro: prospect.briefIntro,
    websiteUrl: prospect.websiteUrl,
    websiteHref: selectProfileWebsiteHref(
      prospect.websiteHref,
      prospect.websiteUrl
    ),
    websiteDisplayText: prospect.websiteDisplayText,
    bioUrlEntities: normalizeTwitterUrlEntities(prospect.bioUrlEntities),
    matchedKeywords: prospect.matchedKeywords
      ? [...prospect.matchedKeywords]
      : undefined,
    location: prospect.location,
    financeDisplayValue: prospect.finance?.displayValue,
    prospectType: prospect.prospectType,
    avatarUrl: display.avatarUrl,
    profileUrl: display.profileUrl,
    twitterUsername: display.twitterUsername,
    linkedInUsername: display.linkedInUsername,
    verified: display.verified,
    conversationPlaceholderLabel: display.conversationPlaceholderLabel,
    discoverySource: prospect.discoverySource,
    searchText,
  };
}

export function getWorkspaceStatsContributionFromProspect(
  prospect: ProspectSource
): WorkspaceStatsContribution {
  const contribution = createEmptyWorkspaceStatsContribution();

  contribution.totalProspectsCount = 1;
  contribution.qualifiedProspectsCount =
    prospect.qualificationStatus === "qualified" ? 1 : 0;
  contribution.enrichedProspectsCount =
    prospect.enrichmentStatus === "enriched" ||
    prospect.enrichmentStatus === "partial"
      ? 1
      : 0;
  contribution.plansGeneratedCount =
    prospect.planGenerationStatus === "completed" ? 1 : 0;
  contribution.readyQualifiedEnrichedCount = isProspectReadyQualifiedEnriched(
    prospect
  )
    ? 1
    : 0;
  contribution.actionableReadyCount = isProspectActionableReady(prospect)
    ? 1
    : 0;

  if (prospect.status === "new") contribution.newProspectsCount = 1;
  if (prospect.status === "contacted") contribution.contactedProspectsCount = 1;
  if (prospect.status === "in_progress")
    contribution.inProgressProspectsCount = 1;
  if (prospect.status === "converted") contribution.convertedProspectsCount = 1;
  if (prospect.status === "archived") contribution.archivedProspectsCount = 1;

  if (prospect.platform === "twitter") contribution.twitterProspectsCount = 1;
  if (prospect.platform === "linkedin") contribution.linkedInProspectsCount = 1;

  if (
    prospect.qualificationStatus === "qualified" &&
    typeof prospect.qualificationScore === "number" &&
    Number.isFinite(prospect.qualificationScore)
  ) {
    contribution.qualificationScoreSum = prospect.qualificationScore;
    contribution.qualificationScoreCount = 1;
  }

  return contribution;
}

export function getWorkspaceStatsContributionFromNotification(
  notification: NotificationSource
): WorkspaceStatsContribution {
  const contribution = createEmptyWorkspaceStatsContribution();
  contribution.pendingNotificationCount =
    notification.status === "pending" ? 1 : 0;
  return contribution;
}

function applyWorkspaceStatsContribution(
  target: WorkspaceStatsRecord,
  contribution: WorkspaceStatsContribution,
  direction: 1 | -1
) {
  for (const field of WORKSPACE_STATS_NUMERIC_FIELDS) {
    const current = target[field] ?? 0;
    target[field] = clampCount(current + direction * contribution[field]);
  }
}

export function mergeWorkspaceStatsContributions(
  existing: WorkspaceStatsRecord | null,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    remove?: WorkspaceStatsContribution[];
    add?: WorkspaceStatsContribution[];
  }
): WorkspaceStatsRecord {
  const next = existing
    ? { ...coerceWorkspaceStatsRecord(existing as Doc<"workspaceStats">) }
    : createEmptyWorkspaceStatsRecord({
        workspaceId: args.workspaceId,
        userId: args.userId,
      });

  next.workspaceId = args.workspaceId;
  next.userId = args.userId;

  for (const contribution of args.remove ?? []) {
    applyWorkspaceStatsContribution(next, contribution, -1);
  }

  for (const contribution of args.add ?? []) {
    applyWorkspaceStatsContribution(next, contribution, 1);
  }

  next.avgQualificationScore =
    next.qualificationScoreCount > 0
      ? Math.round(next.qualificationScoreSum / next.qualificationScoreCount)
      : 0;
  next.updatedAt = getCurrentUTCTimestamp();

  return next;
}

function createTargetedAnalyticsContribution(args: {
  workspaceId: Id<"workspaces">;
  timestamp: number;
  patch: (contribution: WorkspaceAnalyticsContribution, hour: number) => void;
}): TargetedWorkspaceAnalyticsContribution {
  const contribution = createEmptyWorkspaceAnalyticsContribution();
  const hour = getUtcHourIndex(args.timestamp);
  args.patch(contribution, hour);

  const dayStartUtcMs = getUtcDayStartTimestamp(args.timestamp);
  return {
    workspaceId: args.workspaceId,
    dayStartUtcMs,
    dayKey: getUtcDayKeyFromStart(dayStartUtcMs),
    contribution,
  };
}

export function getWorkspaceAnalyticsContributionsFromProspect(
  prospect: ProspectSource,
  fallbackTimestamps?: {
    qualifiedAt?: number;
    disqualifiedAt?: number;
    readyAt?: number;
  }
): TargetedWorkspaceAnalyticsContribution[] {
  const contributions: TargetedWorkspaceAnalyticsContribution[] = [];

  contributions.push(
    createTargetedAnalyticsContribution({
      workspaceId: prospect.workspaceId,
      timestamp: prospect._creationTime,
      patch: (contribution, hour) => {
        contribution.newProspectsCount = 1;
        contribution.hourlyNewProspectsCounts = addHourlyCount(
          contribution.hourlyNewProspectsCounts,
          hour,
          1
        );

        if (hasReachedProspectStage(prospect, "contacted")) {
          contribution.reachedContactedProspectsCount = 1;
          contribution.hourlyReachedContactedProspectsCounts = addHourlyCount(
            contribution.hourlyReachedContactedProspectsCounts,
            hour,
            1
          );
        }
        if (hasReachedProspectStage(prospect, "in_progress")) {
          contribution.reachedInProgressProspectsCount = 1;
          contribution.hourlyReachedInProgressProspectsCounts = addHourlyCount(
            contribution.hourlyReachedInProgressProspectsCounts,
            hour,
            1
          );
        }
        if (hasReachedProspectStage(prospect, "converted")) {
          contribution.reachedConvertedProspectsCount = 1;
          contribution.hourlyReachedConvertedProspectsCounts = addHourlyCount(
            contribution.hourlyReachedConvertedProspectsCounts,
            hour,
            1
          );
        }

        if (prospect.platform === "twitter") {
          contribution.twitterProspectsCount = 1;
          contribution.hourlyTwitterProspectsCounts = addHourlyCount(
            contribution.hourlyTwitterProspectsCounts,
            hour,
            1
          );
        } else if (prospect.platform === "linkedin") {
          contribution.linkedInProspectsCount = 1;
          contribution.hourlyLinkedInProspectsCounts = addHourlyCount(
            contribution.hourlyLinkedInProspectsCounts,
            hour,
            1
          );
        }

        const fitBucket = getQualificationScoreBucket(
          prospect.qualificationScore
        );
        if (fitBucket === "0-49") {
          contribution.fitScore0To49Count = 1;
          contribution.hourlyFitScore0To49Counts = addHourlyCount(
            contribution.hourlyFitScore0To49Counts,
            hour,
            1
          );
        }
        if (fitBucket === "50-69") {
          contribution.fitScore50To69Count = 1;
          contribution.hourlyFitScore50To69Counts = addHourlyCount(
            contribution.hourlyFitScore50To69Counts,
            hour,
            1
          );
        }
        if (fitBucket === "70-79") {
          contribution.fitScore70To79Count = 1;
          contribution.hourlyFitScore70To79Counts = addHourlyCount(
            contribution.hourlyFitScore70To79Counts,
            hour,
            1
          );
        }
        if (fitBucket === "80-100") {
          contribution.fitScore80To100Count = 1;
          contribution.hourlyFitScore80To100Counts = addHourlyCount(
            contribution.hourlyFitScore80To100Counts,
            hour,
            1
          );
        }

        if (prospect.qualificationStatus === "qualified") {
          contribution.qualificationQualifiedCount = 1;
          contribution.hourlyQualificationQualifiedCounts = addHourlyCount(
            contribution.hourlyQualificationQualifiedCounts,
            hour,
            1
          );
        } else if (prospect.qualificationStatus === "disqualified") {
          contribution.qualificationDisqualifiedCount = 1;
          contribution.hourlyQualificationDisqualifiedCounts = addHourlyCount(
            contribution.hourlyQualificationDisqualifiedCounts,
            hour,
            1
          );
        }

        contribution.actionableReadyCount = isProspectActionableReady(prospect)
          ? 1
          : 0;
        if (contribution.actionableReadyCount > 0) {
          contribution.hourlyActionableReadyCounts = addHourlyCount(
            contribution.hourlyActionableReadyCounts,
            hour,
            1
          );
        }
      },
    })
  );

  const qualificationTimestamp =
    prospect.qualificationStatus === "qualified"
      ? (prospect.qualifiedAt ?? fallbackTimestamps?.qualifiedAt)
      : prospect.qualificationStatus === "disqualified"
        ? (prospect.disqualifiedAt ?? fallbackTimestamps?.disqualifiedAt)
        : undefined;

  if (
    typeof qualificationTimestamp === "number" &&
    (prospect.qualificationStatus === "qualified" ||
      prospect.qualificationStatus === "disqualified")
  ) {
    contributions.push(
      createTargetedAnalyticsContribution({
        workspaceId: prospect.workspaceId,
        timestamp: qualificationTimestamp,
        patch: (contribution) => {
          if (prospect.qualificationStatus === "qualified") {
            contribution.qualifiedEventsCount = 1;
          } else {
            contribution.disqualifiedEventsCount = 1;
          }
        },
      })
    );
  }

  const readyTimestamp =
    fallbackTimestamps?.readyAt ??
    prospect.readyAt ??
    inferProspectReadyAtFromState(prospect);

  if (
    isProspectActionableReady(prospect) &&
    typeof readyTimestamp === "number"
  ) {
    contributions.push(
      createTargetedAnalyticsContribution({
        workspaceId: prospect.workspaceId,
        timestamp: readyTimestamp,
        patch: (contribution) => {
          contribution.readyEventsCount = 1;
        },
      })
    );
  }

  return contributions;
}

export function getWorkspaceAnalyticsContributionFromActivityLog(
  activity: ActivityLogSource
): TargetedWorkspaceAnalyticsContribution | null {
  if (activity.type !== "contacted" && activity.type !== "responded") {
    return null;
  }

  return createTargetedAnalyticsContribution({
    workspaceId: activity.workspaceId,
    timestamp: activity._creationTime,
    patch: (contribution, hour) => {
      if (activity.type === "contacted") {
        contribution.contactedEventsCount = 1;
        contribution.hourlyContactedEventsCounts = addHourlyCount(
          contribution.hourlyContactedEventsCounts,
          hour,
          1
        );
      }

      if (activity.type === "responded") {
        contribution.respondedEventsCount = 1;
        contribution.hourlyRespondedEventsCounts = addHourlyCount(
          contribution.hourlyRespondedEventsCounts,
          hour,
          1
        );
      }
    },
  });
}

export function getWorkspaceAnalyticsContributionsFromPlan(
  plan: PlanSource
): TargetedWorkspaceAnalyticsContribution[] {
  const contributions: TargetedWorkspaceAnalyticsContribution[] = [];

  if (plan.status === "draft") {
    contributions.push(
      createTargetedAnalyticsContribution({
        workspaceId: plan.workspaceId,
        timestamp: plan._creationTime,
        patch: (contribution, hour) => {
          contribution.draftPlansCount = 1;
          contribution.hourlyDraftPlansCounts = addHourlyCount(
            contribution.hourlyDraftPlansCounts,
            hour,
            1
          );
        },
      })
    );
  }

  if (plan.status === "paused" || plan.status === "blocked_auth") {
    const issueTimestamp = plan.updatedAt ?? plan._creationTime;
    contributions.push(
      createTargetedAnalyticsContribution({
        workspaceId: plan.workspaceId,
        timestamp: issueTimestamp,
        patch: (contribution, hour) => {
          if (plan.status === "paused") {
            contribution.pausedPlansCount = 1;
            contribution.hourlyPausedPlansCounts = addHourlyCount(
              contribution.hourlyPausedPlansCounts,
              hour,
              1
            );
          } else {
            contribution.blockedAuthPlansCount = 1;
            contribution.hourlyBlockedAuthPlansCounts = addHourlyCount(
              contribution.hourlyBlockedAuthPlansCounts,
              hour,
              1
            );
          }
        },
      })
    );
  }

  return contributions;
}

export function getWorkspaceAnalyticsContributionsFromTask(args: {
  task: TaskSource;
  workspaceId: Id<"workspaces">;
}): TargetedWorkspaceAnalyticsContribution[] {
  const contributions: TargetedWorkspaceAnalyticsContribution[] = [];

  if (args.task.status === "pending") {
    contributions.push(
      createTargetedAnalyticsContribution({
        workspaceId: args.workspaceId,
        timestamp: args.task._creationTime,
        patch: (contribution, hour) => {
          contribution.pendingApprovalTasksCount = 1;
          contribution.hourlyPendingApprovalTasksCounts = addHourlyCount(
            contribution.hourlyPendingApprovalTasksCounts,
            hour,
            1
          );
        },
      })
    );
  }

  if (args.task.status === "failed") {
    const failedTimestamp = args.task.executedAt ?? args.task._creationTime;
    contributions.push(
      createTargetedAnalyticsContribution({
        workspaceId: args.workspaceId,
        timestamp: failedTimestamp,
        patch: (contribution, hour) => {
          contribution.failedTasksCount = 1;
          contribution.hourlyFailedTasksCounts = addHourlyCount(
            contribution.hourlyFailedTasksCounts,
            hour,
            1
          );
        },
      })
    );
  }

  return contributions;
}

function applyWorkspaceAnalyticsContribution(
  target: WorkspaceAnalyticsDailyRecord,
  contribution: WorkspaceAnalyticsContribution,
  direction: 1 | -1
) {
  for (const field of WORKSPACE_ANALYTICS_NUMERIC_FIELDS) {
    const current = target[field] ?? 0;
    const delta = contribution[field] ?? 0;
    target[field] = clampCount(current + direction * delta);
  }

  for (const field of WORKSPACE_ANALYTICS_HOURLY_FIELDS) {
    const next = normalizeHourlyAnalyticsCounts(target[field]);
    const delta = normalizeHourlyAnalyticsCounts(contribution[field]);
    target[field] = next.map((value, index) =>
      clampCount(value + direction * delta[index])
    );
  }
}

export function mergeWorkspaceAnalyticsContributions(
  existing: WorkspaceAnalyticsDailyRecord | null,
  args: {
    workspaceId: Id<"workspaces">;
    dayStartUtcMs: number;
    remove?: WorkspaceAnalyticsContribution[];
    add?: WorkspaceAnalyticsContribution[];
  }
): WorkspaceAnalyticsDailyRecord {
  const next = existing
    ? { ...existing }
    : createEmptyWorkspaceAnalyticsDailyRecord({
        workspaceId: args.workspaceId,
        dayStartUtcMs: args.dayStartUtcMs,
      });

  next.workspaceId = args.workspaceId;
  next.dayStartUtcMs = args.dayStartUtcMs;
  next.dayKey = getUtcDayKeyFromStart(args.dayStartUtcMs);

  for (const contribution of args.remove ?? []) {
    applyWorkspaceAnalyticsContribution(next, contribution, -1);
  }

  for (const contribution of args.add ?? []) {
    applyWorkspaceAnalyticsContribution(next, contribution, 1);
  }

  next.updatedAt = getCurrentUTCTimestamp();

  return next;
}

export function isWorkspaceAnalyticsRecordEmpty(
  record: WorkspaceAnalyticsDailyRecord
): boolean {
  for (const field of WORKSPACE_ANALYTICS_NUMERIC_FIELDS) {
    if ((record[field] ?? 0) > 0) {
      return false;
    }
  }

  for (const field of WORKSPACE_ANALYTICS_HOURLY_FIELDS) {
    const counts = normalizeHourlyAnalyticsCounts(record[field]);
    if (counts.some((count) => count > 0)) {
      return false;
    }
  }

  return true;
}
