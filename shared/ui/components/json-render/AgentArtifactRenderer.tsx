"use client";

import * as React from "react";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { InlinePanelOpenPayload } from "@/features/agent/lib";
import { InlinePostListCard } from "@/features/agent/ui/components/InlinePostListCard";
import { InlinePanelTriggerCard } from "@/features/agent/ui/components/InlinePanelTriggerCard";
import { InlineProfilePreviewCard } from "@/features/agent/ui/components/InlineProfilePreviewCard";
import { InlineProspectProfileCard } from "@/features/agent/ui/components/InlineProspectProfileCard";
import { InlineReplyApprovalCard } from "@/features/agent/ui/components/InlineReplyApprovalCard";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { PlanBatchProgressCard } from "@/features/agent/ui/components/PlanBatchProgressCard";
import { WorkspaceProfileChangeCard } from "@/features/agent/ui/components/WorkspaceProfileChangeCard";
import { PostCard } from "@/features/agent/ui/components/PostCard";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@/shared/ui/components/Marker";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  OutreachPlanCard,
  type OutreachPlanCardTask,
} from "@/features/prospects/ui/components/outreach-plan";
import { InlineDmPreviewCard } from "@/features/agent/ui/components/InlineDmPreviewCard";
import { InlineAttachmentPreview } from "@/features/agent/ui/components/InlineAttachmentPreview";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  ChangeHistoryIcon,
  CheckCircleIcon,
  CognitionIcon,
  ErrorIcon,
  OpenInNewIcon,
  RadioButtonUncheckedIcon,
} from "@/shared/ui/components/icons";
import {
  agentArtifactCatalog,
  type AgentArtifactEnvelope,
  type AgentArtifactProgressStep,
  type AgentArtifactTask,
  validateAgentArtifactEnvelope,
} from "@/shared/lib/json-render/agentArtifacts";
import {
  getTwitterPostRef,
  summarizeTwitterPost,
} from "@/shared/lib/twitter/contracts";
import { useOutreachPlanPreviewState } from "@/shared/hooks";
import { buildAgentOpsMemoryHref } from "@/shared/lib/urls/agentOpsHref";

interface AgentArtifactActionContextValue {
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  onOpenPostPanel?: (payload: InlinePanelOpenPayload) => void;
  onOpenPanel?: (payload: InlinePanelOpenPayload) => void;
  onApprovePlan?: (planId: string) => void | Promise<void>;
  onDeletePlan?: (planId: string) => void | Promise<void>;
  onOpenWorkspaceProfilePanel?: (requestId: string) => void;
}

const AgentArtifactActionContext =
  React.createContext<AgentArtifactActionContextValue>({});

function useAgentArtifactActions() {
  return React.useContext(AgentArtifactActionContext);
}

