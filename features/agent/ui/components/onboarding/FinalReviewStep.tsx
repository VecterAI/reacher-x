import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { Input } from "@/shared/ui/components/Input";
import { workspaceNameSchema } from "@/shared/lib/schemas/validation";
import type { WorkspaceUseCaseDefinition } from "@/shared/lib/workspaceUseCases";
import type {
  SetupGeneratedResult,
  SetupInputMode,
} from "@/features/agent/lib/setupOnboarding";
import type { OnboardingPreference } from "./PreferenceStep";

interface FinalReviewStepProps {
  errorMessage: string | null;
  generatedResult: SetupGeneratedResult | null;
  inputMode: SetupInputMode;
  isConnected: boolean;
  isSubmitting: boolean;
  planLabel: string;
  preference: OnboardingPreference;
  sourceUrl: string | null;
  submitLabel: string;
  useCase: WorkspaceUseCaseDefinition;
  workspaceName: string;
  onBack: () => void;
  onSubmit: () => void;
  onWorkspaceNameChange: (nextValue: string) => void;
}

function getPreferenceLabel(preference: OnboardingPreference): string {
  return preference === "qualified_only"
    ? "Qualified only"
    : "Qualified and exploratory";
}

export function FinalReviewStep({
  errorMessage,
  generatedResult,
  inputMode,
  isConnected,
  isSubmitting,
  planLabel,
  preference,
  sourceUrl,
  submitLabel,
  useCase,
  workspaceName,
  onBack,
  onSubmit,
  onWorkspaceNameChange,
}: FinalReviewStepProps) {
  const workspaceNameValidation = workspaceNameSchema.safeParse(
    workspaceName.trim()
  );
  const canSubmit = workspaceNameValidation.success && Boolean(generatedResult);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Final review</h2>
        <p className="text-muted-foreground text-sm">
          Confirm the workspace name and the onboarding summary before the setup
          assistant finalizes the workspace.
        </p>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Workspace setup issue</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Workspace name</CardTitle>
          <CardDescription>
            This name will be used in the app once the setup assistant creates
            or updates the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          <Input
            value={workspaceName}
            onChange={(event) => onWorkspaceNameChange(event.target.value)}
            placeholder="Enter workspace name"
            disabled={isSubmitting}
          />
          {!workspaceNameValidation.success && (
            <p className="text-sm font-medium text-red-500">
              {workspaceNameValidation.error.issues[0]?.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Onboarding summary</CardTitle>
          <CardDescription>
            This approval is saved to the active setup draft while the same chat
            thread stays attached to the workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{useCase.displayName}</Badge>
            <Badge variant="outline">{planLabel}</Badge>
            <Badge variant="outline">{getPreferenceLabel(preference)}</Badge>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Input mode
              </dt>
              <dd className="mt-1 font-medium">
                {inputMode === "url" ? "Website URL" : "Manual description"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Connection status
              </dt>
              <dd className="mt-1 font-medium">
                {isConnected ? "X connected" : "Connect later"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Source
              </dt>
              <dd className="mt-1 font-medium break-all">
                {sourceUrl ??
                  generatedResult?.seedDescription ??
                  "No source captured yet"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {submitLabel}
        </Button>
      </div>
    </section>
  );
}
