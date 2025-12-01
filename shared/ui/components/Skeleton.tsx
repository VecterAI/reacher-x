import { cn } from "@/shared/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse-fast rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
