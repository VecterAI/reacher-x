"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { captureClientErrorMessage } from "@/shared/lib/errors";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  IdealCustomerProfileCard,
  IdealCustomerProfileCardSkeleton,
  IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME,
} from "@/features/prospects/ui/components/ideal-customer-profile";
import { Button } from "@/shared/ui/components/Button";
import { InlineFeatureStrip } from "@/shared/ui/components/InlineFeatureStrip";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { ChangeHistoryIcon, OpenInNewIcon } from "@/shared/ui/components/icons";

function getStatusLabel(status: string) {
  if (status === "applied") return "Changes applied →";
  if (status === "rejected") return "Proposal rejected →";
  if (status === "stale") return "Proposal outdated →";
  return "Input required →";
}

function WorkspaceProfileChangeCardSkeleton() {
  return (
    <div
      className="flex flex-col gap-2"
      aria-label="Loading workspace profile proposal"
    >
      <section className="space-y-3">
        <Skeleton className="h-3 w-36" />
        <div className="flex flex-col gap-3">
          <IdealCustomerProfileCardSkeleton
            className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
          />
        </div>
      </section>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

export function WorkspaceProfileChangeCard({
  requestId,
  onReview,
}: {
  requestId: string;
  onReview?: (requestId: string) => void;
}) {
  const proposal = useQuery(
    api.workspaceProfileChanges.getWorkspaceProfileChange,
    {
      requestId: requestId as Id<"workspaceProfileChangeRequests">,
    }
  );
  const approveProposal = useMutation(
    api.workspaceProfileChanges.approveWorkspaceProfileChange
  );
  const rejectProposal = useMutation(
    api.workspaceProfileChanges.rejectWorkspaceProfileChange
  );
  const [pendingAction, setPendingAction] = React.useState<
    "approve" | "reject" | null
  >(null);

  if (proposal === undefined) {
    return <WorkspaceProfileChangeCardSkeleton />;
  }
  if (!proposal) {
    return null;
  }

  const changedTitles = new Set([
    ...proposal.addedTitles,
    ...proposal.updatedTitles,
  ]);
  const changedProfiles = proposal.proposedProfiles.filter((profile) =>
    changedTitles.has(profile.title)
  );
  const isPending = proposal.status === "pending_approval";
  const canOpenPanel = typeof onReview === "function";
  const label = proposal.profileLabelPlural;

  const handleApprove = async () => {
    try {
      setPendingAction("approve");
      const result = await approveProposal({
        requestId: requestId as Id<"workspaceProfileChangeRequests">,
        expectedRevision: proposal.revision,
      });

      if (result.outcome === "applied") {
        toast.success(`${label} updated`);
        return;
      }
      if (result.outcome === "stale") {
        toast.error("Workspace changed", {
          description: "Ask Agent to prepare a fresh proposal, then try again.",
        });
        return;
      }
      if (result.outcome === "superseded") {
        toast.error("Newer proposal available", {
          description: "Open the proposal again to load the latest one.",
        });
        return;
      }

      toast.error("This proposal is no longer pending.");
    } catch (error) {
      toast.error("Could not approve proposal", {
        description: captureClientErrorMessage(
          error,
          "Please try again.",
          "WorkspaceProfileChangeCard"
        ),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async () => {
    try {
      setPendingAction("reject");
      await rejectProposal({
        requestId: requestId as Id<"workspaceProfileChangeRequests">,
      });
    } catch (error) {
      toast.error("Could not reject proposal", {
        description: captureClientErrorMessage(
          error,
          "Please try again.",
          "WorkspaceProfileChangeCard"
        ),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleOpenPanel = () => {
    onReview?.(requestId);
  };

  return (
    <div className="flex flex-col gap-2">
      <section className="space-y-3" aria-label={label}>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="flex flex-col gap-3">
          {changedProfiles.map((profile) => (
            <IdealCustomerProfileCard
              key={profile.title}
              profile={profile}
              maxPainBadges={2}
              className={IDEAL_CUSTOMER_PROFILE_LIST_CLASS_NAME}
            />
          ))}
        </div>

        {proposal.removedTitles.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            <p className="text-muted-foreground text-xs font-medium">Removed</p>
            <ul className="space-y-1">
              {proposal.removedTitles.map((title) => (
                <li
                  key={title}
                  className="text-muted-foreground truncate px-1 text-sm line-through"
                >
                  {title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <InlineFeatureStrip
        leading={
          <>
            <div className="border-border shrink-0 rounded-md border p-1">
              <ChangeHistoryIcon className="text-foreground size-4 fill-current" />
            </div>
            <span
              className="min-w-0 truncate text-sm font-medium"
              aria-live="polite"
            >
              {getStatusLabel(proposal.status)}
            </span>
          </>
        }
        trailing={
          <>
            {isPending ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={pendingAction !== null}
                onClick={() => void handleReject()}
              >
                {pendingAction === "reject" ? "Rejecting..." : "Reject"}
              </Button>
            ) : null}
            {isPending ? (
              <Button
                type="button"
                size="xs"
                disabled={pendingAction !== null}
                onClick={() => void handleApprove()}
              >
                {pendingAction === "approve" ? "Approving..." : "Approve"}
              </Button>
            ) : null}
            {!isPending && canOpenPanel ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleOpenPanel}
              >
                View
              </Button>
            ) : null}
            {canOpenPanel ? (
              <Button
                type="button"
                size="xsIcon"
                variant="outline"
                aria-label="Open profile proposal"
                disabled={pendingAction !== null}
                onClick={handleOpenPanel}
              >
                <OpenInNewIcon className="fill-current" />
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
