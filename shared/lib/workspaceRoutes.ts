import {
  getWorkspaceUseCase,
  workspaceUseCaseRegistry,
  WORKSPACE_USE_CASE_KEYS,
  type WorkspaceUseCaseKey,
} from "./workspaceUseCases";

type WorkspaceRouteSlugKind = "entity" | "success";

type WorkspaceRouteRecord = {
  kind: WorkspaceRouteSlugKind;
  useCaseKey: WorkspaceUseCaseKey;
};

export type WorkspaceRoutes = {
  listHref: "/";
  entitySlug: string;
  successSlug: string;
  entityHref: string;
  successHref: string;
  archivesHref: "/archives";
  analyticsHref: "/analytics";
  notificationsHref: "/notifications";
  detailHref: (id: string) => string;
};

const RESERVED_WEBAPP_ROUTE_SEGMENTS = new Set([
  "agent",
  "agent-ops",
  "analytics",
  "archives",
  "callback",
  "home",
  "login",
  "logout",
  "notifications",
  "post",
  "settings",
  "success",
  "workspace",
]);

const workspaceSlugRegistry = new Map<string, WorkspaceRouteRecord>();
const entitySlugToUseCaseKey = new Map<string, WorkspaceUseCaseKey>();
const successSlugToUseCaseKey = new Map<string, WorkspaceUseCaseKey>();

function registerWorkspaceSlug(
  slug: string,
  kind: WorkspaceRouteSlugKind,
  useCaseKey: WorkspaceUseCaseKey
) {
  if (RESERVED_WEBAPP_ROUTE_SEGMENTS.has(slug)) {
    throw new Error(
      `[workspaceRoutes] Route slug "${slug}" for "${useCaseKey}" collides with a reserved app route.`
    );
  }

  const existing = workspaceSlugRegistry.get(slug);
  if (existing) {
    throw new Error(
      `[workspaceRoutes] Route slug "${slug}" for "${useCaseKey}" collides with "${existing.useCaseKey}".`
    );
  }

  workspaceSlugRegistry.set(slug, { kind, useCaseKey });

  if (kind === "entity") {
    entitySlugToUseCaseKey.set(slug, useCaseKey);
    return;
  }

  successSlugToUseCaseKey.set(slug, useCaseKey);
}

for (const useCaseKey of WORKSPACE_USE_CASE_KEYS) {
  const useCase = workspaceUseCaseRegistry[useCaseKey];
  registerWorkspaceSlug(useCase.routeSlugs.entity, "entity", useCaseKey);
  registerWorkspaceSlug(useCase.routeSlugs.success, "success", useCaseKey);
}

export const WORKSPACE_DYNAMIC_ROUTE_STATIC_PARAMS = Array.from(
  workspaceSlugRegistry.keys(),
  (slug) => ({ slug })
).sort((left, right) => left.slug.localeCompare(right.slug));

export function getWorkspaceRoutes(value: unknown): WorkspaceRoutes {
  const useCase = getWorkspaceUseCase(value);
  const { entity, success } = useCase.routeSlugs;

  return {
    listHref: "/",
    entitySlug: entity,
    successSlug: success,
    entityHref: `/${entity}`,
    successHref: `/${success}`,
    archivesHref: "/archives",
    analyticsHref: "/analytics",
    notificationsHref: "/notifications",
    detailHref: (id: string) => `/${entity}/${id}`,
  };
}

export function isWorkspaceDynamicRouteSlug(value: string): boolean {
  return workspaceSlugRegistry.has(value);
}

export function isWorkspaceEntityRouteSlug(value: string): boolean {
  return entitySlugToUseCaseKey.has(value);
}

export function isWorkspaceSuccessRouteSlug(value: string): boolean {
  return successSlugToUseCaseKey.has(value);
}

export function getWorkspaceUseCaseKeyForEntitySlug(
  value: string
): WorkspaceUseCaseKey | null {
  return entitySlugToUseCaseKey.get(value) ?? null;
}

export function getWorkspaceUseCaseKeyForSuccessSlug(
  value: string
): WorkspaceUseCaseKey | null {
  return successSlugToUseCaseKey.get(value) ?? null;
}
