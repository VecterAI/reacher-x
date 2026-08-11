import type {
  MentionEntitySearchResult,
  MentionPostPlatform,
} from "../../shared/lib/mentions/mentionEntities";
import { normalizeMentionEntitySearchResult } from "../../shared/lib/mentions/mentionEntities";

export type AgentThreadRouteKind =
  | "prospect"
  | "workspace"
  | "setup"
  | "unknown";

export type AgentThreadRouteScope = {
  kind: AgentThreadRouteKind;
  workspaceId: string | null;
  prospectId: string | null;
};

export type AgentThreadContextRow = {
  taggedEntities: MentionEntitySearchResult[];
};

/** Durable selection created only by an explicit prospect tag. */
export type AgentThreadPersistentTargetSelection = {
  workspaceId: string;
  prospectIds: string[];
};

export type AgentThreadSelection = {
  workspaceId: string | null;
  prospectId: string | null;
  planId: string | null;
  taskId: string | null;
  postId: string | null;
  postPlatform: MentionPostPlatform | null;
  postUrl: string | null;
  source: "thread" | "tagged" | "none";
  ambiguousProspectIds: string[];
};

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEntityProspectId(entity: MentionEntitySearchResult): string | null {
  if (entity.kind === "prospect") {
    return normalizeId(entity.prospectId ?? entity.entityId);
  }

  if (
    entity.kind === "plan" ||
    entity.kind === "task" ||
    entity.kind === "post"
  ) {
    return normalizeId(entity.prospectId);
  }

  return null;
}

function getEntityWorkspaceId(
  entity: MentionEntitySearchResult
): string | null {
  return normalizeId(entity.workspaceId);
}

function entityMatchesRouteScope(
  entity: MentionEntitySearchResult,
  routeScope: AgentThreadRouteScope
) {
  const entityWorkspaceId = getEntityWorkspaceId(entity);
  if (
    routeScope.workspaceId &&
    entityWorkspaceId &&
    entityWorkspaceId !== routeScope.workspaceId
  ) {
    return false;
  }

  const entityProspectId = getEntityProspectId(entity);
  if (
    routeScope.prospectId &&
    entityProspectId &&
    entityProspectId !== routeScope.prospectId
  ) {
    return false;
  }

  return true;
}

function dedupeIds(values: Array<string | null | undefined>): string[] {
  const normalizedValues = values
    .map((value) => normalizeId(value))
    .filter((value): value is string => Boolean(value));

  return [...new Set(normalizedValues)];
}

function buildThreadSelectionFallback(
  routeScope: AgentThreadRouteScope
): AgentThreadSelection {
  if (!routeScope.workspaceId && !routeScope.prospectId) {
    return {
      workspaceId: null,
      prospectId: null,
      planId: null,
      taskId: null,
      postId: null,
      postPlatform: null,
      postUrl: null,
      source: "none",
      ambiguousProspectIds: [],
    };
  }

  return {
    workspaceId: routeScope.workspaceId,
    prospectId: routeScope.prospectId,
    planId: null,
    taskId: null,
    postId: null,
    postPlatform: null,
    postUrl: null,
    source: "thread",
    ambiguousProspectIds: [],
  };
}

function buildPersistentTargetSelection(args: {
  routeScope: AgentThreadRouteScope;
  persistentTargetSelection?: AgentThreadPersistentTargetSelection | null;
}): AgentThreadSelection | null {
  const persistentTargetSelection = args.persistentTargetSelection;
  if (!persistentTargetSelection || args.routeScope.prospectId) {
    return null;
  }

  const workspaceId = normalizeId(persistentTargetSelection.workspaceId);
  if (
    !workspaceId ||
    (args.routeScope.workspaceId && workspaceId !== args.routeScope.workspaceId)
  ) {
    return null;
  }

  const prospectIds = dedupeIds(persistentTargetSelection.prospectIds);
  if (prospectIds.length === 0) {
    return null;
  }

  if (prospectIds.length > 1) {
    return {
      ...buildThreadSelectionFallback(args.routeScope),
      workspaceId: args.routeScope.workspaceId ?? workspaceId,
      source: "tagged",
      ambiguousProspectIds: prospectIds,
    };
  }

  return {
    workspaceId: args.routeScope.workspaceId ?? workspaceId,
    prospectId: prospectIds[0],
    planId: null,
    taskId: null,
    postId: null,
    postPlatform: null,
    postUrl: null,
    source: "tagged",
    ambiguousProspectIds: [],
  };
}

function pickPrimaryEntity(
  entities: MentionEntitySearchResult[],
  kind: MentionEntitySearchResult["kind"],
  prospectId: string | null
) {
  return entities.find((entity) => {
    if (entity.kind !== kind) {
      return false;
    }

    const entityProspectId = getEntityProspectId(entity);
    if (!prospectId || !entityProspectId) {
      return true;
    }

    return entityProspectId === prospectId;
  });
}

export function resolveAgentThreadSelection(args: {
  routeScope: AgentThreadRouteScope;
  contextRows: AgentThreadContextRow[];
  persistentTargetSelection?: AgentThreadPersistentTargetSelection | null;
}): AgentThreadSelection {
  const persistentSelection = buildPersistentTargetSelection({
    routeScope: args.routeScope,
    persistentTargetSelection: args.persistentTargetSelection,
  });

  for (const [rowIndex, row] of args.contextRows.entries()) {
    const scopedEntities = row.taggedEntities
      .map(normalizeMentionEntitySearchResult)
      .filter((entity): entity is MentionEntitySearchResult => entity !== null)
      .filter((entity) => entityMatchesRouteScope(entity, args.routeScope));

    if (scopedEntities.length === 0) {
      // Context rows are newest-first. An untagged follow-up retains the
      // durable target selected by the latest explicit prospect tag.
      if (rowIndex === 0) {
        return (
          persistentSelection ?? buildThreadSelectionFallback(args.routeScope)
        );
      }
      continue;
    }

    const rowProspectIds = dedupeIds(
      scopedEntities.map((entity) => getEntityProspectId(entity))
    );

    if (!args.routeScope.prospectId && rowProspectIds.length > 1) {
      return {
        ...buildThreadSelectionFallback(args.routeScope),
        source: "tagged",
        ambiguousProspectIds: rowProspectIds,
      };
    }

    const prospectId = args.routeScope.prospectId ?? rowProspectIds[0] ?? null;
    const taskEntity = pickPrimaryEntity(scopedEntities, "task", prospectId);
    const planEntity = pickPrimaryEntity(scopedEntities, "plan", prospectId);
    const postEntity = pickPrimaryEntity(scopedEntities, "post", prospectId);
    const workspaceId =
      args.routeScope.workspaceId ??
      getEntityWorkspaceId(
        taskEntity ?? planEntity ?? postEntity ?? scopedEntities[0]
      );

    if (!prospectId && !taskEntity && !planEntity && !postEntity) {
      continue;
    }

    return {
      workspaceId,
      prospectId,
      planId: normalizeId(planEntity?.planId ?? planEntity?.entityId),
      taskId: normalizeId(taskEntity?.taskId ?? taskEntity?.entityId),
      postId: normalizeId(postEntity?.postId ?? postEntity?.entityId),
      postPlatform: postEntity?.postPlatform ?? null,
      postUrl: normalizeId(postEntity?.postUrl) ?? null,
      source: "tagged",
      ambiguousProspectIds: [],
    };
  }

  return persistentSelection ?? buildThreadSelectionFallback(args.routeScope);
}
