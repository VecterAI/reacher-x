"use client";

import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/Tabs";

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
    <div className="card-fade-bottom space-y-0">
      <p className="mb-2.5 block text-sm font-medium">{label}</p>
      <Skeleton className={inputClassName} />
      {helperWidthClassName ? (
        <Skeleton className={`mt-1.5 h-3 ${helperWidthClassName}`} />
      ) : null}
    </div>
  );
}

export function WorkspacePageSkeleton() {
  return (
    <Tabs value="details" className="flex min-h-0 flex-1 flex-col">
      <div className="border-border shrink-0 border-b">
        <div className="scrollbar-none scroll-fade-effect-x overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
          <TabsList variant="underline">
            <TabsTrigger value="details" variant="underline" disabled>
              Details
            </TabsTrigger>
            <TabsTrigger value="profiles" variant="underline" disabled>
              Profiles
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="scroll-fade-effect-y min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24">
        <div className="space-y-4" role="status" aria-label="Loading workspace">
          <WorkspaceFieldSkeleton
            label="Who to find/reach"
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
    </Tabs>
  );
}
