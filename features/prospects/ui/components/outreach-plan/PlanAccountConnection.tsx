"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/components/Button";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/shared/ui/components/Alert";
import { PLATFORM_REGISTRY } from "@/shared/lib/platforms/registry";
import type { OutreachReadiness } from "@/convex/lib/outreachReadinessCore";

type Platform = OutreachReadiness["missingPlatforms"][number];
export function PlanAccountNotice({
  platforms,
  approvalRequired,
}: {
  platforms: Platform[];
  approvalRequired: boolean;
}) {
  if (!platforms.length) return null;
  return (
    <Alert>
      <AlertTitle className="text-balance">Connect your account</AlertTitle>
      <AlertDescription className="text-pretty">
        Connect {platforms.map((p) => PLATFORM_REGISTRY[p].label).join(" and ")}{" "}
        {approvalRequired
          ? "to approve this plan and let the agent run its tasks."
          : "so the agent can continue this plan."}
      </AlertDescription>
    </Alert>
  );
}

export function PlanConnectButton({
  platform,
  disabled,
}: {
  platform: Platform;
  disabled?: boolean;
}) {
  const router = useRouter();
  return (
    <Button
      size="xs"
      variant="secondary"
      disabled={disabled}
      onClick={() => router.push("/settings/connected-accounts")}
    >
      Connect {PLATFORM_REGISTRY[platform].label}
    </Button>
  );
}