function WorkspaceProfileChangeArtifactCard({
  props,
}: {
  props: { requestId: string };
}) {
  const { onOpenWorkspaceProfilePanel } = useAgentArtifactActions();
  return (
    <WorkspaceProfileChangeCard
      requestId={props.requestId}
      onReview={onOpenWorkspaceProfilePanel}
    />
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getArtifactProgressStatusIcon(
  status: AgentArtifactProgressStep["status"]
) {
  switch (status) {
    case "completed":
      return (
        <CheckCircleIcon className="h-4 w-4 fill-current text-green-500" />
      );
    case "failed":
      return <ErrorIcon className="h-4 w-4 fill-current text-red-500" />;
    case "running":
      // Artifacts are persisted launch-time snapshots. A live spinner here
      // would incorrectly claim the workflow is still active on old turns.
      return <RadioButtonUncheckedIcon className="h-4 w-4 text-blue-500" />;
    default:
      return (
        <RadioButtonUncheckedIcon className="text-muted-foreground h-4 w-4" />
      );
  }
}

function ProgressStatusCard({
  props,
}: {
  props: {
    title?: string | null;
    message?: string | null;
    progress: AgentArtifactProgressStep[];
    totalProspects?: number | null;
  };
}) {
  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      {props.title && <p className="text-sm font-medium">{props.title}</p>}

      {props.progress.length > 0 && (
        <div className="space-y-2">
          {props.progress.map((step) => (
            <div
              key={`${step.step}-${step.status}-${step.count ?? "none"}-${step.details ?? "none"}`}
              className="flex items-start gap-2"
            >
              <div className="mt-0.5 shrink-0">
                {getArtifactProgressStatusIcon(step.status)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.status === "completed" &&
                        "text-green-700 dark:text-green-400",
                      step.status === "failed" &&
                        "text-red-700 dark:text-red-400",
                      step.status === "running" &&
                        "text-blue-700 dark:text-blue-400"
                    )}
                  >
                    {step.step}
                  </span>
                  {step.count !== undefined && step.count > 0 && (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                      {step.count}
                    </span>
                  )}
                </div>
                {step.details && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {step.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {props.message && (
        <p className="text-muted-foreground text-xs">{props.message}</p>
      )}

      {typeof props.totalProspects === "number" && props.totalProspects > 0 && (
        <div className="text-muted-foreground text-xs">
          Found {props.totalProspects} prospects
        </div>
      )}
    </div>
  );
}

function PostArtifactCard({
  props,
}: {
  props: {
    platform: "twitter" | "linkedin";
    prospectId?: string | null;
    openKind?: "post" | "post_list" | null;
    postData?: unknown | null;
    postRef?: unknown | null;
    postSummary?: unknown | null;
    context?: string | null;
    taskId?: string | null;
    taskStatus?: string | null;
    panelMode?: "approval" | "posted" | null;
    targetTweetId?: string | null;
    interactive?: boolean | null;
  };
}) {
  const { onOpenPanel } = useAgentArtifactActions();
  const postRef = getTwitterPostRef(props.postRef);
  const postSummary = summarizeTwitterPost(props.postSummary ?? props.postData);
  const handleOpenPanel =
    props.interactive !== false && onOpenPanel
      ? () => {
          if (props.openKind === "post_list") {
            onOpenPanel({
              kind: "post_list",
              platform: props.platform,
              prospectId: props.prospectId ?? undefined,
              title: "Post",
              posts: [props.postData ?? props.postSummary],
            });
            return;
          }

          onOpenPanel({
            kind: "post",
            platform: props.platform,
            prospectId: props.prospectId ?? undefined,
            postData: props.postData ?? undefined,
            postRef,
            postSummary,
            context: props.context ?? undefined,
            taskId: props.taskId ?? undefined,
            taskStatus: props.taskStatus ?? undefined,
            panelMode: props.panelMode ?? undefined,
            targetTweetId: props.targetTweetId ?? undefined,
          });
        }
      : undefined;

  return (
    <InlinePanelTriggerCard
      platform={props.platform}
      postData={props.postData ?? undefined}
      postRef={postRef}
      postSummary={postSummary}
      context={props.context ?? undefined}
      panelMode={props.panelMode ?? undefined}
      onOpenPanel={handleOpenPanel}
    />
  );
}

function ProfilePreviewArtifactCard({
  props,
}: {
  props: {
    variant: "prospect" | "twitter" | "linkedin";
    prospectId?: string | null;
    platform?: "twitter" | "linkedin" | null;
    profileData: unknown;
    label?: string | null;
    context?: string | null;
    interactive?: boolean | null;
  };
}) {
  const { onOpenPanel } = useAgentArtifactActions();

  return props.variant === "prospect" ? (
    <InlineProspectProfileCard
      prospectId={props.prospectId}
      profileData={asRecord(props.profileData) ?? {}}
      label={props.label}
      interactive={props.interactive !== false && !!onOpenPanel}
      onOpenPanel={() => {
        if (!onOpenPanel) return;
        onOpenPanel({
          kind: "prospect_profile",
          platform: props.platform ?? "twitter",
          prospectId: props.prospectId ?? undefined,
          profileData: props.profileData ?? undefined,
        });
      }}
      onOpenDmPanel={() => {
        if (!onOpenPanel) return;
        onOpenPanel({
          kind: "dm",
          platform: props.platform ?? "twitter",
          prospectId: props.prospectId ?? undefined,
        });
      }}
    />
  ) : (
    <InlineProfilePreviewCard
      variant={props.variant}
      prospectId={props.prospectId}
      platform={props.platform}
      profileData={asRecord(props.profileData) ?? {}}
      label={props.label}
      context={props.context}
      interactive={props.interactive !== false && !!onOpenPanel}
      onOpenPanel={() => {
        if (!onOpenPanel) return;
        const kind =
          props.variant === "twitter" ? "twitter_profile" : "linkedin_profile";
        onOpenPanel({
          kind,
          platform: props.platform ?? "twitter",
          prospectId: props.prospectId ?? undefined,
          profileData: props.profileData ?? undefined,
        });
      }}
    />
  );
}

function PostListArtifactCard({
  props,
}: {
  props: {
    platform: "twitter" | "linkedin";
    title: string;
    prospectId?: string | null;
    context?: string | null;
    posts: Array<{
      id: string;
      platform: "twitter" | "linkedin";
      textPreview: string;
      createdAt?: number | null;
      postData?: unknown | null;
      postRef?: unknown | null;
      postSummary?: unknown | null;
    }>;
    interactive?: boolean | null;
  };
}) {
  const { onOpenPanel } = useAgentArtifactActions();

  return (
    <InlinePostListCard
      platform={props.platform}
      title={props.title}
      posts={props.posts.map((post) => post.postData ?? post.postSummary)}
      prospectId={props.prospectId}
      context={props.context}
      interactive={props.interactive !== false && !!onOpenPanel}
      onOpenPanel={() => {
        onOpenPanel?.({
          kind: "post_list",
          platform: props.platform,
          prospectId: props.prospectId ?? undefined,
          title: props.title,
          posts: props.posts.map((post) => post.postData ?? post.postSummary),
        });
      }}
    />
  );
}

function PlanPreviewArtifactCard({
  props,
}: {
  props: {
    planId?: string | null;
    prospectId?: string | null;
    status: string;
    rationale: string;
    tasks: AgentArtifactTask[];
  };
}) {
  const { onOpenPlanPanel, onApprovePlan, onDeletePlan } =
    useAgentArtifactActions();
  const { resolvedPlanPreview } = useOutreachPlanPreviewState({
    planId: props.planId,
    fallbackStatus: props.status,
    fallbackRationale: props.rationale,
    fallbackTasks: props.tasks as OutreachPlanCardTask[],
  });

  if (!resolvedPlanPreview) {
    return null;
  }

  return (
    <OutreachPlanCard
      variant="preview"
      status={resolvedPlanPreview.status}
      rationale={resolvedPlanPreview.rationale}
      tasks={resolvedPlanPreview.tasks}
      actionsDisabled={resolvedPlanPreview.actionsDisabled}
      onApprove={
        resolvedPlanPreview.status === "draft" && props.planId && onApprovePlan
          ? () => {
              void onApprovePlan(props.planId!);
            }
          : undefined
      }
      onDeletePlan={
        props.planId && onDeletePlan
          ? () => onDeletePlan(props.planId!)
          : undefined
      }
      footerAction={
        onOpenPlanPanel
          ? {
              label: "Show plan",
              onClick: () => onOpenPlanPanel(props.prospectId ?? null),
              disabled: resolvedPlanPreview.showPlanDisabled,
              title: resolvedPlanPreview.showPlanDisabled
                ? "This plan has been deleted"
                : undefined,
            }
          : undefined
      }
    />
  );
}

function MemoryArtifactCard({
  props,
}: {
  props: {
    memoryId: string;
    workspaceId?: string | null;
    prospectId?: string | null;
    title: string;
    category: string;
    source: string;
    confidence: number;
    impactScore: number;
  };
}) {
  const router = useRouter();
  const href = buildAgentOpsMemoryHref(props.memoryId);

  return (
    <Marker role="status" className="w-full gap-2 py-0.5 text-xs">
      <MarkerIcon className="border-border bg-background text-primary flex size-5 items-center justify-center rounded-md border">
        <CognitionIcon className="text-primary size-3.5 fill-current" />
      </MarkerIcon>
      <MarkerContent className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-xs leading-none font-medium">
          {props.title}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xsIcon"
          className="text-muted-foreground hover:text-foreground size-5 shrink-0"
          aria-label="Open memory in Agent observability"
          title="Open in Agent observability"
          onClick={() => router.push(href)}
        >
          <OpenInNewIcon className="size-3.5 fill-current" />
        </Button>
      </MarkerContent>
    </Marker>
  );
}

function DmDraftArtifactCard({
  props,
}: {
  props: {
    platform?: "twitter" | "linkedin" | null;
    prospectId: string;
    actionRequestId: string;
    title: string;
    message?: string | null;
    status: string;
    draftContent?: string | null;
  };
}) {
  const { onOpenPanel } = useAgentArtifactActions();
  const liveActionRequestData = useQuery(
    api.socialActions.getActionRequestPanelContext,
    props.actionRequestId
      ? { actionRequestId: props.actionRequestId as Id<"agentActionRequests"> }
      : "skip"
  );
  const platform =
    liveActionRequestData?.platform ?? props.platform ?? "twitter";
  const liveStatus = liveActionRequestData?.status ?? props.status;
  const liveDraftContent =
    liveActionRequestData?.content ?? props.draftContent ?? null;

  if (platform === "linkedin") {
    return (
      <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{props.title}</p>
          {props.message ? (
            <p className="text-muted-foreground text-xs">{props.message}</p>
          ) : null}
          {liveDraftContent ? (
            <p className="bg-background/80 rounded-md border px-2 py-1 text-xs whitespace-pre-wrap">
              {liveDraftContent}
            </p>
          ) : null}
        </div>

        <InlineFeatureStrip
          leading={
            <>
              <div className="border-border rounded-md border p-1">
                <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
              </div>
              <span className="text-sm font-medium">
                {liveStatus === "completed"
                  ? "LinkedIn result →"
                  : "Review LinkedIn draft →"}
              </span>
            </>
          }
          trailing={
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                onOpenPanel?.({
                  kind: "dm",
                  platform: "linkedin",
                  prospectId: props.prospectId,
                  actionRequestId: props.actionRequestId,
                  draftText: liveDraftContent ?? undefined,
                });
              }}
            >
              {liveStatus === "completed" ? "Open result" : "Review"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <InlineDmPreviewCard
      prospectId={props.prospectId}
      actionRequestId={props.actionRequestId}
      onOpenPanel={() => {
        onOpenPanel?.({
          kind: "dm",
          platform: "twitter",
          prospectId: props.prospectId,
          actionRequestId: props.actionRequestId,
          draftText: liveDraftContent ?? undefined,
        });
      }}
    />
  );
}

function TwitterActionArtifactCard({
  props,
}: {
  props: {
    platform?: "twitter" | "linkedin" | null;
    actionKey: string;
    actionRequestId?: string | null;
    title: string;
    message?: string | null;
    status: string;
    approvalMode?: string | null;
    riskLevel?: string | null;
    targetTweetId?: string | null;
    sourcePostData?: unknown | null;
    sourcePostRef?: unknown | null;
    sourcePostSummary?: unknown | null;
    sourceContext?: string | null;
    draftContent?: string | null;
    createdTweetId?: string | null;
    interactive?: boolean | null;
    eligibilityReasonCode?: string | null;
  };
}) {
  const { onOpenPanel } = useAgentArtifactActions();
  const router = useRouter();
  const approveActionRequest = useMutation(
    api.socialActions.approveActionRequest
  );
  const cancelActionRequest = useMutation(
    api.socialActions.cancelActionRequest
  );
  const livePanelData = useQuery(
    api.socialActions.getActionRequestPanelContext,
    props.actionRequestId
      ? { actionRequestId: props.actionRequestId as any }
      : "skip"
  );
  const [pendingInlineAction, setPendingInlineAction] = React.useState<
    "approve" | "reject" | null
  >(null);
  const [isApproving, setIsApproving] = React.useState(false);
  const platform =
    livePanelData?.platform ??
    props.platform ??
    (props.actionKey.startsWith("linkedin_") ? "linkedin" : "twitter");
  const isReplyAction =
    platform === "twitter" && props.actionKey === "reply_to_post";
  const sourcePostData = livePanelData?.sourcePostData ?? props.sourcePostData;
  const sourcePostRef = getTwitterPostRef(
    livePanelData?.sourcePostRef ?? props.sourcePostRef
  );
  const sourcePostSummary = summarizeTwitterPost(
    livePanelData?.sourcePostSummary ?? props.sourcePostSummary
  );
  const sourceContext = livePanelData?.sourceContext ?? props.sourceContext;
  const liveStatus = livePanelData?.status ?? props.status;

  const canReviewInPanel =
    props.interactive !== false &&
    !!onOpenPanel &&
    !!props.actionRequestId &&
    (isReplyAction ||
      (platform === "linkedin"
        ? !!sourcePostData
        : !!sourcePostSummary || !!sourcePostRef));

  const liveDraftContent = livePanelData?.content ?? props.draftContent;
  const isDisconnectedDmCta =
    platform === "twitter" &&
    (props.actionKey === "send_dm" ||
      props.actionKey === "send_dm_in_existing_conversation") &&
    (props.eligibilityReasonCode === "missing_connection" ||
      props.message ===
        "Connect X/Twitter in Settings → Connected accounts to message this prospect.");

  const reviewButtonLabel =
    liveStatus === "completed" ? "Open result" : "Review";
  const showInlineApprove =
    liveStatus === "pending_approval" &&
    !!props.actionRequestId &&
    !canReviewInPanel;

  if (
    isReplyAction &&
    (liveStatus === "pending_approval" || liveStatus === "completed")
  ) {
    return (
      <InlineReplyApprovalCard
        status={liveStatus}
        draftContent={liveDraftContent}
        mediaUrls={livePanelData?.mediaUrls ?? []}
        mediaDescriptions={livePanelData?.mediaDescriptions ?? []}
        mediaKinds={livePanelData?.mediaKinds ?? []}
        sourcePostRef={sourcePostRef}
        sourcePostSummary={sourcePostSummary}
        targetTweetId={props.targetTweetId ?? undefined}
        reviewButtonLabel={reviewButtonLabel}
        onOpenPanel={
          canReviewInPanel
            ? () => {
                onOpenPanel?.({
                  platform,
                  postData: sourcePostData ?? undefined,
                  postRef: sourcePostRef,
                  postSummary: sourcePostSummary,
                  context: sourceContext ?? undefined,
                  panelMode: liveStatus === "completed" ? "posted" : "approval",
                  targetTweetId: props.targetTweetId ?? undefined,
                  actionRequestId: props.actionRequestId ?? undefined,
                });
              }
            : undefined
        }
        onApprove={
          liveStatus === "pending_approval" && props.actionRequestId
            ? async () => {
                try {
                  setPendingInlineAction("approve");
                  await approveActionRequest({
                    actionRequestId: props.actionRequestId as any,
                  });
                } finally {
                  setPendingInlineAction(null);
                }
              }
            : undefined
        }
        onReject={
          liveStatus === "pending_approval" && props.actionRequestId
            ? async () => {
                try {
                  setPendingInlineAction("reject");
                  await cancelActionRequest({
                    actionRequestId: props.actionRequestId as any,
                  });
                } finally {
                  setPendingInlineAction(null);
                }
              }
            : undefined
        }
        pendingAction={pendingInlineAction}
      />
    );
  }

  if (isDisconnectedDmCta) {
    return (
      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="text-sm font-medium">
              Connect X/Twitter account →
            </span>
          </>
        }
        trailing={
          <Button
            size="xs"
            onClick={() => router.push("/settings/connected-accounts")}
          >
            Connect
          </Button>
        }
      />
    );
  }

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{props.title}</p>
          {props.riskLevel && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
              {props.riskLevel.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {props.message && (
          <p className="text-muted-foreground text-xs">{props.message}</p>
        )}
        {liveDraftContent && liveStatus === "pending_approval" && (
          <p className="bg-background/80 rounded-md border px-2 py-1 text-xs whitespace-pre-wrap">
            {liveDraftContent}
          </p>
        )}
      </div>

      {platform === "twitter" && sourcePostSummary ? (
        <PostCard
          platform="twitter"
          postRef={sourcePostRef}
          postSummary={sourcePostSummary}
          context={sourceContext ?? undefined}
          readOnly
          showFullContent={true}
          bodyLineClamp={3}
          showOpenGraphPreview={false}
        />
      ) : platform === "linkedin" && sourcePostData ? (
        <PostCard
          platform="linkedin"
          postData={sourcePostData}
          context={sourceContext ?? undefined}
          readOnly
          showFullContent={true}
          bodyLineClamp={3}
          showOpenGraphPreview={false}
        />
      ) : null}

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span className="text-sm font-medium">
              {liveStatus === "pending_approval"
                ? "Input required →"
                : liveStatus === "completed"
                  ? "Action result →"
                  : "Action preview →"}
            </span>
          </>
        }
        trailing={
          <>
            {showInlineApprove ? (
              <Button
                size="xs"
                disabled={isApproving}
                onClick={async () => {
                  try {
                    setIsApproving(true);
                    await approveActionRequest({
                      actionRequestId: props.actionRequestId as any,
                    });
                  } finally {
                    setIsApproving(false);
                  }
                }}
              >
                {isApproving ? "Approving..." : "Approve"}
              </Button>
            ) : null}
            {canReviewInPanel ? (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    onOpenPanel?.({
                      platform,
                      postData: sourcePostData ?? undefined,
                      postRef: sourcePostRef,
                      postSummary: sourcePostSummary,
                      context: sourceContext ?? undefined,
                      panelMode:
                        liveStatus === "completed" ? "posted" : "approval",
                      targetTweetId: props.targetTweetId ?? undefined,
                      actionRequestId: props.actionRequestId ?? undefined,
                    });
                  }}
                >
                  {reviewButtonLabel}
                </Button>
                <Button
                  variant="outline"
                  size="xsIcon"
                  onClick={() => {
                    onOpenPanel?.({
                      platform,
                      postData: sourcePostData ?? undefined,
                      postRef: sourcePostRef,
                      postSummary: sourcePostSummary,
                      context: sourceContext ?? undefined,
                      panelMode:
                        liveStatus === "completed" ? "posted" : "approval",
                      targetTweetId: props.targetTweetId ?? undefined,
                      actionRequestId: props.actionRequestId ?? undefined,
                    });
                  }}
                >
                  <OpenInNewIcon className="fill-current" />
                </Button>
              </>
            ) : null}
          </>
        }
      />
    </div>
  );
}

const { registry } = defineRegistry(agentArtifactCatalog, {
  components: {
    OnboardingCard: ({ props }) => (
      <OnboardingProgressCard workspaceId={props.workspaceId} />
    ),
    ProgressStatusCard: ({ props }) => <ProgressStatusCard props={props} />,
    PostArtifact: ({ props }) => <PostArtifactCard props={props} />,
    ProfilePreviewCard: ({ props }) => (
      <ProfilePreviewArtifactCard props={props} />
    ),
    PostListArtifact: ({ props }) => <PostListArtifactCard props={props} />,
    PlanPreviewCard: ({ props }) => <PlanPreviewArtifactCard props={props} />,
    PlanBatchProgressCard: ({ props }) => (
      <PlanBatchProgressCard runId={props.runId} />
    ),
    MemoryCard: ({ props }) => <MemoryArtifactCard props={props} />,
    WorkspaceProfileChangeCard: ({ props }) => (
      <WorkspaceProfileChangeArtifactCard props={props} />
    ),
    TwitterActionCard: ({ props }) => (
      <TwitterActionArtifactCard props={props} />
    ),
    DmDraftCard: ({ props }) => <DmDraftArtifactCard props={props} />,
    AttachmentPreview: ({ props }) => (
      <InlineAttachmentPreview attachments={props.attachments} />
    ),
  },
});

export interface AgentArtifactRendererProps {
  artifact: AgentArtifactEnvelope;
  onOpenPlanPanel?: (prospectId?: string | null) => void;
  onOpenPostPanel?: (payload: InlinePanelOpenPayload) => void;
  onOpenPanel?: (payload: InlinePanelOpenPayload) => void;
  onApprovePlan?: (planId: string) => void | Promise<void>;
  onDeletePlan?: (planId: string) => void | Promise<void>;
  onOpenWorkspaceProfilePanel?: (requestId: string) => void;
}

export function AgentArtifactRenderer({
  artifact,
  onOpenPlanPanel,
  onOpenPostPanel,
  onOpenPanel,
  onApprovePlan,
  onDeletePlan,
  onOpenWorkspaceProfilePanel,
}: AgentArtifactRendererProps) {
  const resolvedOpenPanel = onOpenPostPanel ?? onOpenPanel;
  const validatedArtifact = React.useMemo(
    () => validateAgentArtifactEnvelope(artifact),
    [artifact]
  );
  const actionContextValue = React.useMemo(
    () => ({
      onOpenPlanPanel,
      onOpenPostPanel: resolvedOpenPanel,
      onOpenPanel: resolvedOpenPanel,
      onApprovePlan,
      onDeletePlan,
      onOpenWorkspaceProfilePanel,
    }),
    [
      onApprovePlan,
      onDeletePlan,
      onOpenPlanPanel,
      onOpenWorkspaceProfilePanel,
      resolvedOpenPanel,
    ]
  );

  if (!validatedArtifact) {
    return null;
  }

  return (
    <AgentArtifactActionContext.Provider value={actionContextValue}>
      <JSONUIProvider registry={registry}>
        <Renderer spec={validatedArtifact.spec} registry={registry} />
      </JSONUIProvider>
    </AgentArtifactActionContext.Provider>
  );
}
