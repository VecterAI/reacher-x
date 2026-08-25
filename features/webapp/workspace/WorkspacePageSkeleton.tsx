"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { PageContent, PageScrollArea } from "@/features/webapp/ui/components";
import { WORKSPACE_USE_CASE_FIELD_LABEL } from "@/shared/lib/workspaceUseCases";

function WorkspaceFieldSkeleton({
  label,
  inputClassName,
  helperWidthClassName,
}: {
  label: string;
  inputClassName: string;
  helperWidthClassName?: string;
}) {
  return (
    <div className="space-y-0">
      <p className="mb-2.5 block text-sm font-medium">{label}</p>
      <Skeleton className={inputClassName} />
      {helperWidthClassName ? (
        <Skeleton className={`mt-1.5 h-3 ${helperWidthClassName}`} />
      ) : null}
    </div>
  );
}

export function WorkspacePageSkeleton({
  bodyColumnClassName,
}: {
  bodyColumnClassName: string;
}) {
  return (
    <Tabs
      value="details"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="border-border shrink-0 border-b">
        <div className="scroll-fade-x scrollbar-none overflow-x-auto [overflow-y:clip] px-4 [&::-webkit-scrollbar]:hidden">
          <TabsList variant="underline">
            <TabsTrigger value="details" variant="underline" disabled>
              Details
            </TabsTrigger>
            <TabsTrigger value="profiles" variant="underline" disabled>
              Profiles
            </TabsTrigger>
            <TabsTrigger value="agent" variant="underline" disabled>
              Agent
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <PageScrollArea className="pt-4 pb-24">
        <PageContent className={bodyColumnClassName}>
          <div className="px-4">
            <div
              className="space-y-4"
              aria-busy="true"
              aria-live="polite"
              aria-label="Loading workspace"
            >
              <WorkspaceFieldSkeleton
                label={WORKSPACE_USE_CASE_FIELD_LABEL}
                inputClassName="h-10 w-full rounded-md"
              />

              <WorkspaceFieldSkeleton
                label="Name"
                inputClassName="h-10 w-full rounded-md"
              />

              <WorkspaceFieldSkeleton
                label="Description"
                inputClassName="h-40 w-full rounded-md"
                helperWidthClassName="w-44"
              />

              <WorkspaceFieldSkeleton
                label="Agent-generated description"
                inputClassName="h-48 w-full rounded-md"
                helperWidthClassName="w-40"
              />
            </div>
          </div>
        </PageContent>
      </PageScrollArea>
    </Tabs>
  );
}
