"use client";

import * as React from "react";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import type { InlinePanelOpenPayload } from "@/features/agent/lib";
import { InlinePanelTriggerCard } from "@/features/agent/ui/components/InlinePanelTriggerCard";
import { OnboardingProgressCard } from "@/features/agent/ui/components/OnboardingProgressCard";
import { PostCard } from "@/features/agent/ui/components/PostCard";
import {
  OutreachPlanCard,
  type OutreachPlanCardTask,
} from "@/features/prospects/ui/components/outreach-plan";
import { cn } from "@/shared/lib/utils";
import {
  agentArtifactCatalog,
  type AgentArtifactEnvelope,
  type AgentArtifactProgressStep,
  type AgentArtifactTask,
  validateAgentArtifactEnvelope,
} from "@/shared/lib/json-render/agentArtifacts";

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
    postData: unknown;
    context?: string | null;
    taskId?: string | null;
    taskStatus?: string | null;
    panelMode?: "approval" | "posted" | null;
    targetTweetId?: string | null;
    interactive?: boolean | null;
  };
}) {
  const { onOpenPostPanel } = useAgentArtifactActions();

  if (props.interactive !== false && onOpenPostPanel) {
    return (
      <InlinePanelTriggerCard
        platform={props.platform}
        postData={props.postData}
        context={props.context ?? undefined}
        panelMode={props.panelMode ?? undefined}
        onOpenPanel={() => {
          onOpenPostPanel({
            platform: props.platform,
            postData: props.postData,
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
      postData={props.postData}
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

const { registry } = defineRegistry(agentArtifactCatalog, {
  components: {
    OnboardingCard: ({ props }) => (
      <OnboardingProgressCard workspaceId={props.workspaceId} />
    ),
    ProgressStatusCard: ({ props }) => <ProgressStatusCard props={props} />,
    PostArtifact: ({ props }) => <PostArtifactCard props={props} />,
    PlanPreviewCard: ({ props }) => <PlanPreviewArtifactCard props={props} />,
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
