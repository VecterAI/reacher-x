import { cn } from "@/shared/lib/utils";
import { InlineCode } from "@/shared/ui/components/InlineCode";

interface LandingAgentMarkProps {
  className?: string;
}

/**
 * Solid △ badge for display type — same treatment as `/home` hero.
 */
export function LandingAgentMark({ className }: LandingAgentMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-primary text-primary-foreground relative top-[0.03em] inline-flex size-[1.12em] shrink-0 items-center justify-center rounded-[0.26em] border border-transparent align-middle font-mono text-[0.78em] leading-none font-medium tracking-normal shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]",
        className
      )}
    >
      △
    </span>
  );
}

/**
 * Body "△ Agent" — same mark treatment as in-app outreach copy.
 * Slight lift: `align-middle` sits low next to capitals in larger body text.
 */
export function AgentInline({ className }: { className?: string }) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <InlineCode
        variant="mark"
        aria-hidden="true"
        className="relative -top-[0.2em]"
      >
        △
      </InlineCode>{" "}
      Agent
    </span>
  );
}
