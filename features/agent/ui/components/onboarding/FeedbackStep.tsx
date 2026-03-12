import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/Sheet";
import { Button } from "@/shared/ui/components/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/Card";
import { Textarea } from "@/shared/ui/components/TextArea";

interface FeedbackStepProps {
  isMobile: boolean;
  isSubmitting: boolean;
  open: boolean;
  value: string;
  onCancel: () => void;
  onSubmit: () => void;
  onValueChange: (nextValue: string) => void;
}

function FeedbackForm({
  isSubmitting,
  value,
  onCancel,
  onSubmit,
  onValueChange,
}: Omit<FeedbackStepProps, "isMobile" | "open">) {
  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="Explain what should change about the description or generated profiles..."
        className="min-h-28"
        disabled={isSubmitting}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitting || value.trim().length === 0}
        >
          Send feedback to the agent
        </Button>
      </div>
    </div>
  );
}

export function FeedbackStep({
  isMobile,
  isSubmitting,
  open,
  value,
  onCancel,
  onSubmit,
  onValueChange,
}: FeedbackStepProps) {
  if (!open) {
    return null;
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
        <SheetContent side="bottom" className="h-[75vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Give structured feedback</SheetTitle>
            <SheetDescription>
              Your notes will be sent back into the same setup thread so the
              assistant can revise the draft.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <FeedbackForm
              isSubmitting={isSubmitting}
              value={value}
              onCancel={onCancel}
              onSubmit={onSubmit}
              onValueChange={onValueChange}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base">Give structured feedback</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <FeedbackForm
          isSubmitting={isSubmitting}
          value={value}
          onCancel={onCancel}
          onSubmit={onSubmit}
          onValueChange={onValueChange}
        />
      </CardContent>
    </Card>
  );
}
