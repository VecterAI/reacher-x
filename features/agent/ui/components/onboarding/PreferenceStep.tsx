import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/components/RadioGroup";
import { Label } from "@/shared/ui/components/Label";

export type OnboardingPreference = "qualified_only" | "all_matches";

interface PreferenceStepProps {
  value: OnboardingPreference;
  onBack: () => void;
  onContinue: () => void;
  onValueChange: (nextValue: OnboardingPreference) => void;
}

export function PreferenceStep({
  value,
  onBack,
  onContinue,
  onValueChange,
}: PreferenceStepProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Preference</h2>
        <p className="text-muted-foreground text-sm">
          Capture the initial discovery preference that should guide the setup
          conversation.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">Discovery preference</CardTitle>
          <CardDescription>
            This is shared with the assistant in the final review so it knows
            how you want to begin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <RadioGroup
            value={value}
            onValueChange={(nextValue) =>
              onValueChange(nextValue as OnboardingPreference)
            }
            className="gap-3"
          >
            <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="qualified_only" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">Qualified only</p>
                <p className="text-muted-foreground text-sm">
                  Start by focusing on the strongest matches first.
                </p>
              </div>
            </Label>
            <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="all_matches" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">Qualified and exploratory</p>
                <p className="text-muted-foreground text-sm">
                  Include both high-confidence matches and broader discovery
                  candidates.
                </p>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onContinue}>
          Continue to final review
        </Button>
      </div>
    </section>
  );
}
