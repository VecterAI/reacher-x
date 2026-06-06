"use client";

import * as React from "react";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { InlinePanelOpenPayload } from "@/features/agent/lib";
import { InlinePostListCard } from "@/features/agent/ui/components/InlinePostListCard";
import { InlinePanelTriggerCard } from "@/features/agent/ui/components/InlinePanelTriggerCard";
import { InlineProfilePreviewCard } from "@/features/agent/ui/components/InlineProfilePreviewCard";
import { InlineProspectProfileCard } from "@/features/agent/ui/components/InlineProspectProfileCard";
import { InlineReplyApprovalCard } from "@/features/agent/ui/components/InlineReplyApprovalCard";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { PostCard } from "@/features/agent/ui/components/PostCard";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { api } from "@/convex/_generated/api";
import {
  OutreachPlanCard,
  type OutreachPlanCardTask,
} from "@/features/prospects/ui/components/outreach-plan";
import { InlineDmPreviewCard } from "@/features/agent/ui/components/InlineDmPreviewCard";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { ChangeHistoryIcon, OpenInNewIcon } from "@/shared/ui/components/icons";
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

interface AgentArtifactActionContextValue {
  onOpenPlanPanel?: () => void;
  onOpenPostPanel?: (payload: InlinePanelOpenPayload) => void;
  onOpenPanel?: (payload: InlinePanelOpenPayload) => void;
  onApprovePlan?: (planId: string) => void | Promise<void>;
}

const AgentArtifactActionContext =
  React.createContext<AgentArtifactActionContextValue>({});

