import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { AsciiSpinnerText } from "@/shared/ui/components/AsciiSpinnerText";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import type { SetupGeneratedResult } from "@/features/agent/lib/setupOnboarding";

interface GeneratedReviewStepProps {
  errorMessage: string | null;
  generatedResult: SetupGeneratedResult | null;
  isGenerating: boolean;
  isSubmitting: boolean;
  profileLabelPlural: string;
  successLabel: string;
  onContinue: () => void;
  onEditInput: () => void;
  onOpenFeedback: () => void;
  onRegenerate: () => void;
}

export function GeneratedReviewStep({
  errorMessage,
  generatedResult,
  isGenerating,
  isSubmitting,
  profileLabelPlural,
  successLabel,
  onContinue,
  onEditInput,
  onOpenFeedback,
  onRegenerate,
}: GeneratedReviewStepProps) {
  const isBusy = isGenerating || isSubmitting;

  if (!generatedResult) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Review generated setup</h2>
          <p className="text-muted-foreground text-sm">
            The setup assistant will generate a sharper description and draft{" "}
            {profileLabelPlural.toLowerCase()} here.
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-base">
              {isBusy ? "Generating setup draft" : "Waiting for your input"}
            </CardTitle>
            <CardDescription>
              {isBusy
                ? "The chat is analyzing your workspace input and building a structured setup draft."
                : "Submit a website or description first, then come back here to review the generated draft."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isBusy ? (
              <AsciiSpinnerText text="Generating description and profiles..." />
            ) : null}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Review the generated draft</h2>
        <p className="text-muted-foreground text-sm">
          Check the refined description, the proposed{" "}
          {profileLabelPlural.toLowerCase()}, and the way success is framed as{" "}
          {successLabel.toLowerCase()}.
        </p>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Generation issue</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Improved description</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm leading-6">
            {generatedResult.improvedDescription}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {generatedResult.icps.map((profile, index) => (
          <Card key={`${profile.title}-${index}`}>
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-base">{profile.title}</CardTitle>
              <CardDescription>{profile.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 text-sm">
              <div>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Pain points
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.painPoints.map((painPoint) => (
                    <Badge key={painPoint} variant="outline">
                      {painPoint}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Channels
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.channels.map((channel) => (
                    <Badge key={channel} variant="secondary">
                      {channel}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onEditInput}
          disabled={isBusy}
        >
          Edit input
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isBusy}
        >
          Regenerate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFeedback}
          disabled={isBusy}
        >
          Give feedback
        </Button>
        <Button
          size="sm"
          className="sm:ml-auto"
          onClick={onContinue}
          disabled={isBusy}
        >
          Continue to connections
        </Button>
      </div>
    </section>
  );
}
