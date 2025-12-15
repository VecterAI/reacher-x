/**
 * WorkspaceReady - Complete state with Find Prospects button
 */

import { memo } from "react";
import { Sparkles, Search } from "lucide-react";
import { Button } from "@/shared/ui/components/Button";

// ============================================================================
// Types
// ============================================================================

interface WorkspaceReadyProps {
  workspaceName: string;
  onStartProspecting: () => void;
  isProcessing?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const WorkspaceReady = memo(function WorkspaceReady({
  workspaceName,
  onStartProspecting,
  isProcessing = false,
  className,
}: WorkspaceReadyProps) {
  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <Sparkles className="text-primary mx-auto mb-3 size-12 opacity-70" />
          <h2 className="mb-1 text-lg font-medium">{workspaceName}</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Your workspace is ready
          </p>
          <Button
            onClick={onStartProspecting}
            disabled={isProcessing}
            className="gap-2"
          >
            <Search className="size-4" />
            {isProcessing ? "Searching..." : "Find Prospects"}
          </Button>
        </div>
      </div>
    </div>
  );
});