function useAgentArtifactActions() {
  return React.useContext(AgentArtifactActionContext);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
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
  const getStatusIcon = (status: AgentArtifactProgressStep["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Circle className="text-muted-foreground h-4 w-4" />;
    }
  };

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      {props.title && <p className="text-sm font-medium">{props.title}</p>}

      {props.progress.length > 0 && (
        <div className="space-y-2">
          {props.progress.map((step, index) => (
            <div
              key={`${step.step}-${index}`}
              className="flex items-start gap-2"
            >
              <div className="mt-0.5 shrink-0">
                {getStatusIcon(step.status)}
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

  if (props.interactive !== false && onOpenPanel) {
    return (
      <InlinePanelTriggerCard
        platform={props.platform}
        postData={props.postData ?? undefined}
        postRef={postRef}
        postSummary={postSummary}
        context={props.context ?? undefined}
        panelMode={props.panelMode ?? undefined}
        onOpenPanel={() => {
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
        }}
      />
    );
  }

  return (
    <PostCard
      platform={props.platform}
      postData={props.postData ?? undefined}
      postRef={postRef}
      postSummary={postSummary}
      context={props.context ?? undefined}
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
    status: string;
    rationale: string;
    tasks: AgentArtifactTask[];
  };
}) {
  const { onOpenPlanPanel, onApprovePlan } = useAgentArtifactActions();

  return (
    <OutreachPlanCard
      variant="preview"
      status={props.status}
      rationale={props.rationale}
      tasks={props.tasks as OutreachPlanCardTask[]}
      onApprove={
        props.status === "draft" && props.planId && onApprovePlan
          ? () => {
              void onApprovePlan(props.planId!);
            }
          : undefined
      }
      footerAction={
        onOpenPlanPanel
          ? {
              label: "Show plan",
              onClick: onOpenPlanPanel,
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
  const href = `/agent-ops?tab=memory&memoryId=${encodeURIComponent(
    props.memoryId
  )}`;

  return (
    <InlineFeatureStrip
      leading={
        <>
          <div className="border-border rounded-md border p-1">
            <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
          </div>
          <span className="truncate text-sm font-medium">{props.title}</span>
        </>
      }
      trailing={
        <Button
          type="button"
          variant="outline"
          size="xsIcon"
          aria-label="Open memory in Agent Ops"
          title="Open in Agent Ops"
          onClick={() => router.push(href)}
        >
          <OpenInNewIcon className="fill-current" />
        </Button>
      }
    />
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
  const platform = props.platform ?? "twitter";

  if (platform === "linkedin") {
    return (
      <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{props.title}</p>
          {props.message ? (
            <p className="text-muted-foreground text-xs">{props.message}</p>
          ) : null}
          {props.draftContent ? (
            <p className="bg-background/80 rounded-md border px-2 py-1 text-xs whitespace-pre-wrap">
              {props.draftContent}
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
                {props.status === "completed"
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
                  draftText: props.draftContent ?? undefined,
                });
              }}
            >
              {props.status === "completed" ? "Open result" : "Review"}
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
          draftText: props.draftContent ?? undefined,
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
        "Connect X/Twitter with DM access to message this prospect.");

  const reviewButtonLabel =
    props.status === "completed" ? "Open result" : "Review";
  const showInlineApprove =
    props.status === "pending_approval" &&
    !!props.actionRequestId &&
    !canReviewInPanel;

  if (
    isReplyAction &&
    (props.status === "pending_approval" || props.status === "completed")
  ) {
    return (
      <InlineReplyApprovalCard
        status={props.status}
        draftContent={liveDraftContent}
        mediaUrls={livePanelData?.mediaUrls ?? []}
        mediaDescriptions={livePanelData?.mediaDescriptions ?? []}
        mediaKinds={livePanelData?.mediaKinds ?? []}
        sourcePostRef={sourcePostRef}
        sourcePostSummary={sourcePostSummary}
        sourceContext={sourceContext ?? undefined}
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
                  panelMode:
                    props.status === "completed" ? "posted" : "approval",
                  targetTweetId: props.targetTweetId ?? undefined,
                  actionRequestId: props.actionRequestId ?? undefined,
                });
              }
            : undefined
        }
        onApprove={
          props.status === "pending_approval" && props.actionRequestId
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
          props.status === "pending_approval" && props.actionRequestId
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
        {liveDraftContent && props.status === "pending_approval" && (
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
              {props.status === "pending_approval"
                ? "Input required →"
                : props.status === "completed"
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
                        props.status === "completed" ? "posted" : "approval",
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
                        props.status === "completed" ? "posted" : "approval",
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
    MemoryCard: ({ props }) => <MemoryArtifactCard props={props} />,
    TwitterActionCard: ({ props }) => (
      <TwitterActionArtifactCard props={props} />
    ),
    DmDraftCard: ({ props }) => <DmDraftArtifactCard props={props} />,
  },
});

export interface AgentArtifactRendererProps {
  artifact: AgentArtifactEnvelope;
  onOpenPlanPanel?: () => void;
  onOpenPostPanel?: (payload: InlinePanelOpenPayload) => void;
  onOpenPanel?: (payload: InlinePanelOpenPayload) => void;
  onApprovePlan?: (planId: string) => void | Promise<void>;
}

export function AgentArtifactRenderer({
  artifact,
  onOpenPlanPanel,
  onOpenPostPanel,
  onOpenPanel,
  onApprovePlan,
}: AgentArtifactRendererProps) {
  const resolvedOpenPanel = onOpenPostPanel ?? onOpenPanel;
  const validatedArtifact = React.useMemo(
    () => validateAgentArtifactEnvelope(artifact),
    [artifact]
  );

  if (!validatedArtifact) {
    return null;
  }

  return (
    <AgentArtifactActionContext.Provider
      value={{
        onOpenPlanPanel,
        onOpenPostPanel: resolvedOpenPanel,
        onOpenPanel: resolvedOpenPanel,
        onApprovePlan,
      }}
    >
      <JSONUIProvider registry={registry}>
        <Renderer spec={validatedArtifact.spec} registry={registry} />
      </JSONUIProvider>
    </AgentArtifactActionContext.Provider>
  );
}
