import { Button } from "@/shared/ui/components/Button";
import { RefreshIcon } from "@/shared/ui/components/icons";
import { Spinner } from "@/shared/ui/components/Spinner";

interface MediaRetryButtonProps {
  label: string;
  isRetrying?: boolean;
  onRetry: () => void;
}

export function MediaRetryButton({
  label,
  isRetrying = false,
  onRetry,
}: MediaRetryButtonProps) {
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      className="shrink-0"
      onClick={onRetry}
      disabled={isRetrying}
      aria-busy={isRetrying}
      aria-label={`Retry loading ${label}`}
    >
      {isRetrying ? (
        <Spinner variant="circle" className="size-3" />
      ) : (
        <RefreshIcon className="size-3 fill-current" aria-hidden="true" />
      )}
      Retry
    </Button>
  );
}
