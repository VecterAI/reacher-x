"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getPlansUpgradeHref } from "@/features/billing/lib/plansUpgradeUrl";

import { Button } from "@/shared/ui/components/Button";
import { CloseIcon } from "@/shared/ui/components/icons";
import { WorkspaceUsagePercentage } from "./WorkspaceUsageRing";
import {
  useWorkspacePlanUsage,
  type WorkspacePlanUsage,
} from "./WorkspacePlanUsageProvider";

export function WorkspacePlanLimitNotice({
  usage,
  onDismiss,
  dismissing = false,
  error,
}: {
  usage: WorkspacePlanUsage;
  onDismiss: () => void;
  dismissing?: boolean;
  error?: string;
}) {
  const requiresPlan = usage.tier === "free";
  return (
    <aside
      aria-label="Plan usage notice"
      className="bg-muted/20 relative shrink-0 border-b px-4 py-3 pr-12 sm:py-2"
    >
      <div className="flex items-start gap-3 sm:items-center sm:gap-2">
        <WorkspaceUsagePercentage usage={usage} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          <p className="font-pixel-square text-sm font-medium text-pretty sm:flex-1 sm:basis-60">
            {requiresPlan
              ? `Choose a plan to start ${usage.discoveryVerb} ${usage.entityPlural.toLowerCase()}.`
              : `This workspace has reached its plan limit for ${usage.entityPlural.toLowerCase()} this cycle.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="xs">
              <Link href={getPlansUpgradeHref()}>Upgrade plan</Link>
            </Button>
            <Button asChild size="xs" variant="ghost">
              <Link href="/usage">View usage</Link>
            </Button>
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {error}
        </p>
      ) : null}
      <Button
        variant="ghost"
        size="xsIcon"
        className="absolute top-2 right-3"
        aria-label="Dismiss plan usage notice"
        disabled={dismissing}
        onClick={onDismiss}
      >
        <CloseIcon className="size-4 fill-current" />
      </Button>
    </aside>
  );
}

export function WorkspacePlanLimitAlert() {
  const { usage } = useWorkspacePlanUsage();
  const dismissNotice = useMutation(api.workspacePlanUsage.dismissNotice);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null
  );
  if (
    !usage ||
    usage.noticeDismissed ||
    (usage.tier !== "free" && !usage.limitReached)
  )
    return null;
  const key = `${usage.workspaceId}:${usage.noticeKey}`;
  async function dismiss() {
    if (!usage) return;
    setDismissing(true);
    setError(null);
    try {
      await dismissNotice({
        workspaceId: usage.workspaceId,
        noticeKey: usage.noticeKey,
      });
    } catch {
      setError({ key, message: "Couldn't dismiss this notice. Try again." });
    } finally {
      setDismissing(false);
    }
  }
  return (
    <WorkspacePlanLimitNotice
      usage={usage}
      onDismiss={() => void dismiss()}
      dismissing={dismissing}
      error={error?.key === key ? error.message : undefined}
    />
  );
}
