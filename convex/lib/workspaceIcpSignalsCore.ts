import type { Doc } from "../_generated/dataModel";
import { canonicalizeWorkspaceProfileChannels } from "../../shared/lib/workspaceProfileChannels";

export type WorkspaceIcp = NonNullable<Doc<"workspaces">["icps"]>[number];

function normalizeWorkspaceIcpText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeWorkspaceIcpPainPoints(painPoints: string[]): string[] {
  return painPoints
    .flatMap((painPoint) => {
      const normalizedPainPoint = normalizeWorkspaceIcpText(painPoint);
      return normalizedPainPoint ? [normalizedPainPoint] : [];
    })
    .sort();
}

export function buildWorkspaceIcpSemanticKey(
  icp: Pick<WorkspaceIcp, "title" | "description" | "painPoints" | "channels">
): string {
  return JSON.stringify({
    title: normalizeWorkspaceIcpText(icp.title),
    description: normalizeWorkspaceIcpText(icp.description),
    painPoints: normalizeWorkspaceIcpPainPoints(icp.painPoints),
    channels: canonicalizeWorkspaceProfileChannels(icp.channels),
  });
}

export function invalidateWorkspaceIcpGeneratedSignals(
  icps: WorkspaceIcp[]
): WorkspaceIcp[] {
  return icps.map(
    ({
      syntheticPosts: _syntheticPosts,
      qualificationKeywords: _keywords,
      ...icp
    }) => icp
  );
}

export function hasWorkspaceIcpGeneratedSignals(
  icp: Pick<WorkspaceIcp, "syntheticPosts" | "qualificationKeywords">
): boolean {
  return (
    Array.isArray(icp.syntheticPosts) &&
    icp.syntheticPosts.length > 0 &&
    Array.isArray(icp.qualificationKeywords) &&
    icp.qualificationKeywords.length > 0
  );
}

export function hasAnyWorkspaceIcpSyntheticPosts(
  icps: WorkspaceIcp[]
): boolean {
  return icps.some(
    (icp) => Array.isArray(icp.syntheticPosts) && icp.syntheticPosts.length > 0
  );
}

export function listWorkspaceIcpSignalMissingIndices(
  icps: WorkspaceIcp[]
): number[] {
  const missingIndices: number[] = [];

  icps.forEach((icp, index) => {
    if (!hasWorkspaceIcpGeneratedSignals(icp)) {
      missingIndices.push(index);
    }
  });

  return missingIndices;
}

function buildWorkspaceIcpMatchQueues(icps: WorkspaceIcp[]) {
  const queues = new Map<string, WorkspaceIcp[]>();

  for (const icp of icps) {
    const key = buildWorkspaceIcpSemanticKey(icp);
    const currentQueue = queues.get(key) ?? [];
    currentQueue.push(icp);
    queues.set(key, currentQueue);
  }

  return queues;
}

export function restoreWorkspaceIcpSignalsFromReference(args: {
  icps: WorkspaceIcp[];
  referenceIcps: WorkspaceIcp[];
  excludedIndices?: number[];
}): {
  nextIcps: WorkspaceIcp[];
  restoredIndices: number[];
} {
  const referenceQueues = buildWorkspaceIcpMatchQueues(args.referenceIcps);
  const excludedIndices = new Set(args.excludedIndices ?? []);
  const restoredIndices: number[] = [];

  const nextIcps = args.icps.map((icp, index) => {
    if (excludedIndices.has(index) || hasWorkspaceIcpGeneratedSignals(icp)) {
      return icp;
    }

    const key = buildWorkspaceIcpSemanticKey(icp);
    const queue = referenceQueues.get(key);
    const matchedReference = queue?.shift();

    if (
      !matchedReference ||
      !hasWorkspaceIcpGeneratedSignals(matchedReference)
    ) {
      return icp;
    }

    restoredIndices.push(index);
    return {
      ...icp,
      syntheticPosts: matchedReference.syntheticPosts,
      qualificationKeywords: matchedReference.qualificationKeywords,
    };
  });

  return {
    nextIcps,
    restoredIndices,
  };
}

export function reconcileWorkspaceIcpUpdate(args: {
  existingIcps: WorkspaceIcp[];
  incomingIcps: WorkspaceIcp[];
}): {
  nextIcps: WorkspaceIcp[];
  regenerationIndices: number[];
  allSyntheticPostsMissing: boolean;
} {
  const exactMatchQueues = buildWorkspaceIcpMatchQueues(args.existingIcps);
  const regenerationIndexSet = new Set<number>();

  const nextIcps = args.incomingIcps.map((incomingIcp, index) => {
    const key = buildWorkspaceIcpSemanticKey(incomingIcp);
    const exactMatchQueue = exactMatchQueues.get(key);
    const exactMatch = exactMatchQueue?.shift();

    if (exactMatch) {
      const mergedIcp: WorkspaceIcp = {
        ...incomingIcp,
        syntheticPosts: exactMatch.syntheticPosts,
        qualificationKeywords: exactMatch.qualificationKeywords,
      };

      if (!hasWorkspaceIcpGeneratedSignals(mergedIcp)) {
        regenerationIndexSet.add(index);
      }

      return mergedIcp;
    }

    regenerationIndexSet.add(index);
    const [invalidatedIcp] = invalidateWorkspaceIcpGeneratedSignals([
      incomingIcp,
    ]);
    return invalidatedIcp!;
  });

  return {
    nextIcps,
    regenerationIndices: Array.from(regenerationIndexSet).sort((a, b) => a - b),
    allSyntheticPostsMissing: !hasAnyWorkspaceIcpSyntheticPosts(nextIcps),
  };
}

export function summarizeWorkspaceIcpSignalRefresh(args: {
  icps: WorkspaceIcp[];
  failedIndices: number[];
}): {
  success: boolean;
  shouldClearSystemIssue: boolean;
  missingIndices: number[];
} {
  const missingIndices = listWorkspaceIcpSignalMissingIndices(args.icps);
  const success =
    args.failedIndices.length === 0 && missingIndices.length === 0;

  return {
    success,
    shouldClearSystemIssue: success,
    missingIndices,
  };
}
