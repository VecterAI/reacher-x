"use client";

import { useCallback, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useSetupThreadDraft } from "@/shared/hooks";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import { Progress } from "@/shared/ui/components/Progress";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import {
  PageHeader,
  DESKTOP_PANEL_BORDER_CLASS_NAME,
} from "@/features/webapp/ui/components";
import { ConnectionsStep } from "./onboarding/ConnectionsStep";
import { PlanStep } from "./onboarding/PlanStep";
import { SetupExampleProfiles } from "./onboarding/SetupExampleProfiles";

export function AgentOnboardingPanel({
  className,
  threadId,
  onClose,
  approvalDisabled = false,
}: {
  approvalDisabled?: boolean;
  className?: string;
  threadId?: string | null;
  onClose?: () => void;
}) {
  const { setupDraft: session, isLoading } = useSetupThreadDraft(threadId);
  const approve = useMutation(api.setupSessions.approveSetupGeneration);
  const startCheckout = useAction(api.billing.startCheckoutFlow);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const labels = getWorkspaceUseCase(session?.useCaseKey);
  const step = session?.currentStepId ?? "input";
  const review = session?.status === "awaiting_icp_confirmation";
  const handleApprove = useCallback(async () => {
    if (!session || isApproving || approvalDisabled) return;
    setIsApproving(true);
    setApprovalError(null);
    try {
      await approve({
        sessionId: session.sessionId,
        generationRevision: session.generationRevision,
      });
    } catch {
      setApprovalError(
        "Could not continue. Wait for Agent to finish, then try again."
      );
    } finally {
      setIsApproving(false);
    }
  }, [approve, isApproving, session, approvalDisabled]);
  const handleCheckout = useCallback(
    async (
      tier: "hobby" | "base" | "pro",
      billingPeriod: "monthly" | "yearly"
    ) => {
      if (isStartingCheckout) return;
      setIsStartingCheckout(true);
      try {
        const returnUrl = new URL(window.location.href);
        for (const key of ["code", "state", "error", "error_description"])
          returnUrl.searchParams.delete(key);
        const { url } = await startCheckout({
          tier,
          billingPeriod,
          source: "onboarding_plan",
          origin: returnUrl.origin,
          returnTo: `${returnUrl.pathname}${returnUrl.search}`,
          threadId: threadId ?? undefined,
        });
        window.location.assign(url);
      } catch (error) {
        toast.error("Could not start checkout", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setIsStartingCheckout(false);
      }
    },
    [isStartingCheckout, startCheckout, threadId]
  );

  const title =
    step === "connections"
      ? "Connect accounts"
      : step === "plan"
        ? "Choose a plan"
        : `Example ${labels.entityPlural.toLowerCase()}`;
  return (
    <aside
      id="rx-onboarding-panel"
      className={cn(
        "bg-background flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden",
        DESKTOP_PANEL_BORDER_CLASS_NAME,
        className
      )}
    >
      <PageHeader
        title={title}
        onBack={onClose}
        titleSuffix={
          <span className="text-muted-foreground">
            · {session?.currentStepNumber ?? 1}/{session?.totalSteps ?? 3}
          </span>
        }
      />
      <Progress
        value={
          session ? (session.currentStepNumber / session.totalSteps) * 100 : 0
        }
        className="h-0.5 shrink-0 rounded-none"
        indicatorClassName="bg-foreground rounded-none"
      />
      {!threadId || (!isLoading && !session) ? (
        <p className="text-muted-foreground p-4 text-sm">
          Setup draft is unavailable. Reopen setup from the workspace menu.
        </p>
      ) : isLoading || !session ? (
        <div className="p-4">
          <AsciiSpinnerText text="Loading setup..." />
        </div>
      ) : step === "connections" ? (
        <ConnectionsStep
          sessionId={session.sessionId}
          onCompleteStep={() => {}}
        />
      ) : (
        <>
          <ScrollArea className="min-h-0 flex-1">
            {review ? (
              <SetupExampleProfiles
                profiles={session.generatedProfiles}
                useCaseKey={session.useCaseKey}
              />
            ) : step === "plan" ? (
              <div className="px-4 py-4">
                <PlanStep
                  entityPlural={labels.entityPlural}
                  isStartingCheckout={isStartingCheckout}
                  onUpgradePaid={({ tier, billing }) =>
                    void handleCheckout(tier, billing)
                  }
                />
              </div>
            ) : (
              <div className="text-muted-foreground p-4 text-sm">
                {session.status === "generating_profiles" ? (
                  <AsciiSpinnerText
                    text={`Creating example ${labels.entityPlural.toLowerCase()}...`}
                  />
                ) : (
                  "Tell Agent who you want to reach in the chat."
                )}
              </div>
            )}
          </ScrollArea>
          {review ? (
            <footer className="bg-background shrink-0 border-t px-4 py-2">
              {approvalError ? (
                <p role="alert" className="text-destructive mb-2 text-sm">
                  {approvalError}
                </p>
              ) : null}
              <Button
                size="xs"
                className="w-full"
                disabled={isApproving || approvalDisabled}
                onClick={() => void handleApprove()}
              >
                {isApproving ? "Continuing..." : "Continue"}
              </Button>
            </footer>
          ) : null}
        </>
      )}
    </aside>
  );
}
