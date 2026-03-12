import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { cn } from "@/shared/lib/utils";
import {
  workspaceUseCases,
  type WorkspaceUseCaseKey,
} from "@/shared/lib/workspaceUseCases";

const PREVIEW_STAGE_KEYS = [
  "new",
  "contacted",
  "in_progress",
  "converted",
] as const;

interface UseCaseStepProps {
  activeUseCaseKey: WorkspaceUseCaseKey;
  isSaving: boolean;
  onContinue: () => void;
  onSelectUseCase: (useCaseKey: WorkspaceUseCaseKey) => void;
}

export function UseCaseStep({
  activeUseCaseKey,
  isSaving,
  onContinue,
  onSelectUseCase,
}: UseCaseStepProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Pick a workspace use case</h2>
        <p className="text-muted-foreground text-sm">
          This controls the vocabulary, onboarding copy, and the success labels
          the product uses for this workspace.
        </p>
      </div>

      <div className="grid gap-3">
        {workspaceUseCases.map((useCase) => {
          const isActive = useCase.key === activeUseCaseKey;

          return (
            <button
              key={useCase.key}
              type="button"
              className="text-left"
              onClick={() => onSelectUseCase(useCase.key)}
            >
              <Card
                className={cn(
                  "transition-colors",
                  isActive && "border-primary bg-primary/5"
                )}
              >
                <CardHeader className="space-y-2 p-4 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {useCase.displayName}
                    </CardTitle>
                    {useCase.key === "customer_prospecting" && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                    {isActive && <Badge>Selected</Badge>}
                  </div>
                  <CardDescription>{useCase.shortDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs tracking-wide uppercase">
                        Targets
                      </p>
                      <p className="mt-1 font-medium">{useCase.entityPlural}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs tracking-wide uppercase">
                        Success
                      </p>
                      <p className="mt-1 font-medium">
                        {useCase.pageLabels.converts}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs tracking-wide uppercase">
                      Stage labels
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PREVIEW_STAGE_KEYS.map((stageKey) => (
                        <Badge key={stageKey} variant="outline">
                          {useCase.stageLabels[stageKey]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={onContinue}
        disabled={isSaving}
      >
        Continue to workspace input
      </Button>
    </section>
  );
}
