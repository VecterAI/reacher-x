/**
 * ThinkingIndicator - Loading state for chat operations
 */

import { memo } from "react";
import { Loader } from "@/shared/ui/components/Loader";

// ============================================================================
// Types
// ============================================================================

interface ThinkingIndicatorProps {
  label: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export const ThinkingIndicator = memo(function ThinkingIndicator({
  label,
  className,
}: ThinkingIndicatorProps) {
  return (
    <div className={`flex justify-center pt-4 ${className ?? ""}`}>
      <div className="text-muted-foreground flex items-center gap-2">
        <Loader variant="dots" size="sm" />
        <span>{label}</span>
      </div>
    </div>
  );
});
