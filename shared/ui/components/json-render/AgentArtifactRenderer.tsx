"use client";

import * as React from "react";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import type { InlinePanelOpenPayload } from "@/features/agent/lib";
import { InlinePanelTriggerCard } from "@/features/agent/ui/components/InlinePanelTriggerCard";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { PostCard } from "@/features/agent/ui/components/PostCard";
import { api } from "@/convex/_generated/api";
import {
  OutreachPlanCard,
  type OutreachPlanCardTask,
} from "@/features/prospects/ui/components/outreach-plan";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
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
  onApprovePlan?: (planId: string) => void | Promise<void>;
}

const AgentArtifactActionContext =
  React.createContext<AgentArtifactActionContextValue>({});

function useAgentArtifactActions() {
  return React.useContext(AgentArtifactActionContext);
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
  const { onOpenPostPanel } = useAgentArtifactActions();
  const postRef = getTwitterPostRef(props.postRef);
  const postSummary = summarizeTwitterPost(props.postSummary ?? props.postData);

  if (props.interactive !== false && onOpenPostPanel) {
    return (
      <InlinePanelTriggerCard
        platform={props.platform}
        postData={props.postData ?? undefined}
        postRef={postRef}
        postSummary={postSummary}
        context={props.context ?? undefined}
        panelMode={props.panelMode ?? undefined}
        onOpenPanel={() => {
          onOpenPostPanel({
            platform: props.platform,
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
      onEdit={onOpenPlanPanel}
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

  const formattedConfidence = props.confidence.toFixed(2);
  const formattedImpact = props.impactScore.toFixed(2);
  const isOperator = props.source === "operator";

  return (
    <div className="bg-muted/40 group flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{props.title}</p>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium capitalize">
            {props.category.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Saved as{" "}
          {isOperator ? "an operator memory" : `${props.source} memory`} for
          this workspace. I&apos;ll use it when qualifying leads and planning
          outreach.
        </p>
        <p className="text-muted-foreground/80 text-[11px]">
          Confidence {formattedConfidence} · Impact {formattedImpact}
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push(href)}
        className="text-muted-foreground hover:text-foreground text-[11px] font-medium whitespace-nowrap underline-offset-2 hover:underline"
      >
        Open in Agent Ops →
      </button>
    </div>
  );
}

function TwitterActionArtifactCard({
  props,
}: {
  props: {
    actionKey: string;
    actionRequestId?: string | null;
    title: string;
    message?: string | null;
    status: string;
    approvalMode?: string | null;
    riskLevel?: string | null;
    targetTweetId?: string | null;
    sourcePostRef?: unknown | null;
    sourcePostSummary?: unknown | null;
    sourceContext?: string | null;
    draftContent?: string | null;
    createdTweetId?: string | null;
    interactive?: boolean | null;
  };
}) {
  const { onOpenPostPanel } = useAgentArtifactActions();
  const approveActionRequest = useMutation(
    api.twitterActions.approveActionRequest
  );
  const [isApproving, setIsApproving] = React.useState(false);
  const sourcePostRef = getTwitterPostRef(props.sourcePostRef);
  const sourcePostSummary = summarizeTwitterPost(props.sourcePostSummary);

  const canReviewInPanel =
    props.interactive !== false &&
    !!onOpenPostPanel &&
    !!sourcePostSummary &&
    !!props.actionRequestId &&
    (props.actionKey === "reply_to_post" ||
      props.status === "pending_approval");

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
        {props.draftContent && props.status === "pending_approval" && (
          <p className="bg-background/80 rounded-md border px-2 py-1 text-xs whitespace-pre-wrap">
            {props.draftContent}
          </p>
        )}
      </div>

      {sourcePostSummary && (
        <PostCard
          platform="twitter"
          postRef={sourcePostRef}
          postSummary={sourcePostSummary}
          context={props.sourceContext ?? undefined}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {canReviewInPanel && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              onOpenPostPanel?.({
                platform: "twitter",
                postRef: sourcePostRef,
                postSummary: sourcePostSummary,
                context: props.sourceContext ?? undefined,
                panelMode: props.status === "completed" ? "posted" : "approval",
                targetTweetId: props.targetTweetId ?? undefined,
                actionRequestId: props.actionRequestId ?? undefined,
              });
            }}
          >
            {props.status === "completed" ? "Open result" : "Review"}
          </Button>
        )}

        {props.status === "pending_approval" &&
          props.actionRequestId &&
          !canReviewInPanel && (
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
          )}
      </div>
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
    PlanPreviewCard: ({ props }) => <PlanPreviewArtifactCard props={props} />,
    MemoryCard: ({ props }) => <MemoryArtifactCard props={props} />,
    TwitterActionCard: ({ props }) => (
      <TwitterActionArtifactCard props={props} />
    ),
  },
});

export interface AgentArtifactRendererProps {
  artifact: AgentArtifactEnvelope;
  onOpenPlanPanel?: () => void;
  onOpenPostPanel?: (payload: InlinePanelOpenPayload) => void;
  onApprovePlan?: (planId: string) => void | Promise<void>;
}

export function AgentArtifactRenderer({
  artifact,
  onOpenPlanPanel,
  onOpenPostPanel,
  onApprovePlan,
}: AgentArtifactRendererProps) {
  const validatedArtifact = React.useMemo(
    () => validateAgentArtifactEnvelope(artifact),
    [artifact]
  );

  if (!validatedArtifact) {
    return null;
  }

  return (
    <AgentArtifactActionContext.Provider
      value={{ onOpenPlanPanel, onOpenPostPanel, onApprovePlan }}
    >
      <JSONUIProvider registry={registry}>
        <Renderer spec={validatedArtifact.spec} registry={registry} />
      </JSONUIProvider>
    </AgentArtifactActionContext.Provider>
  );
}
