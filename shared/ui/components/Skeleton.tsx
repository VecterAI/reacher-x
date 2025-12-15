import { cn } from "@/shared/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse-fast bg-muted rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
