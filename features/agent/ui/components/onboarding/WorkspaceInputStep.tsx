import { useMemo } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/ui/components/Alert";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { DescriptionAutoFillTextarea } from "@/shared/ui/components/DescriptionAutoFillTextarea";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/components/Tabs";
import { descriptionSchema } from "@/shared/lib/schemas/validation";
import { getUrlFromWholeValue } from "@/shared/lib/urls/urlParsing";
import type { SetupInputMode } from "@/features/agent/lib/setupOnboarding";

interface WorkspaceInputStepProps {
  inputMode: SetupInputMode;
  inputValue: string;
  isReadingUrl: boolean;
  isSubmitting: boolean;
  profileLabelPlural: string;
  sourceUrl: string | null;
  onContinue: () => void;
  onInputModeChange: (nextMode: SetupInputMode) => void;
  onInputValueChange: (nextValue: string) => void;
  onReadingChange: (isReading: boolean) => void;
  onSourceUrlChange: (nextUrl: string | null) => void;
}

export function WorkspaceInputStep({
  inputMode,
  inputValue,
  isReadingUrl,
  isSubmitting,
  profileLabelPlural,
  sourceUrl,
  onContinue,
  onInputModeChange,
  onInputValueChange,
  onReadingChange,
  onSourceUrlChange,
}: WorkspaceInputStepProps) {
  const detectedUrl = useMemo(
    () => sourceUrl ?? getUrlFromWholeValue(inputValue.trim()),
    [inputValue, sourceUrl]
  );
  const descriptionValidation = useMemo(
    () => descriptionSchema.safeParse(inputValue.trim()),
    [inputValue]
  );
  const canContinue =
    inputMode === "url" ? Boolean(detectedUrl) : descriptionValidation.success;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Add your workspace input</h2>
        <p className="text-muted-foreground text-sm">
          Start from a website URL or a manual description. The chat will
          analyze it and generate your {profileLabelPlural.toLowerCase()}.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Workspace source</CardTitle>
          <CardDescription>
            Use the same input that best explains what this workspace is trying
            to reach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0">
          <Tabs
            value={inputMode}
            onValueChange={(value) =>
              onInputModeChange(value as SetupInputMode)
            }
          >
            <TabsList size="sm" className="w-full">
              <TabsTrigger value="url" size="sm" className="flex-1">
                Use URL
              </TabsTrigger>
              <TabsTrigger value="manual" size="sm" className="flex-1">
                Use description
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {inputMode === "url" ? (
            <Alert>
              <AlertTitle>Paste the full website URL</AlertTitle>
              <AlertDescription>
                The field below can read the page and auto-fill a draft summary,
                but the setup assistant will still use the original URL in the
                same chat thread.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Describe the workspace clearly</AlertTitle>
              <AlertDescription>
                Focus on what you offer, who it is for, and the main pain points
                or goals involved.
              </AlertDescription>
            </Alert>
          )}

          <DescriptionAutoFillTextarea
            value={inputValue}
            onValueChange={onInputValueChange}
            setText={(text) => onInputValueChange(text)}
            onReadingChange={onReadingChange}
            onSourceUrlChange={onSourceUrlChange}
            disabled={isSubmitting}
            placeholder={
              inputMode === "url"
                ? "Paste a website URL to analyze..."
                : "Describe the product, service, audience, and goals for this workspace..."
            }
            showCharacterCounter={inputMode === "manual"}
          />

          {detectedUrl && (
            <p className="text-muted-foreground text-xs">
              Source URL detected: {detectedUrl}
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        size="sm"
        className="w-full"
        onClick={onContinue}
        disabled={!canContinue || isSubmitting || isReadingUrl}
      >
        Continue with this input
      </Button>
    </section>
  );
}
