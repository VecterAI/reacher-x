import { Button } from "@/shared/ui/components/Button";
import { Badge } from "@/shared/ui/components/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";

interface PlanStepProps {
  canUpgrade: boolean;
  planLabel: string;
  usageSummary: string;
  onBack: () => void;
  onContinue: () => void;
}

export function PlanStep({
  canUpgrade,
  planLabel,
  usageSummary,
  onBack,
  onContinue,
}: PlanStepProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Plan</h2>
        <p className="text-muted-foreground text-sm">
          Review the current workspace plan before you finalize setup.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Current plan</CardTitle>
            <Badge variant="secondary">{planLabel}</Badge>
          </div>
          <CardDescription>{usageSummary}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm">
          <p className="text-muted-foreground">
            Setup uses the current plan by default. You can upgrade later if you
            want more workspace capacity or higher limits.
          </p>
          {canUpgrade ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              asChild={Boolean(process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL)}
            >
              {process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL ? (
                <a
                  href={process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View upgrade options
                </a>
              ) : (
                <span>Upgrade options unavailable</span>
              )}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onContinue}>
          Continue to preference
        </Button>
      </div>
    </section>
  );
}
