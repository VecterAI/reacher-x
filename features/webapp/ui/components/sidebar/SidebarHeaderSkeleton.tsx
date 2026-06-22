import { SidebarHeader as SidebarHeaderBase } from "@/shared/ui/components/Sidebar";
import { Button } from "@/shared/ui/components/Button";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import {
  FolderIcon,
  KeyboardArrowDownIcon,
} from "@/shared/ui/components/icons";

type SidebarHeaderSkeletonProps = {
  collapsed?: boolean;
};

export function SidebarHeaderSkeleton({
  collapsed,
}: SidebarHeaderSkeletonProps) {
  const showExpanded = collapsed !== true;
  const showCollapsed = collapsed !== false;

  return (
    <SidebarHeaderBase>
      <div className="flex flex-col gap-2">
        {showExpanded ? (
          <div
            className="flex flex-col gap-2"
            data-sidebar-expanded-only={
              collapsed === undefined ? true : undefined
            }
          >
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              disabled
              tabIndex={-1}
              aria-hidden="true"
            >
              <Skeleton className="h-4 w-28 rounded-sm" />
            </Button>

            <div
              className="border-input bg-background text-muted-foreground flex h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-sm"
              aria-hidden="true"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FolderIcon className="h-4 w-4 shrink-0 fill-current" />
                <Skeleton className="h-4 flex-1 rounded-sm" />
              </div>
              <KeyboardArrowDownIcon className="ml-2 h-4 w-4 shrink-0 fill-current opacity-50" />
            </div>
          </div>
        ) : null}

        {showCollapsed ? (
          <div
            className="items-center justify-center"
            data-sidebar-collapsed-only={
              collapsed === undefined ? true : undefined
            }
          >
            <Button
              variant="secondary"
              className="h-8 w-8"
              disabled
              tabIndex={-1}
              aria-hidden="true"
            >
              <Skeleton className="h-4 w-4 rounded-sm" />
            </Button>
          </div>
        ) : null}
      </div>
    </SidebarHeaderBase>
  );
}
