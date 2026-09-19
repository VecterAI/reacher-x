import { isBlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import {
  getReacherXBlogSlug,
  isReacherXUrl,
} from "@/convex/lib/webResearchCore";
import {
  createBlogCardArtifact,
  createBlogDemoArtifact,
  getAgentArtifactFromResult,
  getAgentArtifactSemanticKey,
  validateAgentArtifactEnvelope,
  type AgentArtifactEnvelope,
} from "@/shared/lib/json-render/agentArtifacts";

interface ArtifactBearingToolCall {
  toolName?: string;
  toolCallId?: string;
  args?: unknown;
  result?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToolResult(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return normalizeToolResult(JSON.parse(value));
    } catch {
      return value;
    }
  }

  if (!isRecord(value) || !("type" in value) || !("value" in value)) {
    return value;
  }

  if (value.type === "json") {
    return normalizeToolResult(value.value);
  }

  if (value.type === "text" && typeof value.value === "string") {
    return normalizeToolResult(value.value);
  }

  return value;
}

function getHistoricalWebResearchArtifact(
  result: unknown,
  input: unknown
): AgentArtifactEnvelope | null {
  const normalizedResult = normalizeToolResult(result);
  if (!isRecord(normalizedResult) || normalizedResult.success !== true) {
    return null;
  }

  if (!isRecord(input) || input.operation !== "show") {
    return null;
  }

  const sourceUrl = input.sourceUrl;
  if (typeof sourceUrl !== "string" || !isReacherXUrl(sourceUrl)) {
    return null;
  }

  if (input.resourceType === "article") {
    const slug = input.slug;
    if (
      typeof slug !== "string" ||
      getReacherXBlogSlug(sourceUrl) !== slug.toLowerCase()
    ) {
      return null;
    }

    return (
      createBlogCardArtifact({
        slug: slug.toLowerCase(),
        title: typeof input.title === "string" ? input.title : undefined,
        description:
          typeof input.description === "string" ? input.description : undefined,
        sourceUrl,
      }) ?? null
    );
  }

  if (input.resourceType === "demo") {
    const demoId = input.demoId;
    if (typeof demoId !== "string" || !isBlogDemoId(demoId)) {
      return null;
    }

    const sceneRange = Array.isArray(input.sceneRange)
      ? input.sceneRange.length === 2 &&
        input.sceneRange.every((value) => typeof value === "number")
        ? ([input.sceneRange[0], input.sceneRange[1]] as [number, number])
        : undefined
      : undefined;

    return (
      createBlogDemoArtifact({
        scenario: demoId,
        title:
          typeof input.title === "string"
            ? input.title
            : "Interactive walkthrough",
        caption:
          typeof input.caption === "string"
            ? input.caption
            : "Explore this workflow in ReacherX.",
        sceneRange,
        sourceUrl,
      }) ?? null
    );
  }

  return null;
}

function getLegacyPlanSemanticKey(result: unknown): string | null {
  if (!isRecord(result) || !isRecord(result.plan)) {
    return null;
  }

  const planId = result.plan.id;
  return typeof planId === "string" && planId.length > 0
    ? `PlanPreviewCard:${planId}`
    : null;
}

export function getAgentArtifactsFromToolResult(
  result: unknown,
  input?: unknown
): AgentArtifactEnvelope[] {
  const normalizedResult = normalizeToolResult(result);
  if (!isRecord(normalizedResult)) {
    return [];
  }

  const candidates = Array.isArray(normalizedResult.artifacts)
    ? normalizedResult.artifacts
    : [];
  const directArtifact = getAgentArtifactFromResult(normalizedResult);
  const historicalWebResearchArtifact = getHistoricalWebResearchArtifact(
    normalizedResult,
    input
  );
  const validatedArtifacts = [
    ...candidates
      .map((candidate) => validateAgentArtifactEnvelope(candidate))
      .filter(
        (artifact): artifact is AgentArtifactEnvelope => artifact !== null
      ),
    ...(directArtifact ? [directArtifact] : []),
    ...(historicalWebResearchArtifact ? [historicalWebResearchArtifact] : []),
  ];
  const seenSemanticKeys = new Set<string>();

  return validatedArtifacts.filter((artifact) => {
    const semanticKey = getAgentArtifactSemanticKey(artifact);
    if (!semanticKey) {
      return true;
    }
    if (seenSemanticKeys.has(semanticKey)) {
      return false;
    }
    seenSemanticKeys.add(semanticKey);
    return true;
  });
}

export function getToolResultArtifactSemanticKeys(
  result: unknown,
  input?: unknown
): string[] {
  const keys = getAgentArtifactsFromToolResult(result, input)
    .map((artifact) => getAgentArtifactSemanticKey(artifact))
    .filter((key): key is string => key !== null);
  const legacyPlanKey = getLegacyPlanSemanticKey(result);

  return [...new Set(legacyPlanKey ? [...keys, legacyPlanKey] : keys)];
}

export function getSupersededArtifactKeysByToolCallId(
  toolCalls: readonly ArtifactBearingToolCall[]
): ReadonlyMap<string, ReadonlySet<string>> {
  const lastToolIndexBySemanticKey = new Map<string, number>();

  toolCalls.forEach((toolCall, index) => {
    for (const semanticKey of getToolResultArtifactSemanticKeys(
      toolCall.result,
      toolCall.args
    )) {
      lastToolIndexBySemanticKey.set(semanticKey, index);
    }
  });

  const supersededKeysByToolCallId = new Map<string, ReadonlySet<string>>();

  toolCalls.forEach((toolCall, index) => {
    if (!toolCall.toolCallId) {
      return;
    }

    const supersededKeys = getToolResultArtifactSemanticKeys(
      toolCall.result,
      toolCall.args
    ).filter(
      (semanticKey) =>
        (lastToolIndexBySemanticKey.get(semanticKey) ?? index) > index
    );

    if (supersededKeys.length > 0) {
      supersededKeysByToolCallId.set(
        toolCall.toolCallId,
        new Set(supersededKeys)
      );
    }
  });

  return supersededKeysByToolCallId;
}
