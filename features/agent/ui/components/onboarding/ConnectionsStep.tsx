import Link from "next/link";
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

interface ConnectionsStepProps {
  connectedAccountLabel: string | null;
  isConnected: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export function ConnectionsStep({
  connectedAccountLabel,
  isConnected,
  onBack,
  onContinue,
}: ConnectionsStepProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Connect accounts</h2>
        <p className="text-muted-foreground text-sm">
          Account connections are optional for setup, but connecting X lets you
          move faster once this workspace is ready.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">X account status</CardTitle>
          <CardDescription>
            Manage posting and agent execution from connected accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 text-sm">
          {isConnected ? (
            <Alert>
              <AlertTitle>Connected</AlertTitle>
              <AlertDescription>
                {connectedAccountLabel
                  ? `Connected as ${connectedAccountLabel}.`
                  : "An X account is connected for this workspace owner."}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Not connected yet</AlertTitle>
              <AlertDescription>
                You can continue setup now and connect X later from settings.
              </AlertDescription>
            </Alert>
          )}

          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/connected-accounts">
              Manage connected accounts
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onContinue}>
          Continue to plan
        </Button>
      </div>
    </section>
  );
}
